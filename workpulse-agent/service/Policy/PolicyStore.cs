using System.Runtime.Versioning;
using System.Text.Json;
using WorkPulse.Service.Storage;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Policy;

/// <summary>Effective monitoring policy, cached on disk so the agent behaves consistently while offline.</summary>
[SupportedOSPlatform("windows")]
public sealed class PolicyStore
{
    private readonly AgentPaths _paths;
    private readonly ILogger<PolicyStore> _logger;
    private readonly object _lock = new();
    private EffectivePolicy? _current;

    public event Action<EffectivePolicy>? Changed;

    public PolicyStore(AgentPaths paths, ILogger<PolicyStore> logger)
    {
        _paths = paths;
        _logger = logger;
        Load();
    }

    public EffectivePolicy? Current { get { lock (_lock) { return _current; } } }

    public int? Version => Current?.Version;

    public void Apply(EffectivePolicy policy)
    {
        bool changed;
        lock (_lock)
        {
            changed = _current == null || _current.Version != policy.Version || _current.PolicyId != policy.PolicyId;
            _current = policy;
            var tmp = _paths.PolicyFile + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(policy, IpcProtocol.Json));
            File.Move(tmp, _paths.PolicyFile, overwrite: true);
        }
        if (changed)
        {
            _logger.LogInformation("Policy applied: {Name} v{Version} ({ResolvedFrom})", policy.Name, policy.Version, policy.ResolvedFrom);
            Changed?.Invoke(policy);
        }
    }

    /// <summary>True when the local time is inside one of the policy's collection windows (or no windows are configured).</summary>
    public bool IsInsideCollectionWindow(DateTimeOffset now)
    {
        var policy = Current;
        if (policy == null || policy.CollectionWindows.Count == 0)
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
            catch (TimeZoneNotFoundException)
            {
                tz = TimeZoneInfo.Local;
            }
            var local = TimeZoneInfo.ConvertTime(now, tz);
            var isoDay = (int)local.DayOfWeek == 0 ? 7 : (int)local.DayOfWeek;
            if (window.Days.Count > 0 && !window.Days.Contains(isoDay))
            {
                continue;
            }
            if (TimeOnly.TryParse(window.From, out var from) && TimeOnly.TryParse(window.To, out var to))
            {
                var t = TimeOnly.FromDateTime(local.DateTime);
                if (from <= to ? (t >= from && t <= to) : (t >= from || t <= to))
                {
                    return true;
                }
            }
        }
        return false;
    }

    private void Load()
    {
        try
        {
            if (File.Exists(_paths.PolicyFile))
            {
                _current = JsonSerializer.Deserialize<EffectivePolicy>(File.ReadAllText(_paths.PolicyFile), IpcProtocol.Json);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cached policy unreadable; it will be refreshed from the backend");
        }
    }
}
