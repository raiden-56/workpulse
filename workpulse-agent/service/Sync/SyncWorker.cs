using System.Runtime.Versioning;
using WorkPulse.Service.Config;
using WorkPulse.Service.Policy;
using WorkPulse.Service.Queue;
using WorkPulse.Service.Registration;
using WorkPulse.Service.Status;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Sync;

/// <summary>
/// Drains the encrypted queue to <c>POST /api/v1/activity/batch</c>.
/// Batches: at most MaxBatchEvents / MaxBatchBytes, every SyncIntervalSeconds or as soon as
/// PendingEventsThreshold events are waiting. Accepted + duplicate events are deleted, rejected
/// ones are dead-lettered. Transport errors, 429 and 5xx back off exponentially (2 s → 5 min
/// with jitter) and leave the queue untouched. <c>401 DEVICE_REVOKED</c> stops synchronisation.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class SyncWorker : BackgroundService
{
    private static readonly TimeSpan MinBackoff = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);

    private readonly EncryptedEventQueue _queue;
    private readonly BackendClient _backend;
    private readonly DeviceState _device;
    private readonly PolicyStore _policy;
    private readonly StatusAggregator _status;
    private readonly AgentOptions _options;
    private readonly ILogger<SyncWorker> _logger;
    private readonly SemaphoreSlim _signal = new(0, int.MaxValue);
    private readonly SemaphoreSlim _gate = new(1, 1);
    private TimeSpan _backoff = MinBackoff;
    private DateTimeOffset _notBefore = DateTimeOffset.MinValue;
    private long _clockOffsetMs;

    public event Action<EffectivePolicy>? PolicyVersionChanged;
    public event Action<NotificationBody>? Notify;

    public SyncWorker(EncryptedEventQueue queue, BackendClient backend, DeviceState device, PolicyStore policy, StatusAggregator status, AgentOptions options, ILogger<SyncWorker> logger)
    {
        _queue = queue;
        _backend = backend;
        _device = device;
        _policy = policy;
        _status = status;
        _options = options;
        _logger = logger;
    }

    /// <summary>Wakes the worker early (new events, registration completed).</summary>
    public void Signal()
    {
        if (_signal.CurrentCount == 0)
        {
            _signal.Release();
        }
    }

    /// <summary>Immediate synchronisation requested by the UI; bypasses back-off once.</summary>
    public async Task<SyncResultBody> SyncNowAsync(CancellationToken ct)
    {
        _notBefore = DateTimeOffset.MinValue;
        var outcome = await SyncOnceAsync(ct);
        Signal();
        return outcome;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Sync worker started (interval {Interval}s, batch {Batch})", _options.SyncIntervalSeconds, _options.MaxBatchEvents);
        var lastRetention = DateTimeOffset.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var wait = TimeSpan.FromSeconds(Math.Max(5, _options.SyncIntervalSeconds));
                await _signal.WaitAsync(wait, stoppingToken);
                if (DateTimeOffset.UtcNow < _notBefore)
                {
                    continue; // backing off
                }
                await SyncOnceAsync(stoppingToken);
                // keep draining while a lot is pending
                while (!stoppingToken.IsCancellationRequested && _queue.Depth >= _options.PendingEventsThreshold && DateTimeOffset.UtcNow >= _notBefore)
                {
                    await SyncOnceAsync(stoppingToken);
                }
                if (DateTimeOffset.UtcNow - lastRetention > TimeSpan.FromHours(6))
                {
                    _queue.ApplyRetention(_options.QueueRetentionDays);
                    lastRetention = DateTimeOffset.UtcNow;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sync loop error");
                _status.RecordError("Sync loop: " + ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private async Task<SyncResultBody> SyncOnceAsync(CancellationToken ct)
    {
        if (!await _gate.WaitAsync(0, ct))
        {
            return new SyncResultBody { Ok = false, Error = "Synchronisation already in progress" };
        }
        try
        {
            if (!_device.IsRegistered)
            {
                return new SyncResultBody { Ok = false, Error = "Device is not registered" };
            }
            if (_device.IsRevoked)
            {
                return new SyncResultBody { Ok = false, Error = "Device has been revoked" };
            }
            var token = _device.DeviceToken!;
            var pending = _queue.Peek(_options.MaxBatchEvents, _options.MaxBatchBytes);
            if (pending.Count == 0)
            {
                _status.BackendReachable = await _backend.IsReachableAsync(_device.ApiBaseUrl, ct);
                _status.NotifyChanged();
                return new SyncResultBody { Ok = true };
            }

            var batch = new ActivityBatchRequest
            {
                DeviceId = _device.DeviceId,
                AgentVersion = _options.AgentVersion,
                SentAt = DateTimeOffset.UtcNow,
                ClockOffsetMs = _clockOffsetMs == 0 ? null : _clockOffsetMs,
                Events = pending.Select(p => p.Event).ToList(),
            };
            var result = await _backend.PostBatchAsync(_device.ApiBaseUrl, token, batch, ct);

            if (result.Ok && result.Data != null)
            {
                var response = result.Data;
                var rejectedIds = new HashSet<string>(response.Rejected.Select(r => r.EventId), StringComparer.OrdinalIgnoreCase);
                foreach (var queued in pending.Where(p => rejectedIds.Contains(p.Event.EventId)))
                {
                    var reason = response.Rejected.First(r => string.Equals(r.EventId, queued.Event.EventId, StringComparison.OrdinalIgnoreCase)).Reason;
                    _queue.DeadLetter(queued.Event, reason);
                }
                _queue.Remove(pending.Select(p => p.Event.EventId).ToList());
                _backoff = MinBackoff;
                _notBefore = DateTimeOffset.MinValue;
                if (result.ServerDate is { } serverDate)
                {
                    _clockOffsetMs = (long)(serverDate - DateTimeOffset.UtcNow).TotalMilliseconds;
                    if (Math.Abs(_clockOffsetMs) < 2000) { _clockOffsetMs = 0; }
                }
                _status.BackendReachable = true;
                _status.LastSyncAt = DateTimeOffset.UtcNow;
                _status.LastSyncError = null;
                _status.LastBatch = new LastBatch { At = DateTimeOffset.UtcNow, Accepted = response.Accepted, Duplicates = response.Duplicates, Rejected = response.Rejected.Count };
                if (_device.IsPending) { _device.SetStatus("APPROVED"); }
                if (_policy.Version != response.PolicyVersion)
                {
                    PolicyVersionChanged?.Invoke(_policy.Current ?? new EffectivePolicy { Version = response.PolicyVersion });
                }
                HandleCommands(response.Commands);
                _status.NotifyChanged();
                _logger.LogInformation("Batch {Batch}: {Accepted} accepted, {Duplicates} duplicates, {Rejected} rejected; {Depth} pending",
                    response.BatchId, response.Accepted, response.Duplicates, response.Rejected.Count, _queue.Depth);
                return new SyncResultBody { Ok = true, Accepted = response.Accepted, Duplicates = response.Duplicates, Rejected = response.Rejected.Count };
            }

            if (BackendClient.IsRevoked(result))
            {
                _device.MarkRevoked();
                _status.BackendReachable = true;
                _status.LastSyncError = "Device revoked by the organisation";
                _status.NotifyChanged();
                Notify?.Invoke(new NotificationBody { Level = "error", Title = "Device revoked", Message = "Your IT administrator revoked this device. Collection has stopped." });
                _logger.LogWarning("Device revoked; synchronisation stopped");
                return new SyncResultBody { Ok = false, Error = "DEVICE_REVOKED" };
            }
            if (result.StatusCode == 403 && string.Equals(result.ErrorCode, "DEVICE_PENDING", StringComparison.OrdinalIgnoreCase))
            {
                _device.SetStatus("PENDING");
                _status.BackendReachable = true;
                _status.LastSyncError = "Awaiting device approval";
                Backoff();
                _status.NotifyChanged();
                return new SyncResultBody { Ok = false, Error = "DEVICE_PENDING" };
            }
            if (result.StatusCode == 401)
            {
                _status.BackendReachable = true;
                _status.LastSyncError = "Device token rejected: " + result.Describe();
                _status.RecordError(_status.LastSyncError);
                Backoff();
                _status.NotifyChanged();
                return new SyncResultBody { Ok = false, Error = result.Describe() };
            }
            if (result.StatusCode is >= 400 and < 500 && result.StatusCode != 429)
            {
                // A whole batch rejected for a structural reason (e.g. 413/400): dead-letter it rather than loop forever.
                foreach (var queued in pending) { _queue.DeadLetter(queued.Event, "BATCH_REJECTED:" + result.ErrorCode); }
                _queue.Remove(pending.Select(p => p.Event.EventId).ToList());
                _status.LastSyncError = result.Describe();
                _status.RecordError("Batch rejected: " + result.Describe());
                _status.NotifyChanged();
                return new SyncResultBody { Ok = false, Rejected = pending.Count, Error = result.Describe() };
            }

            _status.BackendReachable = !result.Transport;
            _status.LastSyncError = result.Describe();
            _status.RecordError("Sync failed: " + result.Describe());
            Backoff();
            _status.NotifyChanged();
            return new SyncResultBody { Ok = false, Error = result.Describe() };
        }
        finally
        {
            _gate.Release();
        }
    }

    private void HandleCommands(IEnumerable<AgentCommand> commands)
    {
        foreach (var command in commands)
        {
            switch (command.Type)
            {
                case "REFRESH_POLICY":
                    PolicyVersionChanged?.Invoke(_policy.Current ?? new EffectivePolicy());
                    break;
                case "REVOKED":
                    _device.MarkRevoked();
                    break;
                default:
                    _logger.LogDebug("Command {Type} received with batch response", command.Type);
                    break;
            }
        }
    }

    private void Backoff()
    {
        var jitter = Random.Shared.NextDouble() * 0.3 + 0.85;
        _notBefore = DateTimeOffset.UtcNow + TimeSpan.FromMilliseconds(_backoff.TotalMilliseconds * jitter);
        _backoff = TimeSpan.FromMilliseconds(Math.Min(MaxBackoff.TotalMilliseconds, _backoff.TotalMilliseconds * 2));
        _logger.LogWarning("Sync back-off until {NotBefore:HH:mm:ss}", _notBefore.ToLocalTime());
    }
}
