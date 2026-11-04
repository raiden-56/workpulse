using System.Collections.Concurrent;
using System.IO.Pipes;
using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Principal;
using WorkPulse.Service.Policy;
using WorkPulse.Service.Status;
using WorkPulse.Service.Sync;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Pipe;

/// <summary>
/// Named-pipe server (\\.\pipe\WorkPulse.Agent). Accepts any number of local clients; the DACL
/// allows Authenticated Users read/write so the interactive user's collector and UI can connect
/// (PipeOptions.CurrentUserOnly is deliberately not used: the service runs as SYSTEM, the clients as
/// the signed-in user). .NET always creates server pipes with PIPE_REJECT_REMOTE_CLIENTS, so
/// connections from other machines are refused by the OS.
/// The server never shows UI; it only pushes status/policy/notification frames to connected clients.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class PipeServer : BackgroundService
{
    private readonly MessageRouter _router;
    private readonly StatusAggregator _status;
    private readonly PolicyStore _policy;
    private readonly SyncWorker _sync;
    private readonly HeartbeatWorker _heartbeat;
    private readonly ILogger<PipeServer> _logger;
    private readonly ConcurrentDictionary<Guid, PipeConnection> _connections = new();
    private int _statusFlushScheduled;
    private CancellationToken _stopping;

    public PipeServer(MessageRouter router, StatusAggregator status, PolicyStore policy, SyncWorker sync, HeartbeatWorker heartbeat, ILogger<PipeServer> logger)
    {
        _router = router;
        _status = status;
        _policy = policy;
        _sync = sync;
        _heartbeat = heartbeat;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _stopping = stoppingToken;
        _status.Changed += ScheduleStatusPush;
        _policy.Changed += policy => _ = BroadcastAsync("collector", IpcEnvelope.Create(IpcKinds.Policy, policy));
        _policy.Changed += _ => ScheduleStatusPush();
        _sync.Notify += n => _ = BroadcastAsync("ui", IpcEnvelope.Create(IpcKinds.Notification, n));
        _heartbeat.Notify += n => _ = BroadcastAsync("ui", IpcEnvelope.Create(IpcKinds.Notification, n));
        _ = KeepAliveAsync(stoppingToken);

        _logger.LogInformation("Pipe server listening on \\\\.\\pipe\\{Name}", IpcProtocol.PipeName);
        while (!stoppingToken.IsCancellationRequested)
        {
            NamedPipeServerStream stream;
            try
            {
                stream = CreateStream();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Cannot create the named pipe; retrying in 5 s");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                continue;
            }
            try
            {
                await stream.WaitForConnectionAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                stream.Dispose();
                break;
            }
            catch (IOException ex)
            {
                _logger.LogDebug(ex, "Pipe accept failed");
                stream.Dispose();
                continue;
            }
            var connection = new PipeConnection(stream, _logger);
            _connections[connection.Id] = connection;
            _ = HandleAsync(connection, stoppingToken);
        }
        foreach (var connection in _connections.Values)
        {
            connection.Dispose();
        }
    }

    private static NamedPipeServerStream CreateStream()
    {
        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.AuthenticatedUserSid, null),
            PipeAccessRights.ReadWrite, AccessControlType.Allow));
        security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
            PipeAccessRights.FullControl, AccessControlType.Allow));
        security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
            PipeAccessRights.FullControl, AccessControlType.Allow));
        return NamedPipeServerStreamAcl.Create(IpcProtocol.PipeName, PipeDirection.InOut, NamedPipeServerStream.MaxAllowedServerInstances,
            PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.WriteThrough, 64 * 1024, 64 * 1024, security);
    }

    private async Task HandleAsync(PipeConnection connection, CancellationToken ct)
    {
        try
        {
            await connection.RunAsync(env => _router.HandleAsync(connection, env, ct), ct);
        }
        catch (OperationCanceledException)
        {
            // shutting down
        }
        catch (IOException ex)
        {
            _logger.LogDebug("Pipe client {Component} dropped: {Error}", connection.Component ?? "unknown", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Pipe client {Component} failed", connection.Component ?? "unknown");
        }
        finally
        {
            _connections.TryRemove(connection.Id, out _);
            _router.OnDisconnected(connection);
            connection.Dispose();
        }
    }

    public async Task BroadcastAsync(string component, IpcEnvelope envelope)
    {
        foreach (var connection in _connections.Values.Where(c => c.Component == component))
        {
            await connection.SendAsync(envelope, _stopping);
        }
    }

    /// <summary>Coalesces bursts of status changes into one push every 250 ms.</summary>
    private void ScheduleStatusPush()
    {
        if (Interlocked.Exchange(ref _statusFlushScheduled, 1) == 1)
        {
            return;
        }
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(250, _stopping);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            finally
            {
                Interlocked.Exchange(ref _statusFlushScheduled, 0);
            }
            await BroadcastAsync("ui", IpcEnvelope.Create(IpcKinds.Status, _status.Build()));
        });
    }

    /// <summary>Pushes a status snapshot to the UI at least every 30 s so timers stay fresh.</summary>
    private async Task KeepAliveAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(30), ct);
                await BroadcastAsync("ui", IpcEnvelope.Create(IpcKinds.Status, _status.Build()));
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Keep-alive push failed");
            }
        }
    }
}
