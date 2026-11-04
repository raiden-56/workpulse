using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using WorkPulse.Service.Config;
using WorkPulse.Service.Native;

namespace WorkPulse.Service.Session;

/// <summary>
/// Starts WorkPulse.Collector.exe inside the interactive user's session (the service itself runs
/// in Session 0 and must never try to touch the user's desktop). Uses the user's own token so the
/// collector runs with the user's privileges, not as SYSTEM.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class CollectorLauncher
{
    private readonly AgentOptions _options;
    private readonly ILogger<CollectorLauncher> _logger;
    private Process? _process;

    public uint? SessionId { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }

    public CollectorLauncher(AgentOptions options, ILogger<CollectorLauncher> logger)
    {
        _options = options;
        _logger = logger;
    }

    public bool IsRunning
    {
        get
        {
            try { return _process is { HasExited: false }; }
            catch { return false; }
        }
    }

    public string ResolveExecutable()
    {
        var configured = _options.CollectorExecutable;
        if (Path.IsPathRooted(configured))
        {
            return configured;
        }
        var baseDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, configured),
            Path.Combine(baseDir, "collector", configured),
            Path.Combine(baseDir, "..", "collector", configured),
        };
        return candidates.FirstOrDefault(File.Exists) ?? candidates[0];
    }

    public bool Start(uint sessionId)
    {
        Stop();
        var exe = ResolveExecutable();
        if (!File.Exists(exe))
        {
            _logger.LogError("Collector executable not found at {Path}", exe);
            return false;
        }
        var token = IntPtr.Zero;
        var environment = IntPtr.Zero;
        var pi = new Wts.PROCESS_INFORMATION();
        try
        {
            if (!Wts.WTSQueryUserToken(sessionId, out token))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "WTSQueryUserToken failed");
            }
            if (!Wts.CreateEnvironmentBlock(out environment, token, false))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateEnvironmentBlock failed");
            }
            var si = new Wts.STARTUPINFOW
            {
                cb = Marshal.SizeOf<Wts.STARTUPINFOW>(),
                lpDesktop = @"winsta0\default",
            };
            var commandLine = $"\"{exe}\" --session {sessionId} --pipe {Shared.Ipc.IpcProtocol.PipeName}";
            var flags = Wts.CREATE_UNICODE_ENVIRONMENT | Wts.CREATE_NO_WINDOW | Wts.CREATE_NEW_PROCESS_GROUP;
            if (!Wts.CreateProcessAsUserW(token, null, commandLine, IntPtr.Zero, IntPtr.Zero, false, flags, environment,
                    Path.GetDirectoryName(exe), ref si, out pi))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcessAsUser failed");
            }
            _process = Process.GetProcessById(pi.dwProcessId);
            SessionId = sessionId;
            StartedAt = DateTimeOffset.UtcNow;
            _logger.LogInformation("Collector started in session {Session} (pid {Pid})", sessionId, pi.dwProcessId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not start the collector in session {Session}", sessionId);
            return false;
        }
        finally
        {
            if (pi.hThread != IntPtr.Zero) { Wts.CloseHandle(pi.hThread); }
            if (pi.hProcess != IntPtr.Zero) { Wts.CloseHandle(pi.hProcess); }
            if (environment != IntPtr.Zero) { Wts.DestroyEnvironmentBlock(environment); }
            if (token != IntPtr.Zero) { Wts.CloseHandle(token); }
        }
    }

    public void Stop()
    {
        try
        {
            if (_process is { HasExited: false })
            {
                _process.Kill(entireProcessTree: true);
                _process.WaitForExit(3000);
                _logger.LogInformation("Collector stopped");
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Collector stop");
        }
        finally
        {
            _process?.Dispose();
            _process = null;
            SessionId = null;
        }
    }
}
