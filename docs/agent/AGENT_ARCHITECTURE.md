# WorkPulse – Windows Desktop Agent Architecture

The agent is a **visible, employee-facing** application. It always shows its monitoring
status, what is collected and why, and it never runs hidden.

```
workpulse-agent/
├── electron/      Electron 38 + TypeScript UI (main, preload, renderer)
├── collector/     C# .NET 8 – WorkPulse.Collector (runs in the user session)
├── service/       C# .NET 8 – WorkPulse.Service (Windows Service, Session 0)
├── shared/        IPC message contracts (JSON schema + C# records + TS types)
└── installer/     Inno Setup / MSIX packaging notes and signing checklist
```

## Components

| Component | Runs as | Responsibilities |
|---|---|---|
| **WorkPulse.Service** | Windows Service, `LocalSystem`, Session 0 | Named-pipe server; encrypted local event queue; batch sync with back-off; policy sync; heartbeat; health; update coordination; starts/monitors the collector in the interactive session |
| **WorkPulse.Collector** | User session, interactive desktop | Foreground app sampling (`GetForegroundWindow`, `GetWindowThreadProcessId`, `QueryFullProcessImageName`), idle detection (`GetLastInputInfo`), lock/unlock (`SystemEvents.SessionSwitch` / `WTSRegisterSessionNotification`), aggregated input counters (low-level hook counts only), session start/end; emits events to the service |
| **Electron UI** | User session, tray + window | Login, device registration, agent home, monitoring status, current session, application usage summary, sync/connection status, privacy information, settings, help, notifications, diagnostics |

The service never shows UI (Session 0 isolation). The collector is launched into the
active console session by the service with `CreateProcessAsUser` (token from
`WTSQueryUserToken`) and restarted if it exits.

## Data flow

1. Collector samples the foreground window every `samplingIntervalSeconds` (default 10 s,
   policy-driven) and coalesces identical consecutive samples.
2. Each event gets a UUID v4 `eventId` and a monotonic `sequence` (persisted in the
   service) and is sent to the service over the named pipe.
3. The service appends the event to `%ProgramData%\WorkPulse\queue\events-YYYYMMDD.wpq`:
   AES-256-GCM encrypted JSON lines. The data key is generated once and protected with
   DPAPI (machine scope). Files rotate daily; retention is configurable (default 14 days).
4. Every `syncIntervalSeconds` (default 30 s) or when 200 events are pending, the service
   POSTs a batch (max 500 events). Accepted and duplicate ids are removed from the queue;
   rejected events are moved to `dead-letter.wpq` and surfaced in Diagnostics.
5. Network failures trigger exponential back-off with jitter (2 s → 5 min). Nothing is
   discarded. After restart the service resumes from the queue files.

## Registration and authentication

1. The employee signs in from the Electron UI with their WorkPulse credentials (or SSO).
2. The UI sends `register { accessToken, apiBaseUrl }` to the service over the pipe.
3. The service calls `POST /api/v1/agent/register` with hostname, `machineId`
   (SHA-256 of the Windows `MachineGuid`), OS version and agent version.
4. The backend creates the device (`PENDING` or `APPROVED` depending on policy) and returns
   a device token. The service stores it DPAPI-protected; the user JWT is discarded.
5. All further calls use `X-Device-Token`. Revocation returns `401 DEVICE_REVOKED`, the
   service stops collecting and the UI shows a revoked state.

## Security

* Electron: `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP, single-instance lock,
  only `https:` navigation allowed. The preload exposes `window.workpulse` with a typed,
  minimal API; the renderer never touches the pipe directly.
* Named pipe ACL: created by the service with a DACL allowing Authenticated Users
  read/write, no remote access (`PIPE_REJECT_REMOTE_CLIENTS`).
* Local data: AES-256-GCM, key protected by DPAPI; files are owned by `SYSTEM` with
  read access for Administrators only.
* Installer and updates: signed with the organisation's code-signing certificate;
  the update manifest includes a SHA-256 that the service verifies before applying.
* Collected data is limited to what the policy allows. Raw keystrokes, clipboard,
  screenshots and private content are never collected (see EVENT_CONTRACTS.md).

## Lifecycle

| Event | Behaviour |
|---|---|
| Windows boot | Service starts automatically (delayed start). |
| User logon | Service launches the collector in that session; the UI auto-starts (Run key, visible tray icon). |
| Lock / unlock | `SESSION_LOCK` / `SESSION_UNLOCK` events; sampling pauses while locked. |
| Outside collection window | Collector keeps the session state only; no app sampling; UI shows "Paused – outside working hours". |
| Logoff / shutdown | `SESSION_END` emitted; service flushes the queue; service stop emits `AGENT_STOPPED`. |
| Crash | Service recovery actions restart it; the queue is intact; next batch starts from the persisted sequence. |
| Update | Service downloads, verifies SHA-256, schedules the installer at the next idle/lock, emits `AGENT_STOPPED {reason: UPDATE}`. |

## Build and development

* Electron: `npm install && npm run dev` in `electron/` (works without the service: shows the
  "Service not reachable" state and a mock-pipe mode for UI development, clearly labelled).
* C#: `dotnet build WorkPulse.Agent.sln` (requires .NET 8 SDK). Both projects target
  `net8.0-windows`. The service installs with `sc create` or the Inno Setup installer.
