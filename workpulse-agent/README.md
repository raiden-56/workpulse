# WorkPulse Desktop Agent (Windows)

The agent is a **visible, employee-facing** application. It always shows its monitoring status,
what it collects and why. It consists of three independently buildable parts that talk over one
named pipe (`\\.\pipe\WorkPulse.Agent`, contract in [`shared/ipc-contracts.md`](shared/ipc-contracts.md)).

```
┌───────────────────────────── user session ─────────────────────────────┐
│  Electron UI  (electron/)              C# Collector  (collector/)       │
│  status, privacy, settings,            foreground app, idle, lock,      │
│  diagnostics, sign-in & registration   aggregate input counts           │
└───────────────┬──────────────────────────────────┬─────────────────────┘
                │ named pipe (JSON lines)           │
┌───────────────▼──────────────────────────────────▼─────────────────────┐
│  C# Windows Service  (service/)   Session 0, LocalSystem, no UI         │
│  pipe server · encrypted event queue (AES-256-GCM, DPAPI key)           │
│  batch sync → POST /api/v1/activity/batch · heartbeat · policy cache    │
│  launches the collector into the active session (CreateProcessAsUser)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTPS, X-Device-Token
                             WorkPulse backend
```

| Part | Tech | Build status on this machine |
|---|---|---|
| `electron/` | Electron 38, TypeScript 5.9, React 19, MUI 7, Vite 7, vitest | **Built and tested** (`npm run typecheck`, `npm run build`, `npm test -- --run`) |
| `service/` | .NET 8 Worker Service (`net8.0-windows`), `Microsoft.Extensions.Hosting.WindowsServices`, DPAPI | **Written, not compiled here** – no .NET SDK was available on the authoring machine |
| `collector/` | .NET 8 WinExe (`net8.0-windows`), Win32 P/Invoke | **Written, not compiled here** – same reason |
| `shared/` | TypeScript types, C# records, JSON schema and the protocol document | – |
| `installer/` | Inno Setup script + signing checklist | – |

## What is collected – and what is not

