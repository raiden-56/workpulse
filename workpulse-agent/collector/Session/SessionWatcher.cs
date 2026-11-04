using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using WorkPulse.Collector.Native;

namespace WorkPulse.Collector.Session;

/// <summary>
/// Owns the collector's only Win32 message loop (a message-only window on a dedicated thread) and
/// turns WTS session notifications into callbacks: lock, unlock, logoff/disconnect, shutdown.
/// Low-level hooks are installed on this same thread because they require a message loop.
/// </summary>
[SupportedOSPlatform("windows")]
internal sealed class SessionWatcher : IDisposable
{
    private const string ClassName = "WorkPulse.Collector.MessageWindow";

    private readonly Action _onLock;
    private readonly Action _onUnlock;
    private readonly Action<string> _onSessionEnd;
    private readonly Action? _onLoopStarted;
    private readonly Action? _onLoopStopping;
    private readonly User32.WndProc _wndProc; // keep alive
    private Thread? _thread;
    private uint _threadId;
    private IntPtr _hwnd;
    private readonly ManualResetEventSlim _started = new();

    public SessionWatcher(Action onLock, Action onUnlock, Action<string> onSessionEnd, Action? onLoopStarted = null, Action? onLoopStopping = null)
    {
        _onLock = onLock;
        _onUnlock = onUnlock;
        _onSessionEnd = onSessionEnd;
        _onLoopStarted = onLoopStarted;
        _onLoopStopping = onLoopStopping;
        _wndProc = WindowProc;
    }

    public void Start()
    {
        _thread = new Thread(MessageLoop) { IsBackground = true, Name = "WorkPulse message loop" };
        _thread.SetApartmentState(ApartmentState.STA);
        _thread.Start();
        _started.Wait(TimeSpan.FromSeconds(5));
    }

    public void Stop()
    {
        if (_threadId != 0)
        {
            User32.PostThreadMessageW(_threadId, User32.WM_QUIT, IntPtr.Zero, IntPtr.Zero);
        }
        _thread?.Join(TimeSpan.FromSeconds(3));
    }

    private void MessageLoop()
    {
        _threadId = User32.GetCurrentThreadId();
        var instance = User32.GetModuleHandleW(null);
        var wc = new User32.WNDCLASSEXW
        {
            cbSize = (uint)Marshal.SizeOf<User32.WNDCLASSEXW>(),
            lpfnWndProc = _wndProc,
            hInstance = instance,
            lpszClassName = ClassName,
        };
        if (User32.RegisterClassExW(ref wc) == 0)
        {
            var error = Marshal.GetLastWin32Error();
            if (error != 1410) // ERROR_CLASS_ALREADY_EXISTS
            {
                CollectorLog.Error("RegisterClassEx failed: " + error);
                _started.Set();
                return;
            }
        }
        _hwnd = User32.CreateWindowExW(0, ClassName, "WorkPulse Collector", 0, 0, 0, 0, 0, User32.HWND_MESSAGE, IntPtr.Zero, instance, IntPtr.Zero);
        if (_hwnd == IntPtr.Zero)
        {
            CollectorLog.Error("CreateWindowEx failed: " + Marshal.GetLastWin32Error());
            _started.Set();
            return;
        }
        if (!User32.WTSRegisterSessionNotification(_hwnd, User32.NOTIFY_FOR_THIS_SESSION))
        {
            CollectorLog.Warn("WTSRegisterSessionNotification failed: " + Marshal.GetLastWin32Error());
        }
        _onLoopStarted?.Invoke();
        _started.Set();

        while (User32.GetMessageW(out var msg, IntPtr.Zero, 0, 0) > 0)
        {
            User32.TranslateMessage(ref msg);
            User32.DispatchMessageW(ref msg);
        }

        _onLoopStopping?.Invoke();
        User32.WTSUnRegisterSessionNotification(_hwnd);
        User32.DestroyWindow(_hwnd);
        _hwnd = IntPtr.Zero;
    }

    private IntPtr WindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case User32.WM_WTSSESSION_CHANGE:
                switch (wParam.ToInt32())
                {
                    case User32.WTS_SESSION_LOCK:
                        Safe(_onLock);
                        break;
                    case User32.WTS_SESSION_UNLOCK:
                        Safe(_onUnlock);
                        break;
                    case User32.WTS_SESSION_LOGOFF:
                        Safe(() => _onSessionEnd("LOGOFF"));
                        break;
                    case User32.WTS_CONSOLE_DISCONNECT:
                    case User32.WTS_REMOTE_DISCONNECT:
                        Safe(() => _onSessionEnd("DISCONNECT"));
                        break;
                }
                return IntPtr.Zero;
            case User32.WM_QUERYENDSESSION:
                Safe(() => _onSessionEnd("SHUTDOWN"));
                return new IntPtr(1);
            case User32.WM_ENDSESSION:
                if (wParam != IntPtr.Zero)
                {
                    Safe(() => _onSessionEnd("SHUTDOWN"));
                }
                return IntPtr.Zero;
            default:
                return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
        }
    }

    private static void Safe(Action action)
    {
        try
        {
            action();
        }
        catch (Exception ex)
        {
            CollectorLog.Error("Session callback failed", ex);
        }
    }

    public void Dispose() => Stop();
}
