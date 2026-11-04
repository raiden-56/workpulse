using WorkPulse.Shared.Ipc;

namespace WorkPulse.Collector.Policy;

/// <summary>
/// Thread-safe holder of the effective policy plus the collection-window rule: outside the
/// configured windows the collector keeps tracking session state only (sign-in / lock) and
/// samples nothing else.
/// </summary>
internal sealed class PolicyState
{
    private readonly object _lock = new();
    private EffectivePolicy _policy = Defaults();

    public event Action<EffectivePolicy>? Changed;

    public EffectivePolicy Current { get { lock (_lock) { return _policy; } } }

    public int SamplingIntervalSeconds => Math.Clamp(Current.SamplingIntervalSeconds, 2, 120);
    public int IdleThresholdSeconds => Math.Clamp(Current.IdleThresholdSeconds, 30, 3600);
    public bool CollectInputSummary => Current.CollectInputSummary;
    public bool CollectWindowTitles => Current.CollectWindowTitles;

    public void Apply(EffectivePolicy policy)
    {
        lock (_lock) { _policy = policy; }
        CollectorLog.Info($"Policy applied: {policy.Name} v{policy.Version} (sampling {policy.SamplingIntervalSeconds}s, idle {policy.IdleThresholdSeconds}s, windows {policy.CollectionWindows.Count})");
        Changed?.Invoke(policy);
    }

    public bool IsExcluded(string processName)
    {
        var policy = Current;
        foreach (var exclusion in policy.SensitiveAppExclusions)
        {
            // "outlook.exe:personal" style qualifiers match on the process part only
            var name = exclusion.Split(':')[0].Trim();
            if (name.Length > 0 && string.Equals(name, processName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    public bool IsInsideCollectionWindow(DateTimeOffset now) => CollectionWindow.IsInside(Current, now);

    private static EffectivePolicy Defaults() => new()
    {
        Name = "Built-in defaults (awaiting policy)",
        Version = 0,
        ResolvedFrom = "BUILT_IN",
        SamplingIntervalSeconds = 10,
        IdleThresholdSeconds = 300,
        CollectInputSummary = false,
        CollectWindowTitles = false,
    };
}

internal static class CollectionWindow
{
    /// <summary>True when <paramref name="now"/> falls inside one of the policy's windows, or the policy has none.</summary>
    public static bool IsInside(EffectivePolicy policy, DateTimeOffset now)
    {
        if (policy.CollectionWindows.Count == 0)
        {
            return true;
        }
        foreach (var window in policy.CollectionWindows)
        {
            TimeZoneInfo tz;
            try
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(window.Tz) ? "UTC" : window.Tz);
            }
            catch (Exception)
            {
                tz = TimeZoneInfo.Local;
            }
            var local = TimeZoneInfo.ConvertTime(now, tz);
            var isoDay = local.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)local.DayOfWeek;
            if (window.Days.Count > 0 && !window.Days.Contains(isoDay))
            {
                continue;
            }
            if (!TimeOnly.TryParse(window.From, out var from) || !TimeOnly.TryParse(window.To, out var to))
            {
                continue;
            }
            var t = TimeOnly.FromDateTime(local.DateTime);
            var inside = from <= to ? (t >= from && t <= to) : (t >= from || t <= to);
            if (inside)
            {
                return true;
            }
        }
        return false;
    }
}
