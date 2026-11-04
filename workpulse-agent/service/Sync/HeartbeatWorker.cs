using System.Runtime.Versioning;
using WorkPulse.Service.Config;
using WorkPulse.Service.Policy;
using WorkPulse.Service.Queue;
using WorkPulse.Service.Registration;
using WorkPulse.Service.Status;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Sync;

/// <summary>
/// Periodic <c>POST /api/v1/agent/heartbeat</c>: reports health, learns about approval, policy
/// changes and available updates, and refreshes the cached policy on <c>REFRESH_POLICY</c>.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class HeartbeatWorker : BackgroundService
{
    private readonly BackendClient _backend;
    private readonly DeviceState _device;
    private readonly PolicyStore _policy;
    private readonly EncryptedEventQueue _queue;
    private readonly StatusAggregator _status;
    private readonly SyncWorker _sync;
    private readonly AgentOptions _options;
    private readonly ILogger<HeartbeatWorker> _logger;
    private readonly SemaphoreSlim _refreshSignal = new(0, int.MaxValue);

    public event Action<NotificationBody>? Notify;

    public HeartbeatWorker(BackendClient backend, DeviceState device, PolicyStore policy, EncryptedEventQueue queue, StatusAggregator status, SyncWorker sync, AgentOptions options, ILogger<HeartbeatWorker> logger)
    {
        _backend = backend;
        _device = device;
        _policy = policy;
        _queue = queue;
        _status = status;
        _sync = sync;
        _options = options;
        _logger = logger;
        _sync.PolicyVersionChanged += _ => RequestPolicyRefresh();
    }

    public void RequestPolicyRefresh()
    {
        if (_refreshSignal.CurrentCount == 0)
        {
            _refreshSignal.Release();
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var refreshRequested = await _refreshSignal.WaitAsync(TimeSpan.FromSeconds(Math.Max(15, _options.HeartbeatIntervalSeconds)), stoppingToken);
                if (!_device.IsRegistered || _device.IsRevoked)
                {
                    continue;
                }
                if (refreshRequested)
                {
                    await RefreshPolicyAsync(stoppingToken);
                }
                await HeartbeatAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Heartbeat loop error");
            }
        }
    }

    private async Task HeartbeatAsync(CancellationToken ct)
    {
        var request = new HeartbeatRequest
        {
            AgentVersion = _options.AgentVersion,
            QueueDepth = (int)Math.Min(int.MaxValue, _queue.Depth),
            LastSyncAt = _status.LastSyncAt,
            CollectorConnected = _status.CollectorConnected,
            UiConnected = _status.UiConnected,
            PolicyVersion = _policy.Version,
            CurrentSessionId = _status.CurrentSessionId,
        };
        var result = await _backend.HeartbeatAsync(_device.ApiBaseUrl, _device.DeviceToken!, request, ct);
        if (BackendClient.IsRevoked(result))
        {
            _device.MarkRevoked();
            _status.NotifyChanged();
            return;
        }
        if (!result.Ok || result.Data == null)
        {
            _status.BackendReachable = !result.Transport;
            _logger.LogDebug("Heartbeat failed: {Error}", result.Describe());
            _status.NotifyChanged();
            return;
        }
        _status.BackendReachable = true;
        var response = result.Data;
        var wasPending = _device.IsPending;
        _device.SetStatus(response.DeviceStatus);
        if (wasPending && response.DeviceStatus == "APPROVED")
        {
            Notify?.Invoke(new NotificationBody { Level = "info", Title = "Device approved", Message = "Your IT administrator approved this device. Buffered events will now be sent." });
            _sync.Signal();
        }
        foreach (var command in response.Commands)
        {
            switch (command.Type)
            {
                case "REFRESH_POLICY":
                    await RefreshPolicyAsync(ct);
                    break;
                case "PENDING_APPROVAL":
                    _device.SetStatus("PENDING");
                    break;
                case "REVOKED":
                    _device.MarkRevoked();
                    break;
                case "UPDATE_AVAILABLE":
                    // Download + SHA-256 verification + scheduled install arrive with the update channel (Phase 5+).
                    var version = command.Params != null && command.Params.TryGetValue("version", out var v) ? v.ToString() : "a newer version";
                    _logger.LogInformation("Agent update available: {Version}", version);
                    Notify?.Invoke(new NotificationBody { Level = "info", Title = "Agent update available", Message = $"WorkPulse Agent {version} is available and will be installed by IT at the next idle window." });
                    break;
                case "RESYNC":
                    _sync.Signal();
                    break;
            }
        }
        _status.NotifyChanged();
    }

    private async Task RefreshPolicyAsync(CancellationToken ct)
    {
        var result = await _backend.GetPolicyAsync(_device.ApiBaseUrl, _device.DeviceToken!, ct);
        if (result.Ok && result.Data != null)
        {
            _policy.Apply(result.Data);
            _status.NotifyChanged();
        }
        else
        {
            _logger.LogWarning("Policy refresh failed: {Error}", result.Describe());
        }
    }
}