Collected (subject to the organisation's policy and only inside its collection windows):
foreground process name and friendly application name with duration, idle periods
(`GetLastInputInfo` vs. threshold), Windows session sign-in/out, lock/unlock, employee-declared
breaks, per-minute **counts** of keyboard/mouse events plus a regularity score, agent health.

Never collected, enforced in code and rejected by the service and the backend
(`IpcProtocol.ForbiddenPayloadKeys`): keystrokes or key codes, clipboard, screenshots, URLs,
window titles as text (only a salted hash, and only if the policy enables titles), message or
document contents, file contents, webcam/microphone/location.

## Prerequisites

- Windows 10 1809+ / Windows 11 (x64)
- Node.js 20+ for the Electron UI
- .NET 8 SDK (`winget install Microsoft.DotNet.SDK.8`) for the service and collector
- Inno Setup 6 (optional, full installer) and a code-signing certificate for releases

## Build

### Electron UI

```powershell
cd workpulse-agent\electron
npm install
npm run typecheck      # tsc for main/preload and renderer
npm test -- --run      # vitest: pipe framing/correlation + mock service transitions
npm run build          # dist-electron/ (main, preload) + dist/ (renderer)
npm run dist           # NSIS installer for the UI only -> release/
```

Development:

```powershell
npm run dev            # Vite dev server + Electron against the real service pipe
npm run dev:mock       # same, with the in-process mock service (no service needed); the banner says "Mock service (development)"
```

The mock is never used in packaged builds. In development the UI falls back to it automatically
when the pipe is unreachable for 5 s.

### Service and collector (.NET 8)

```powershell
cd workpulse-agent
dotnet build WorkPulse.Agent.sln -c Release
dotnet publish service   -c Release -r win-x64 --self-contained false
dotnet publish collector -c Release -r win-x64 --self-contained false
```

Both projects link `shared/cs/IpcMessages.cs`. They were written against the .NET 8 API surface
(nullable enabled, `[SupportedOSPlatform("windows")]`) but **have not been compiled on the
authoring machine, which has no .NET SDK**. Expect to fix minor compiler findings on first build.

## Run and install

1. Backend: run `workpulse-backend` (or point the UI at a deployed URL in Settings).
2. Service (elevated PowerShell):
   ```powershell
   cd workpulse-agent\service
   .\install-service.ps1 -BinaryPath "<path>\WorkPulse.Service.exe"
   ```
   The service creates `%ProgramData%\WorkPulse\{queue,config,logs,secrets}` with an ACL that
   grants SYSTEM full control and Administrators read access. `appsettings.json` next to the
   executable holds `ApiBaseUrl`, sync/heartbeat intervals, batch limits, queue retention and the
   collector path. Interactive run for debugging: `dotnet run --project service`.
3. UI: `npm run dev` (development) or install `WorkPulseAgent-UI-Setup-*.exe`.
4. In the UI: sign in with the employee account → **Register device**. The UI hands the sign-in
   token to the service over the pipe; the service calls `POST /api/v1/agent/register`, stores
   the returned device token DPAPI-protected and discards the token. The service then starts the
   collector in your session and the banner shows **Monitoring active** (or *Awaiting IT approval*
   if the organisation requires device approval; events are buffered meanwhile).

Full installer: `iscc installer\WorkPulseAgent.iss` after publishing both .NET projects and
building the Electron app (`npm run dist` produces `release\win-unpacked`). See
[`installer/SIGNING.md`](installer/SIGNING.md) – unsigned builds must not be distributed.

## Lifecycle

| Event | Behaviour |
|---|---|
| Boot | Service starts (delayed auto start, recovery actions restart it after a crash). |
| User signs in | Supervisor sees the active session and launches the collector with the user's token; the UI auto-starts hidden (`--hidden`). |
| Lock / unlock | `SESSION_LOCK` / `SESSION_UNLOCK`; sampling and idle detection pause while locked. |
| Outside collection window | Collector tracks session state only; UI shows *Paused – outside working hours*. |
| Network down | Events accumulate in the encrypted queue; back-off 2 s → 5 min with jitter; UI shows *Offline · buffering*. Nothing is discarded. |
| Backend rejects an event | Dead-lettered (`dead-letter.wpq`), listed in Diagnostics with the reason. |
| Device revoked (`401 DEVICE_REVOKED`) | Sync stops, collector exits, UI shows *Device revoked*. |
| Sign-out / shutdown | `SESSION_END`, final bounded sync, collector stops. |
| Service restart | Queue files and the sequence counter are on disk; the collector keeps un-acked events in memory and resends them on reconnect. |

## Troubleshooting

| Symptom | Check |
|---|---|
| UI says **Service not reachable** | `Get-Service WorkPulseAgent`; `%ProgramData%\WorkPulse\logs\service-*.log`; Event Viewer → Application → "WorkPulse Agent". |
| **Monitoring stopped** | Collector not running: `Get-Process WorkPulse.Collector`; `%LocalAppData%\WorkPulse\logs\collector-*.log`; confirm `CollectorExecutable` in `appsettings.json`. |
| **Awaiting IT approval** for long | An administrator must approve the device in the portal (Devices → Approve). |
| Queue keeps growing | Sync & connection screen → last error; backend reachability from this PC; proxy settings for the LocalSystem account. |
| Rejected events | Diagnostics → dead-letter list shows the backend reason (e.g. `UNKNOWN_TYPE`, `FORBIDDEN_CONTENT`). |
| Reset a device | `uninstall-service.ps1 -PurgeData` (loses unsynchronised events) then reinstall and register again. |

## Layout

```
workpulse-agent/
  WorkPulse.Agent.sln
  shared/      ipc-contracts.md · ipc.schema.json · ts/ipc.ts · ts/bridge.ts · cs/IpcMessages.cs
  electron/    src/main (main, preload bridge host, pipe client, mock service, secure store, API client)
               src/preload (contextBridge) · src/renderer (React screens) · tests · electron-builder.yml
  service/     Program.cs · Pipe/ · Queue/ · Sync/ · Policy/ · Registration/ · Session/ · Status/ · Storage/ · Logging/
               appsettings.json · install-service.ps1 · uninstall-service.ps1
  collector/   Program.cs · Native/User32.cs · Sampling/ · Session/ · Policy/ · Pipe/
  installer/   WorkPulseAgent.iss · SIGNING.md
```
