using System.Diagnostics;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using WorkPulse.Collector.Native;
using WorkPulse.Collector.Policy;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Collector.Sampling;

/// <summary>
/// Samples the foreground application every policy interval and coalesces consecutive samples
/// of the same process into one FOREGROUND_APP event carrying <c>durationMs</c>. A running sample
/// is flushed at most every 60 s so the backend's live view stays fresh.
///
/// Collected: process file name (lower-case), friendly name from the executable's version info,
/// pid, duration. Never collected: window text (unless the policy enables titles, in which case
/// only a salted SHA-256 hash is sent), URLs, document names, screen content.
/// </summary>
[SupportedOSPlatform("windows")]
internal sealed class ForegroundSampler
{
    private static readonly TimeSpan MaxCoalesce = TimeSpan.FromSeconds(60);

    private readonly PolicyState _policy;
    private readonly Func<ActivityEvent, Task> _emit;
    private readonly string _sessionId;
    private readonly Dictionary<string, string> _appNames = new(StringComparer.OrdinalIgnoreCase);
    private readonly byte[] _titleSalt = RandomNumberGenerator.GetBytes(16);
    private readonly object _lock = new();
    private Sample? _current;
    private volatile bool _paused;
    private string _pauseReason = "";

    private sealed class Sample
    {
        public required string ProcessName { get; init; }
        public required string AppName { get; init; }
        public required uint Pid { get; init; }
        public string? TitleHash { get; init; }
        public DateTimeOffset StartedAt { get; init; } = DateTimeOffset.UtcNow;
        public DateTimeOffset LastSeenAt { get; set; } = DateTimeOffset.UtcNow;
    }

    public ForegroundSampler(PolicyState policy, string sessionId, Func<ActivityEvent, Task> emit)
    {
        _policy = policy;
        _sessionId = sessionId;
        _emit = emit;
    }

    public bool IsPaused => _paused;

    /// <summary>Pauses sampling (idle, locked, break, outside window) and flushes the open sample.</summary>
    public async Task PauseAsync(string reason)
    {
        _paused = true;
        _pauseReason = reason;
        await FlushAsync();
    }

    public void Resume(string reason)
    {
        if (_paused && _pauseReason == reason)
        {
            _paused = false;
        }
        else if (_paused && reason == "*")
        {
            _paused = false;
        }
    }

    public string PauseReason => _pauseReason;

    public async Task TickAsync()
    {
        if (_paused)
        {
            return;
        }
        var now = DateTimeOffset.UtcNow;
        var hwnd = User32.GetForegroundWindow();
        if (hwnd == IntPtr.Zero)
        {
            await FlushAsync();
            return;
        }
        User32.GetWindowThreadProcessId(hwnd, out var pid);
        var path = pid == 0 ? null : User32.ProcessImagePath(pid);
        var processName = path == null ? null : Path.GetFileName(path).ToLowerInvariant();
        if (string.IsNullOrEmpty(processName) || _policy.IsExcluded(processName))
        {
            await FlushAsync(); // excluded or unknown: no sample at all
            return;
        }
        var appName = FriendlyName(path!, processName);
        string? titleHash = null;
        if (_policy.CollectWindowTitles)
        {
            titleHash = HashTitle(hwnd);
        }

        Sample? toEmit = null;
        lock (_lock)
        {
            if (_current != null && _current.ProcessName == processName && _current.TitleHash == titleHash
                && now - _current.StartedAt < MaxCoalesce)
            {
                _current.LastSeenAt = now;
                return;
            }
            toEmit = _current;
            _current = new Sample { ProcessName = processName, AppName = appName, Pid = pid, TitleHash = titleHash, StartedAt = now, LastSeenAt = now };
        }
        if (toEmit != null)
        {
            await EmitAsync(toEmit, now);
        }
    }

    /// <summary>Emits the open sample (if any) with its duration so far.</summary>
    public async Task FlushAsync()
    {
        Sample? toEmit;
        lock (_lock)
        {
            toEmit = _current;
            _current = null;
        }
        if (toEmit != null)
        {
            await EmitAsync(toEmit, DateTimeOffset.UtcNow);
        }
    }

    private async Task EmitAsync(Sample sample, DateTimeOffset until)
    {
        var end = sample.LastSeenAt > until ? sample.LastSeenAt : until;
        var durationMs = (long)Math.Max(_policy.SamplingIntervalSeconds * 1000.0, (end - sample.StartedAt).TotalMilliseconds);
        var payload = new Dictionary<string, object?>
        {
            ["processName"] = sample.ProcessName,
            ["appName"] = sample.AppName,
            ["pid"] = sample.Pid,
            ["durationMs"] = durationMs,
        };
        if (sample.TitleHash != null)
        {
            payload["windowTitleHash"] = sample.TitleHash;
        }
        var evt = ActivityEvent.Of(ActivityEventTypes.ForegroundApp, _sessionId, payload);
        evt.OccurredAt = sample.StartedAt;
        await _emit(evt);
    }

    private string FriendlyName(string path, string processName)
    {
        if (_appNames.TryGetValue(path, out var cached))
        {
            return cached;
        }
        string name;
        try
        {
            var info = FileVersionInfo.GetVersionInfo(path);
            name = string.IsNullOrWhiteSpace(info.FileDescription) ? Path.GetFileNameWithoutExtension(processName) : info.FileDescription.Trim();
        }
        catch
        {
            name = Path.GetFileNameWithoutExtension(processName);
        }
        if (name.Length > 160)
        {
            name = name[..160];
        }
        _appNames[path] = name;
        return name;
    }

    /// <summary>Salted SHA-256 of the window title; the title text itself never leaves this method.</summary>
    private string? HashTitle(IntPtr hwnd)
    {
        var buffer = new StringBuilder(512);
        var length = User32.GetWindowTextW(hwnd, buffer, buffer.Capacity);
        if (length <= 0)
        {
            return null;
        }
        var bytes = Encoding.UTF8.GetBytes(buffer.ToString(0, length));
        var salted = new byte[_titleSalt.Length + bytes.Length];
        _titleSalt.CopyTo(salted, 0);
        bytes.CopyTo(salted, _titleSalt.Length);
        return Convert.ToHexString(SHA256.HashData(salted)).ToLowerInvariant()[..32];
    }
}
