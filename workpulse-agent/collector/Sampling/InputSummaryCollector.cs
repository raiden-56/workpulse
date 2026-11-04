using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using WorkPulse.Collector.Native;
using WorkPulse.Collector.Policy;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Collector.Sampling;

/// <summary>
/// Aggregate input signal per 60 s: number of keyboard events, number of mouse events, coarse
/// mouse travel distance and a regularity score of the gaps between events (used server-side to
/// spot machine-generated "activity"). The hooks only count: key codes are never read, and the
/// pointer position is used solely to add up distance between consecutive moves.
/// </summary>
[SupportedOSPlatform("windows")]
internal sealed class InputSummaryCollector
{
    private const int IntervalSeconds = 60;
    private const int RegularityWindow = 64;

    private readonly PolicyState _policy;
    private readonly string _sessionId;
    private readonly Func<ActivityEvent, Task> _emit;
    private readonly object _lock = new();
    private readonly User32.HookProc _keyboardProc;
    private readonly User32.HookProc _mouseProc;
    private IntPtr _keyboardHook;
    private IntPtr _mouseHook;
    private long _keyboardEvents;
    private long _mouseEvents;
    private double _mouseDistance;
    private bool _hasLastPoint;
    private int _lastX;
    private int _lastY;
    private uint _lastEventTick;
    private readonly double[] _intervals = new double[RegularityWindow];
    private int _intervalCount;
    private int _intervalIndex;

    public InputSummaryCollector(PolicyState policy, string sessionId, Func<ActivityEvent, Task> emit)
    {
        _policy = policy;
        _sessionId = sessionId;
        _emit = emit;
        // Keep the delegates referenced for the lifetime of the hooks (otherwise the GC collects them).
        _keyboardProc = KeyboardHook;
        _mouseProc = MouseHook;
    }

    public bool HooksInstalled => _keyboardHook != IntPtr.Zero && _mouseHook != IntPtr.Zero;

    /// <summary>Must be called on the thread that runs the message loop (hooks need it).</summary>
    public void InstallHooks()
    {
        var module = User32.GetModuleHandleW(null);
        _keyboardHook = User32.SetWindowsHookExW(User32.WH_KEYBOARD_LL, _keyboardProc, module, 0);
        _mouseHook = User32.SetWindowsHookExW(User32.WH_MOUSE_LL, _mouseProc, module, 0);
        if (!HooksInstalled)
        {
            CollectorLog.Warn("Input hooks could not be installed (error " + Marshal.GetLastWin32Error() + "); INPUT_SUMMARY disabled");
        }
    }

    public void RemoveHooks()
    {
        if (_keyboardHook != IntPtr.Zero) { User32.UnhookWindowsHookEx(_keyboardHook); _keyboardHook = IntPtr.Zero; }
        if (_mouseHook != IntPtr.Zero) { User32.UnhookWindowsHookEx(_mouseHook); _mouseHook = IntPtr.Zero; }
    }

    /// <summary>Emits the aggregate for the last interval when the policy allows it and there was input.</summary>
    public async Task TickAsync()
    {
        long keyboard;
        long mouse;
        double distance;
        double regularity;
        lock (_lock)
        {
            keyboard = _keyboardEvents;
            mouse = _mouseEvents;
            distance = _mouseDistance;
            regularity = Regularity();
            _keyboardEvents = 0;
            _mouseEvents = 0;
            _mouseDistance = 0;
            _intervalCount = 0;
            _intervalIndex = 0;
        }
        if (!_policy.CollectInputSummary || (keyboard == 0 && mouse == 0))
        {
            return;
        }
        await _emit(ActivityEvent.Of(ActivityEventTypes.InputSummary, _sessionId, new Dictionary<string, object?>
        {
            ["intervalSeconds"] = IntervalSeconds,
            ["keyboardEvents"] = keyboard,
            ["mouseEvents"] = mouse,
            ["mouseDistancePx"] = (long)Math.Round(distance),
            ["regularityScore"] = Math.Round(regularity, 3),
        }));
    }

    private IntPtr KeyboardHook(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode == User32.HC_ACTION)
        {
            var msg = wParam.ToInt64();
            if (msg == User32.WM_KEYDOWN || msg == User32.WM_SYSKEYDOWN)
            {
                lock (_lock)
                {
                    _keyboardEvents++; // the key itself (lParam) is deliberately never inspected
                    RecordInterval();
                }
            }
        }
        return User32.CallNextHookEx(_keyboardHook, nCode, wParam, lParam);
    }

    private IntPtr MouseHook(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode == User32.HC_ACTION)
        {
            var msg = wParam.ToInt64();
            if (msg == User32.WM_MOUSEMOVE)
            {
                var data = Marshal.PtrToStructure<User32.MSLLHOOKSTRUCT>(lParam);
                lock (_lock)
                {
                    if (_hasLastPoint)
                    {
                        var dx = data.pt.x - _lastX;
                        var dy = data.pt.y - _lastY;
                        _mouseDistance += Math.Sqrt((double)dx * dx + (double)dy * dy);
                    }
                    _lastX = data.pt.x;
                    _lastY = data.pt.y;
                    _hasLastPoint = true;
                }
            }
            else if (msg is User32.WM_LBUTTONDOWN or User32.WM_RBUTTONDOWN or User32.WM_MBUTTONDOWN or User32.WM_XBUTTONDOWN
                     or User32.WM_MOUSEWHEEL or User32.WM_MOUSEHWHEEL)
            {
                lock (_lock)
                {
                    _mouseEvents++;
                    RecordInterval();
                }
            }
        }
        return User32.CallNextHookEx(_mouseHook, nCode, wParam, lParam);
    }

    private void RecordInterval()
    {
        var now = unchecked((uint)Environment.TickCount64);
        if (_lastEventTick != 0)
        {
            var gap = unchecked(now - _lastEventTick);
            if (gap > 0 && gap < 60_000)
            {
                _intervals[_intervalIndex] = gap;
                _intervalIndex = (_intervalIndex + 1) % RegularityWindow;
                if (_intervalCount < RegularityWindow) { _intervalCount++; }
            }
        }
        _lastEventTick = now;
    }

    /// <summary>0 = human-like variability, 1 = metronome-like gaps between inputs.</summary>
    private double Regularity()
    {
        if (_intervalCount < 8)
        {
            return 0;
        }
        double sum = 0;
        for (var i = 0; i < _intervalCount; i++) { sum += _intervals[i]; }
        var mean = sum / _intervalCount;
        if (mean <= 0) { return 0; }
        double variance = 0;
        for (var i = 0; i < _intervalCount; i++) { variance += (_intervals[i] - mean) * (_intervals[i] - mean); }
        var stddev = Math.Sqrt(variance / _intervalCount);
        return Math.Clamp(1 - stddev / mean, 0, 1);
    }
}
