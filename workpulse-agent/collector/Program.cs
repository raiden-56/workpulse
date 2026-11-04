using System.Reflection;
using System.Runtime.Versioning;
using WorkPulse.Collector;
using WorkPulse.Collector.Pipe;
using WorkPulse.Collector.Policy;
using WorkPulse.Collector.Sampling;
using WorkPulse.Collector.Session;
using WorkPulse.Shared.Ipc;

[assembly: SupportedOSPlatform("windows")]

// WorkPulse Collector – runs in the signed-in user's session, launched by WorkPulse.Service.
// Collects ONLY: foreground application identity + duration, idle periods, session lock/unlock/
// sign-out, and aggregate input counts. It never reads keystrokes, clipboard, screen content,
// URLs, messages or files, and it never shows UI (the Electron app is the visible agent).
//
// Usage: WorkPulse.Collector.exe [--session <id>] [--pipe <name>]

var pipeName = IpcProtocol.PipeName;
for (var i = 0; i < args.Length - 1; i++)
{
    if (args[i] == "--pipe") { pipeName = args[i + 1]; }
}
var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";
var sessionId = Guid.NewGuid().ToString(); // one logon session of this collector run
using var shutdown = new CancellationTokenSource();
var shutdownReason = "UNKNOWN";
CollectorLog.Info($"Collector {version} starting (session {sessionId})");

var policy = new PolicyState();
await using var pipe = new PipeClient(pipeName, sessionId, version);
pipe.PolicyReceived += policy.Apply;

Func<ActivityEvent, Task> emit = evt => pipe.SendEventAsync(evt);

var sampler = new ForegroundSampler(policy, sessionId, emit);
var idle = new IdleDetector(policy, sampler, sessionId, emit);
var input = new InputSummaryCollector(policy, sessionId, emit);
var locked = false;
var outsideWindow = false;
var gate = new SemaphoreSlim(1, 1);

async Task OnLockAsync()
{
    await gate.WaitAsync();
    try
    {
        if (locked) { return; }
        locked = true;
        await idle.SuspendAsync();
        await sampler.PauseAsync("locked");
        await emit(ActivityEvent.Of(ActivityEventTypes.SessionLock, sessionId));
        CollectorLog.Info("Session locked");
    }
    finally { gate.Release(); }
}

async Task OnUnlockAsync()
{
    await gate.WaitAsync();
    try
    {
        if (!locked) { return; }
        locked = false;
        await emit(ActivityEvent.Of(ActivityEventTypes.SessionUnlock, sessionId));
        sampler.Resume("locked");
        if (!outsideWindow) { idle.Resume(); }
        CollectorLog.Info("Session unlocked");
    }
    finally { gate.Release(); }
}

void RequestShutdown(string reason)
{
    shutdownReason = reason;
    shutdown.Cancel();
}

using var watcher = new SessionWatcher(
    onLock: () => _ = OnLockAsync(),
    onUnlock: () => _ = OnUnlockAsync(),
    onSessionEnd: RequestShutdown,
    onLoopStarted: input.InstallHooks,
    onLoopStopping: input.RemoveHooks);

AppDomain.CurrentDomain.ProcessExit += (_, _) => RequestShutdown("PROCESS_EXIT");
Console.CancelKeyPress += (_, e) => { e.Cancel = true; RequestShutdown("USER"); };

pipe.Start();
watcher.Start();

// Wait briefly for the service and its policy; proceed with built-in defaults otherwise.
var waitUntil = DateTimeOffset.UtcNow.AddSeconds(15);
while (!pipe.IsConnected && DateTimeOffset.UtcNow < waitUntil && !shutdown.IsCancellationRequested)
{
    await Task.Delay(200);
}
if (pipe.IsConnected)
{
    var policyUntil = DateTimeOffset.UtcNow.AddSeconds(5);
    while (policy.Current.Version == 0 && DateTimeOffset.UtcNow < policyUntil) { await Task.Delay(100); }
}

await emit(ActivityEvent.Of(ActivityEventTypes.SessionStart, sessionId, new Dictionary<string, object?>
{
    ["windowsUser"] = Environment.UserDomainName + "\\" + Environment.UserName,
    ["sessionKind"] = Environment.GetEnvironmentVariable("SESSIONNAME")?.StartsWith("RDP", StringComparison.OrdinalIgnoreCase) == true ? "RDP" : "CONSOLE",
}));

var lastHeartbeat = DateTimeOffset.UtcNow;
var lastInputSummary = DateTimeOffset.UtcNow;
var lastSample = DateTimeOffset.MinValue;
var lastIdleCheck = DateTimeOffset.MinValue;

try
{
    while (!shutdown.IsCancellationRequested)
    {
        await Task.Delay(1000, shutdown.Token);
        var now = DateTimeOffset.UtcNow;

        if (pipe.IsRevoked)
        {
            RequestShutdown("REVOKED");
            break;
        }

        // Collection window: outside it only session state is tracked.
        var inside = policy.IsInsideCollectionWindow(now);
        if (!inside && !outsideWindow)
        {
            outsideWindow = true;
            await idle.SuspendAsync();
            await sampler.PauseAsync("window");
            CollectorLog.Info("Outside collection window: sampling paused");
        }
        else if (inside && outsideWindow)
        {
            outsideWindow = false;
            sampler.Resume("window");
            if (!locked) { idle.Resume(); }
            CollectorLog.Info("Inside collection window: sampling resumed");
        }

        if (!locked && !outsideWindow)
        {
            if ((now - lastIdleCheck).TotalSeconds >= 5)
            {
                lastIdleCheck = now;
                await idle.TickAsync();
            }
            if ((now - lastSample).TotalSeconds >= policy.SamplingIntervalSeconds)
            {
                lastSample = now;
                await sampler.TickAsync();
            }
            if ((now - lastInputSummary).TotalSeconds >= 60)
            {
                lastInputSummary = now;
                await input.TickAsync();
            }
        }

        if ((now - lastHeartbeat).TotalSeconds >= 60)
        {
            lastHeartbeat = now;
            await emit(ActivityEvent.Of(ActivityEventTypes.AgentHeartbeat, sessionId, new Dictionary<string, object?>
            {
                ["queueDepth"] = pipe.Unacked,
                ["collectorConnected"] = pipe.IsConnected,
                ["locked"] = locked,
                ["insideWindow"] = !outsideWindow,
            }));
        }
    }
}
catch (OperationCanceledException)
{
    // shutting down
}

CollectorLog.Info("Collector stopping: " + shutdownReason);
await sampler.FlushAsync();
if (shutdownReason != "REVOKED")
{
    await emit(ActivityEvent.Of(ActivityEventTypes.SessionEnd, sessionId, new Dictionary<string, object?>
    {
        ["reason"] = shutdownReason is "LOGOFF" or "SHUTDOWN" or "DISCONNECT" ? shutdownReason : "UNKNOWN",
    }));
}
await pipe.FlushAsync(TimeSpan.FromSeconds(3));
watcher.Stop();
CollectorLog.Info("Collector stopped");
return 0;
