using System.Reflection;
using System.Runtime.Versioning;
using WorkPulse.Service.Config;
using WorkPulse.Service.Policy;
using WorkPulse.Service.Queue;
using WorkPulse.Service.Registration;
using WorkPulse.Service.Status;
using WorkPulse.Service.Storage;
using WorkPulse.Service.Sync;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Pipe;

/// <summary>
/// Dispatches pipe requests. The service trusts a client only for the message kinds its declared
/// component is allowed to send (collector: events; UI: control requests).
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class MessageRouter
{
    private static readonly HashSet<string> KnownEventTypes = new(StringComparer.Ordinal)
    {
        ActivityEventTypes.AgentStarted, ActivityEventTypes.AgentStopped, ActivityEventTypes.AgentHeartbeat,
        ActivityEventTypes.SessionStart, ActivityEventTypes.SessionEnd, ActivityEventTypes.SessionLock, ActivityEventTypes.SessionUnlock,
        ActivityEventTypes.ForegroundApp, ActivityEventTypes.IdleStart, ActivityEventTypes.IdleEnd, ActivityEventTypes.InputSummary,
        ActivityEventTypes.BreakStart, ActivityEventTypes.BreakEnd, ActivityEventTypes.NetworkOffline, ActivityEventTypes.NetworkOnline,
        ActivityEventTypes.PolicyApplied, ActivityEventTypes.DeviceInfo,
    };

    private readonly EncryptedEventQueue _queue;
    private readonly StatusAggregator _status;
    private readonly RegistrationService _registration;
    private readonly SyncWorker _sync;
    private readonly PolicyStore _policy;
    private readonly DeviceState _device;
    private readonly AgentPaths _paths;
    private readonly AgentOptions _options;
    private readonly ILogger<MessageRouter> _logger;

    public MessageRouter(EncryptedEventQueue queue, StatusAggregator status, RegistrationService registration, SyncWorker sync,
        PolicyStore policy, DeviceState device, AgentPaths paths, AgentOptions options, ILogger<MessageRouter> logger)
    {
        _queue = queue;
        _status = status;
        _registration = registration;
        _sync = sync;
        _policy = policy;
        _device = device;
        _paths = paths;
        _options = options;
        _logger = logger;
    }

    public async Task HandleAsync(PipeConnection conn, IpcEnvelope env, CancellationToken ct)
    {
        try
        {
            switch (env.Kind)
            {
                case IpcKinds.Hello:
                    await HelloAsync(conn, env, ct);
                    break;
                case IpcKinds.Event:
                    await EventAsync(conn, env, ct);
                    break;
                case IpcKinds.StatusGet:
                    await conn.ReplyAsync(env, IpcKinds.Status, _status.Build(), ct);
                    break;
                case IpcKinds.Register:
                    await RegisterAsync(conn, env, ct);
                    break;
                case IpcKinds.BreakStart:
                case IpcKinds.BreakEnd:
                    await BreakAsync(conn, env, ct);
                    break;
                case IpcKinds.SyncNow:
                    RequireUi(conn);
                    await conn.ReplyAsync(env, IpcKinds.SyncResult, await _sync.SyncNowAsync(ct), ct);
                    break;
                case IpcKinds.DiagnosticsGet:
                    RequireUi(conn);
                    await conn.ReplyAsync(env, IpcKinds.Diagnostics, BuildDiagnostics(), ct);
                    break;
                default:
                    await conn.ReplyAsync(env, IpcKinds.Error, new ErrorBody { Code = "UNSUPPORTED", Message = $"Unknown message kind '{env.Kind}'" }, ct);
                    break;
            }
        }
        catch (PipeAuthorizationException ex)
        {
            await conn.ReplyAsync(env, IpcKinds.Error, new ErrorBody { Code = "FORBIDDEN", Message = ex.Message }, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Pipe request {Kind} failed", env.Kind);
            await conn.ReplyAsync(env, IpcKinds.Error, new ErrorBody { Code = "INTERNAL", Message = ex.Message }, ct);
        }
    }

    public void OnDisconnected(PipeConnection conn)
    {
        if (conn.Component == "collector")
        {
            _status.CollectorConnected = false;
            _status.CollectorVersion = null;
            _status.NotifyChanged();
        }
        else if (conn.Component == "ui")
        {
            _status.UiConnected = false;
        }
    }

    private async Task HelloAsync(PipeConnection conn, IpcEnvelope env, CancellationToken ct)
    {
        var hello = env.BodyAs<HelloBody>() ?? new HelloBody();
        if (hello.Component is not ("collector" or "ui"))
        {
            throw new PipeAuthorizationException("Unknown component");
        }
        conn.Component = hello.Component;
        conn.Version = hello.Version;
        conn.SessionId = hello.SessionId;
        await conn.ReplyAsync(env, IpcKinds.HelloAck, new HelloAckBody { ServiceVersion = _options.AgentVersion }, ct);
        if (hello.Component == "collector")
        {
            _status.CollectorConnected = true;
            _status.CollectorVersion = hello.Version;
            if (_policy.Current is { } policy)
            {
                await conn.SendAsync(IpcEnvelope.Create(IpcKinds.Policy, policy), ct);
            }
            _logger.LogInformation("Collector connected (v{Version}, session {Session})", hello.Version, hello.SessionId);
        }
        else
        {
            _status.UiConnected = true;
            await conn.SendAsync(IpcEnvelope.Create(IpcKinds.Status, _status.Build()), ct);
        }
        _status.NotifyChanged();
    }

    private async Task EventAsync(PipeConnection conn, IpcEnvelope env, CancellationToken ct)
    {
        if (conn.Component != "collector")
        {
            throw new PipeAuthorizationException("Only the collector may submit events");
        }
        var evt = env.BodyAs<ActivityEvent>();
        var problem = Validate(evt);
        if (problem != null)
        {
            _logger.LogWarning("Rejected collector event: {Problem}", problem);
            await conn.ReplyAsync(env, IpcKinds.Ack, new AckBody { Ok = false, Error = problem }, ct);
            return;
        }
        if (_device.IsRevoked)
        {
            await conn.ReplyAsync(env, IpcKinds.Ack, new AckBody { Ok = false, Error = "DEVICE_REVOKED" }, ct);
            return;
        }
        _queue.Enqueue(evt!);
        _status.Apply(evt!);
        await conn.ReplyAsync(env, IpcKinds.Ack, new AckBody { Ok = true }, ct);
        if (_queue.Depth >= _options.PendingEventsThreshold)
        {
            _sync.Signal();
        }
    }

    private async Task RegisterAsync(PipeConnection conn, IpcEnvelope env, CancellationToken ct)
    {
        RequireUi(conn);
        var body = env.BodyAs<RegisterBody>() ?? new RegisterBody();
        var result = await _registration.RegisterAsync(body, ct);
        await conn.ReplyAsync(env, IpcKinds.RegisterResult, result, ct);
        if (result.Ok)
        {
            _sync.Signal();
        }
    }

    private async Task BreakAsync(PipeConnection conn, IpcEnvelope env, CancellationToken ct)
    {
        RequireUi(conn);
        if (!_device.IsRegistered)
        {
            await conn.ReplyAsync(env, IpcKinds.Ack, new AckBody { Ok = false, Error = "Device is not registered" }, ct);
            return;
        }
        var start = env.Kind == IpcKinds.BreakStart;
        if (start == _status.OnBreak)
        {
            await conn.ReplyAsync(env, IpcKinds.Ack, new AckBody { Ok = false, Error = start ? "Already on a break" : "Not on a break" }, ct);
            return;
        }
        var body = env.BodyAs<BreakBody>() ?? new BreakBody();
        var payload = new Dictionary<string, object?> { ["breakType"] = "DECLARED" };
        if (start && !string.IsNullOrWhiteSpace(body.Note))
        {
            payload["note"] = body.Note.Trim().Length > 120 ? body.Note.Trim()[..120] : body.Note.Trim();
        }
        var evt = ActivityEvent.Of(start ? ActivityEventTypes.BreakStart : ActivityEventTypes.BreakEnd, _status.CurrentSessionId, payload);
        _queue.Enqueue(evt);
        _status.Apply(evt);
        await conn.ReplyAsync(env, IpcKinds.Ack, new AckBody { Ok = true }, ct);
        _sync.Signal();
    }

    private Diagnostics BuildDiagnostics() => new()
    {
        Queue = _queue.Stats(),
        DeadLetters = _queue.DeadLetters(),
        RecentErrors = _status.RecentErrors(),
        Versions = new Versions
        {
            Service = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? _options.AgentVersion,
            Collector = _status.CollectorVersion,
            Ui = "",
        },
        Paths = new Dictionary<string, string>
        {
            ["queue"] = _paths.Queue,
            ["config"] = _paths.Config,
            ["logs"] = _paths.Logs,
        },
        LastBatch = _status.LastBatch,
    };

    /// <summary>Structural validation plus the hard privacy rule: forbidden payload keys never enter the queue.</summary>
    private static string? Validate(ActivityEvent? evt)
    {
        if (evt == null) { return "Missing event body"; }
        if (!Guid.TryParse(evt.EventId, out _)) { return "eventId must be a UUID"; }
        if (!KnownEventTypes.Contains(evt.Type)) { return $"Unknown event type '{evt.Type}'"; }
        if (evt.OccurredAt > DateTimeOffset.UtcNow.AddMinutes(5)) { return "occurredAt is in the future"; }
        foreach (var key in evt.Payload.Keys)
        {
            if (IpcProtocol.ForbiddenPayloadKeys.Contains(key))
            {
                return $"Forbidden payload key '{key}'";
            }
        }
        if (evt.Payload.Count > 32) { return "Payload has too many fields"; }
        return null;
    }

    private static void RequireUi(PipeConnection conn)
    {
        if (conn.Component != "ui")
        {
            throw new PipeAuthorizationException("Only the agent UI may send this request");
        }
    }

    private sealed class PipeAuthorizationException : Exception
    {
        public PipeAuthorizationException(string message) : base(message) { }
    }
}
