using System.Runtime.Versioning;
using WorkPulse.Service.Config;
using WorkPulse.Service.Native;
using WorkPulse.Service.Registration;
using WorkPulse.Service.Status;

namespace WorkPulse.Service.Session;

/// <summary>
/// Keeps exactly one collector running in the active interactive session while the device is
/// registered and not revoked; restarts it after a crash (with a short delay) and stops it on logoff.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class CollectorSupervisor : BackgroundService
{
    private readonly CollectorLauncher _launcher;
    private readonly DeviceState _device;
    private readonly StatusAggregator _status;
    private readonly AgentOptions _options;
    private readonly ILogger<CollectorSupervisor> _logger;
    private DateTimeOffset _lastStartAttempt = DateTimeOffset.MinValue;

    public CollectorSupervisor(CollectorLauncher launcher, DeviceState device, StatusAggregator status, AgentOptions options, ILogger<CollectorSupervisor> logger)
    {
        _launcher = launcher;
        _device = device;
        _status = status;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var poll = TimeSpan.FromSeconds(Math.Max(3, _options.CollectorSessionPollSeconds));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                Reconcile();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Collector supervision failed");
            }
            try
            {
                await Task.Delay(poll, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
        _launcher.Stop();
    }

    private void Reconcile()
    {
        var shouldRun = _device.IsRegistered && !_device.IsRevoked;
        var sessions = Wts.ActiveSessions();
        var target = sessions.Count > 0 ? sessions[0] : (uint?)null;

        if (!shouldRun || target == null)
        {
            if (_launcher.IsRunning)
            {
                _logger.LogInformation("Stopping collector: {Reason}", shouldRun ? "no active user session" : "device not registered or revoked");
                _launcher.Stop();
                _status.CollectorConnected = false;
                _status.NotifyChanged();
            }
            return;
        }

        if (_launcher.IsRunning && _launcher.SessionId == target)
        {
            return;
        }

        if (DateTimeOffset.UtcNow - _lastStartAttempt < TimeSpan.FromSeconds(10))
        {
            return; // crash loop protection
        }
        _lastStartAttempt = DateTimeOffset.UtcNow;
        if (_launcher.IsRunning)
        {
            _logger.LogInformation("Active session changed to {Session}; restarting collector", target);
        }
        _launcher.Start(target.Value);
    }
}
