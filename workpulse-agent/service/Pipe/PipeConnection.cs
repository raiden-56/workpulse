using System.IO.Pipes;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Pipe;

/// <summary>One connected pipe client (collector or UI). Reads newline-delimited JSON, writes are serialised.</summary>
[SupportedOSPlatform("windows")]
public sealed class PipeConnection : IDisposable
{
    private readonly NamedPipeServerStream _stream;
    private readonly StreamReader _reader;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly ILogger _logger;

    public Guid Id { get; } = Guid.NewGuid();
    public string? Component { get; set; }
    public string? Version { get; set; }
    public string? SessionId { get; set; }
    public DateTimeOffset ConnectedAt { get; } = DateTimeOffset.UtcNow;

    public PipeConnection(NamedPipeServerStream stream, ILogger logger)
    {
        _stream = stream;
        _logger = logger;
        _reader = new StreamReader(stream, new UTF8Encoding(false), detectEncodingFromByteOrderMarks: false, bufferSize: 64 * 1024, leaveOpen: true);
    }

    public bool IsConnected => _stream.IsConnected;

    public async Task RunAsync(Func<IpcEnvelope, Task> handler, CancellationToken ct)
    {
        while (_stream.IsConnected && !ct.IsCancellationRequested)
        {
            var line = await _reader.ReadLineAsync(ct);
            if (line == null)
            {
                break;
            }
            if (line.Length == 0)
            {
                continue;
            }
            if (line.Length > IpcProtocol.MaxLineBytes)
            {
                _logger.LogWarning("Dropping oversized pipe frame ({Length} chars) from {Component}", line.Length, Component ?? "unknown");
                continue;
            }
            IpcEnvelope? envelope;
            try
            {
                envelope = IpcEnvelope.Parse(line);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning("Malformed pipe frame from {Component}: {Error}", Component ?? "unknown", ex.Message);
                continue;
            }
            if (envelope == null)
            {
                continue;
            }
            await handler(envelope);
        }
    }

    public async Task SendAsync(IpcEnvelope envelope, CancellationToken ct = default)
    {
        if (!_stream.IsConnected)
        {
            return;
        }
        var bytes = Encoding.UTF8.GetBytes(envelope.ToLine());
        await _writeLock.WaitAsync(ct);
        try
        {
            await _stream.WriteAsync(bytes, ct);
            await _stream.FlushAsync(ct);
        }
        catch (IOException ex)
        {
            _logger.LogDebug("Pipe write to {Component} failed: {Error}", Component ?? "unknown", ex.Message);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    public Task ReplyAsync<T>(IpcEnvelope request, string kind, T body, CancellationToken ct = default) =>
        SendAsync(IpcEnvelope.Create(kind, body, request.Id), ct);

    public void Dispose()
    {
        try
        {
            if (_stream.IsConnected)
            {
                _stream.Disconnect();
            }
        }
        catch
        {
            // already gone
        }
        _reader.Dispose();
        _stream.Dispose();
        _writeLock.Dispose();
    }
}
