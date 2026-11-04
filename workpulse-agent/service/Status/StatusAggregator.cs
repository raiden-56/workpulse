using System.Runtime.Versioning;
using WorkPulse.Service.Config;
using WorkPulse.Service.Policy;
using WorkPulse.Service.Queue;
using WorkPulse.Service.Registration;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Status;

/// <summary>
/// Keeps the live picture shown to the employee: current application, session, today's usage
/// counters and connection/sync health. Fed by collector events as they pass through the
/// service; never stores anything beyond process names and durations.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class StatusAggregator
{
    private readonly DeviceState _device;
    private readonly PolicyStore _policy;
    private readonly EncryptedEventQueue _queue;
    private readonly AgentOptions _options;
    private readonly object _lock = new();

    private DateOnly _day = DateOnly.FromDateTime(DateTime.Now);
    private readonly Dictionary<string, (string AppName, long Seconds)> _usage = new(StringComparer.OrdinalIgnoreCase);
    private readonly TodaySummary _summary = new();
    private CurrentApp? _currentApp;
    private DateTimeOffset? _sessionStartedAt;
    private string? _sessionId;
    private DateTimeOffset? _stateSince;
    private string _collectorState = "NONE"; // NONE | ACTIVE | IDLE | LOCKED | BREAK
    private bool _onBreak;
    private readonly List<ErrorEntry> _errors = new();

    public event Action? Changed;

    public bool CollectorConnected { get; set; }
    public bool UiConnected { get; set; }
    public bool BackendReachable { get; set; }
    public DateTimeOffset? LastSyncAt { get; set; }
    public string? LastSyncError { get; set; }
    public LastBatch? LastBatch { get; set; }
    public string? CollectorVersion { get; set; }
    public string? CurrentSessionId { get { lock (_lock) { return _sessionId; } } }
    public bool OnBreak { get { lock (_lock) { return _onBreak; } } }

    public StatusAggregator(DeviceState device, PolicyStore policy, EncryptedEventQueue queue, AgentOptions options)
    {
        _device = device;
        _policy = policy;
        _queue = queue;
        _options = options;
    }

    /// <summary>Updates counters from an accepted collector event.</summary>
    public void Apply(ActivityEvent evt)
    {
        lock (_lock)
        {
            RollDayIfNeeded();
            var at = evt.OccurredAt;
            switch (evt.Type)
            {
                case ActivityEventTypes.SessionStart:
                    _sessionStartedAt = at;
                    _sessionId = evt.SessionId;
                    Transition("ACTIVE", at);
                    break;
                case ActivityEventTypes.SessionEnd:
                case ActivityEventTypes.AgentStopped:
                    CloseState(at);
                    _sessionStartedAt = null;
                    _currentApp = null;
                    _collectorState = "NONE";
                    break;
                case ActivityEventTypes.SessionLock:
                    Transition("LOCKED", at);
                    _currentApp = null;
                    break;
                case ActivityEventTypes.SessionUnlock:
                    Transition("ACTIVE", at);
                    break;
                case ActivityEventTypes.IdleStart:
                    Transition("IDLE", at);
                    break;
                case ActivityEventTypes.IdleEnd:
                    Transition("ACTIVE", at);
                    break;
                case ActivityEventTypes.BreakStart:
                    _onBreak = true;
                    Transition("BREAK", at);
                    _currentApp = null;
                    break;
                case ActivityEventTypes.BreakEnd:
                    _onBreak = false;
                    Transition("ACTIVE", at);
                    break;
                case ActivityEventTypes.ForegroundApp:
                    var process = evt.Payload.TryGetValue("processName", out var p) ? Convert.ToString(p) ?? "" : "";
                    var app = evt.Payload.TryGetValue("appName", out var a) ? Convert.ToString(a) : null;
                    var durationMs = evt.Payload.TryGetValue("durationMs", out var d) && long.TryParse(Convert.ToString(d), out var ms) ? ms : 0;
                    if (process.Length > 0)
                    {
                        var seconds = Math.Max(0, durationMs / 1000);
                        _usage[process] = _usage.TryGetValue(process, out var existing)
                            ? (existing.AppName, existing.Seconds + seconds)
                            : (app ?? process, seconds);
                        if (_currentApp == null || !_currentApp.ProcessName.Equals(process, StringComparison.OrdinalIgnoreCase))
                        {
                            _currentApp = new CurrentApp { ProcessName = process, AppName = app ?? process, Since = at };
                        }
                    }
                    break;
            }
        }
        Changed?.Invoke();
    }

    public void RecordError(string message)
    {
        lock (_lock)
        {
            _errors.Insert(0, new ErrorEntry { At = DateTimeOffset.UtcNow, Message = message });
            if (_errors.Count > 50) { _errors.RemoveAt(_errors.Count - 1); }
        }
    }

    public List<ErrorEntry> RecentErrors() { lock (_lock) { return _errors.ToList(); } }

    public void NotifyChanged() => Changed?.Invoke();

    public AgentStatus Build()
    {
        lock (_lock)
        {
            RollDayIfNeeded();
            AccrueOpenState(DateTimeOffset.UtcNow);
            var policy = _policy.Current;
            return new AgentStatus
            {
                Registered = _device.IsRegistered,
                DeviceId = _device.DeviceId,
                OrganizationId = _device.OrganizationId,
                Employee = _device.Employee,
                Connection = _device.IsRevoked ? "REVOKED" : !_device.IsRegistered ? "UNKNOWN" : BackendReachable ? "ONLINE" : "OFFLINE",
                BackendReachable = BackendReachable,
                QueueDepth = _queue.Depth,
                DeadLetterCount = _queue.DeadLetterCount,
                LastSyncAt = LastSyncAt,
                LastSyncError = LastSyncError,
                PolicyVersion = policy?.Version,
                PolicyName = policy?.Name,
                Policy = policy,
                Monitoring = Monitoring(),
                CurrentApp = _collectorState == "ACTIVE" ? _currentApp : null,
                SessionStartedAt = _sessionStartedAt,
                CollectorConnected = CollectorConnected,
                OnBreak = _onBreak,
                TodayUsage = _usage.OrderByDescending(kv => kv.Value.Seconds)
                    .Select(kv => new AppUsageEntry { ProcessName = kv.Key, AppName = kv.Value.AppName, Seconds = kv.Value.Seconds }).ToList(),
                TodaySummary = new TodaySummary
                {
                    SessionSeconds = _summary.SessionSeconds,
                    ActiveSeconds = _summary.ActiveSeconds,
                    IdleSeconds = _summary.IdleSeconds,
                    BreakSeconds = _summary.BreakSeconds,
                    LockedSeconds = _summary.LockedSeconds,
                },
                Version = _options.AgentVersion,
                ServiceVersion = _options.AgentVersion,
                ApiBaseUrl = _device.ApiBaseUrl,
            };
        }
    }

    private string Monitoring()
    {
        if (!_device.IsRegistered) { return "NOT_REGISTERED"; }
        if (_device.IsRevoked) { return "REVOKED"; }
        if (_device.IsPending) { return "PENDING_APPROVAL"; }
        if (!CollectorConnected) { return "STOPPED"; }
        if (!_policy.IsInsideCollectionWindow(DateTimeOffset.Now)) { return "PAUSED_OUTSIDE_WINDOW"; }
        return "ACTIVE";
    }

    private void Transition(string next, DateTimeOffset at)
    {
        AccrueOpenState(at);
        _collectorState = next;
        _stateSince = at;
    }

    private void CloseState(DateTimeOffset at)
    {
        AccrueOpenState(at);
        _stateSince = null;
    }

    /// <summary>Adds the time spent in the current state (since the last transition) to today's totals.</summary>
    private void AccrueOpenState(DateTimeOffset until)
    {
        if (_stateSince == null || _collectorState == "NONE")
        {
            return;
        }
        var seconds = (long)Math.Max(0, (until - _stateSince.Value).TotalSeconds);
        if (seconds == 0)
        {
            return;
        }
        _summary.SessionSeconds += seconds;
        switch (_collectorState)
        {
            case "ACTIVE": _summary.ActiveSeconds += seconds; break;
            case "IDLE": _summary.IdleSeconds += seconds; break;
            case "LOCKED": _summary.LockedSeconds += seconds; break;
            case "BREAK": _summary.BreakSeconds += seconds; break;
        }
        _stateSince = until;
    }

    private void RollDayIfNeeded()
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        if (today == _day)
        {
            return;
        }
        _day = today;
        _usage.Clear();
        _summary.SessionSeconds = _summary.ActiveSeconds = _summary.IdleSeconds = _summary.BreakSeconds = _summary.LockedSeconds = 0;
    }
}
