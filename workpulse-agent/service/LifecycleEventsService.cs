using System.Runtime.Versioning;
using WorkPulse.Service.Config;
using WorkPulse.Service.Queue;
using WorkPulse.Service.Registration;
using WorkPulse.Service.Status;
using WorkPulse.Service.Sync;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service;

/// <summary>
/// Emits the service-level events (AGENT_STARTED / AGENT_STOPPED / NETWORK_OFFLINE / NETWORK_ONLINE)
/// and attempts a bounded final synchronisation on shutdown so the queue is as empty as possible.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class LifecycleEventsService : IHostedService
{
    private readonly EncryptedEventQueue _queue;
    private readonly DeviceState _device;
    private readonly StatusAggregator _status;
    private readonly SyncWorker _sync;
    private readonly AgentOptions _options;
    private readonly ILogger<LifecycleEventsService> _logger;
    private bool? _lastReachable;

    public LifecycleEventsService(EncryptedEventQueue queue, DeviceState device, StatusAggregator status, SyncWorker sync, AgentOptions options, ILogger<LifecycleEventsService> logger)
    {
        _queue = queue;
        _device = device;
        _status = status;
        _sync = sync;
        _options = options;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _status.Changed += TrackConnectivity;
        if (_device.IsRegistered && !_device.IsRevoked)
        {
            _queue.Enqueue(ActivityEvent.Of(ActivityEventTypes.AgentStarted, null, new Dictionary<string, object?>
            {
                ["osVersion"] = Environment.OSVersion.VersionString,
                ["hostname"] = Environment.MachineName,
                ["agentVersion"] = _options.AgentVersion,
                ["serviceStart"] = true,
            }));
            _sync.Signal();
        }
        _logger.LogInformation("WorkPulse Agent service {Version} started", _options.AgentVersion);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _status.Changed -= TrackConnectivity;
        if (_device.IsRegistered && !_device.IsRevoked)
        {
            _queue.Enqueue(ActivityEvent.Of(ActivityEventTypes.AgentStopped, _status.CurrentSessionId,
                new Dictionary<string, object?> { ["reason"] = "SHUTDOWN" }));
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(8));
                await _sync.SyncNowAsync(cts.Token);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Final sync on shutdown did not complete; events stay queued");
            }
        }
        _logger.LogInformation("WorkPulse Agent service stopping");
    }

    private void TrackConnectivity()
    {
        if (!_device.IsRegistered)
        {
            return;
        }
        var reachable = _status.BackendReachable;
        if (_lastReachable == reachable)
        {
            return;
        }
        var first = _lastReachable == null;
        _lastReachable = reachable;
        if (first)
        {
            return;
        }
        _queue.Enqueue(ActivityEvent.Of(reachable ? ActivityEventTypes.NetworkOnline : ActivityEventTypes.NetworkOffline, _status.CurrentSessionId,
            new Dictionary<string, object?> { ["offlineSince"] = reachable ? null : DateTimeOffset.UtcNow.ToString("O") }));
    }
}
