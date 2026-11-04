using System.Runtime.Versioning;
using WorkPulse.Collector.Native;
using WorkPulse.Collector.Policy;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Collector.Sampling;

/// <summary>
/// IDLE_START / IDLE_END from GetLastInputInfo against the policy's idle threshold.
/// Only the fact that no input happened is recorded, never what the input was.
/// </summary>
[SupportedOSPlatform("windows")]
internal sealed class IdleDetector
{
    private readonly PolicyState _policy;
    private readonly ForegroundSampler _sampler;
    private readonly string _sessionId;
    private readonly Func<ActivityEvent, Task> _emit;
    private bool _idle;
    private DateTimeOffset _idleSince;
    private bool _suspended;

    public IdleDetector(PolicyState policy, ForegroundSampler sampler, string sessionId, Func<ActivityEvent, Task> emit)
    {
        _policy = policy;
        _sampler = sampler;
        _sessionId = sessionId;
        _emit = emit;
    }

    public bool IsIdle => _idle;

    /// <summary>Locked / outside-window: idle tracking is meaningless, suspend it (closing an open idle period).</summary>
    public async Task SuspendAsync()
    {
        _suspended = true;
        await EndIdleAsync();
    }

    public void Resume() => _suspended = false;

    public async Task TickAsync()
    {
        if (_suspended)
        {
            return;
        }
        var sinceInputMs = User32.MillisecondsSinceLastInput();
        var thresholdMs = (uint)_policy.IdleThresholdSeconds * 1000u;
        if (!_idle && sinceInputMs >= thresholdMs)
        {
            _idle = true;
            _idleSince = DateTimeOffset.UtcNow.AddMilliseconds(-sinceInputMs);
            await _sampler.PauseAsync("idle");
            await _emit(ActivityEvent.Of(ActivityEventTypes.IdleStart, _sessionId, new Dictionary<string, object?>
            {
                ["lastInputAt"] = _idleSince.ToString("O"),
                ["thresholdSeconds"] = _policy.IdleThresholdSeconds,
            }));
        }
        else if (_idle && sinceInputMs < thresholdMs)
        {
            await EndIdleAsync();
        }
    }

    private async Task EndIdleAsync()
    {
        if (!_idle)
        {
            return;
        }
        _idle = false;
        var idleSeconds = (long)(DateTimeOffset.UtcNow - _idleSince).TotalSeconds;
        await _emit(ActivityEvent.Of(ActivityEventTypes.IdleEnd, _sessionId, new Dictionary<string, object?> { ["idleSeconds"] = idleSeconds }));
        _sampler.Resume("idle");
    }
}
