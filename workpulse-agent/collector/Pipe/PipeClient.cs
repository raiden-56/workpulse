using System.Collections.Concurrent;
using System.IO.Pipes;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Collector.Pipe;

/// <summary>
/// Client side of the service pipe. Sends `hello` on connect, forwards events and keeps every
/// un-acknowledged event in memory so a service restart never loses collector data; receives
/// `policy` pushes. Reconnects with back-off.
/// </summary>
[SupportedOSPlatform("windows")]
internal sealed class PipeClient : IAsyncDisposable
{
    private const int MaxUnacked = 20_000;

    private readonly string _pipeName;
    private readonly string _sessionId;
    private readonly string _version;
    private readonly ConcurrentDictionary<string, IpcEnvelope> _unacked = new();
    private readonly ConcurrentQueue<string> _unackedOrder = new();
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly CancellationTokenSource _cts = new();
    private NamedPipeClientStream? _stream;
    private Task? _loop;
    private volatile bool _connected;
    private volatile bool _revoked;

    public event Action<EffectivePolicy>? PolicyReceived;
    public event Action? Connected;

    public bool IsConnected => _connected;
    public bool IsRevoked => _revoked;
    public int Unacked => _unacked.Count;

    public PipeClient(string pipeName, string sessionId, string version)
    {
        _pipeName = pipeName;
        _sessionId = sessionId;
        _version = version;
    }

    public void Start()
    {
        _loop = Task.Run(() => RunAsync(_cts.Token));
    }

    public async Task SendEventAsync(ActivityEvent evt)
    {
        var envelope = IpcEnvelope.Create(IpcKinds.Event, evt);
        if (_unacked.Count >= MaxUnacked)
        {
            // Memory guard: drop the oldest un-acked event and say so loudly. Only reachable if the
            // service has been unreachable for many hours.
            if (_unackedOrder.TryDequeue(out var oldest) && _unacked.TryRemove(oldest, out _))
            {
                CollectorLog.Warn("Un-acked buffer full; dropped oldest event " + oldest);
            }
        }
        _unacked[envelope.Id] = envelope;
        _unackedOrder.Enqueue(envelope.Id);
        await WriteAsync(envelope);
    }

    /// <summary>Waits (bounded) until every sent event has been acknowledged by the service.</summary>
    public async Task FlushAsync(TimeSpan timeout)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;
        while (_unacked.Count > 0 && DateTimeOffset.UtcNow < deadline)
        {
            await Task.Delay(50);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        var delay = TimeSpan.FromSeconds(1);
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var stream = new NamedPipeClientStream(".", _pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
                await stream.ConnectAsync(5000, ct);
                _stream = stream;
                _connected = true;
                delay = TimeSpan.FromSeconds(1);
                CollectorLog.Info("Connected to service pipe");
                await WriteAsync(IpcEnvelope.Create(IpcKinds.Hello, new HelloBody
                {
                    Component = "collector",
                    Version = _version,
                    SessionId = _sessionId,
                    WindowsUser = Environment.UserDomainName + "\\" + Environment.UserName,
                }));
                Connected?.Invoke();
                await ResendUnackedAsync();
                await ReadLoopAsync(stream, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (TimeoutException)
            {
                // service not up yet
            }
            catch (Exception ex)
            {
                CollectorLog.Warn("Pipe connection lost: " + ex.Message);
            }
            _connected = false;
            _stream?.Dispose();
            _stream = null;
            try
            {
                await Task.Delay(delay, ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            delay = TimeSpan.FromMilliseconds(Math.Min(30_000, delay.TotalMilliseconds * 2));
        }
    }

    private async Task ReadLoopAsync(NamedPipeClientStream stream, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, new UTF8Encoding(false), false, 64 * 1024, leaveOpen: true);
        while (stream.IsConnected && !ct.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(ct);
            if (line == null)
            {
                break;
            }
            IpcEnvelope? envelope;
            try
            {
                envelope = IpcEnvelope.Parse(line);
            }
            catch (JsonException)
            {
                continue;
            }
            if (envelope == null)
            {
                continue;
            }
            switch (envelope.Kind)
            {
                case IpcKinds.Ack:
                    if (envelope.ReplyTo != null)
                    {
                        var ack = envelope.BodyAs<AckBody>();
                        _unacked.TryRemove(envelope.ReplyTo, out _);
                        if (ack is { Ok: false } && string.Equals(ack.Error, "DEVICE_REVOKED", StringComparison.OrdinalIgnoreCase))
                        {
                            _revoked = true;
                            CollectorLog.Warn("Service reports the device is revoked; collection will stop");
                        }
                        else if (ack is { Ok: false })
                        {
                            CollectorLog.Warn("Service rejected an event: " + ack.Error);
                        }
                    }
                    break;
                case IpcKinds.Policy:
                    var policy = envelope.BodyAs<EffectivePolicy>();
                    if (policy != null)
                    {
                        PolicyReceived?.Invoke(policy);
                    }
                    break;
                case IpcKinds.Error:
                    var error = envelope.BodyAs<ErrorBody>();
                    CollectorLog.Warn($"Service error {error?.Code}: {error?.Message}");
                    if (envelope.ReplyTo != null)
                    {
                        _unacked.TryRemove(envelope.ReplyTo, out _);
                    }
                    break;
                case IpcKinds.HelloAck:
                    break;
            }
        }
    }

    private async Task ResendUnackedAsync()
    {
        foreach (var id in _unackedOrder.ToArray())
        {
            if (_unacked.TryGetValue(id, out var envelope))
            {
                await WriteAsync(envelope);
            }
        }
    }

    private async Task WriteAsync(IpcEnvelope envelope)
    {
        var stream = _stream;
        if (stream == null || !stream.IsConnected)
        {
            return; // stays in _unacked and is resent on reconnect
        }
        var bytes = Encoding.UTF8.GetBytes(envelope.ToLine());
        await _writeLock.WaitAsync();
        try
        {
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
        }
        catch (Exception ex) when (ex is IOException or ObjectDisposedException)
        {
            _connected = false;
        }
        finally
        {
            _writeLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        _stream?.Dispose();
        if (_loop != null)
        {
            try { await _loop; } catch { /* ignore */ }
        }
        _cts.Dispose();
        _writeLock.Dispose();
    }
}
