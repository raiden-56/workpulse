# WorkPulse Agent – Named-pipe IPC contract (protocol v1)

Pipe: `\\.\pipe\WorkPulse.Agent` · server: **WorkPulse.Service** (Session 0) · clients: **WorkPulse.Collector** (user session) and the **Electron UI** (user session).
Framing: newline-delimited JSON (one object per line, UTF-8, `\n`). Max line 4 MiB.
Security: DACL = Authenticated Users read/write, `PIPE_REJECT_REMOTE_CLIENTS`. The service never trusts a client for anything other than the explicit message types below, and never shows UI.

## Envelope

```json
{ "kind": "status.get", "id": "6b2d8e4a-5f0e-4d2b-9e1a-9f2c1b3a4d5e", "ts": "2026-11-04T09:30:12.345Z", "replyTo": null, "body": {} }
```

| Field | Notes |
|---|---|
| `kind` | message type (below) |
| `id` | UUID v4, unique per message |
| `ts` | ISO-8601 UTC |
| `replyTo` | only on responses: the request `id` |
| `body` | kind-specific |

## Messages

| Direction | kind | Body | Response |
|---|---|---|---|
| client → service | `hello` | `{ component: "collector"\|"ui", version, sessionId?, windowsUser? }` | `hello.ack { serviceVersion, protocolVersion }` |
| collector → service | `event` | an activity event `{ eventId, sequence: null, type, occurredAt, sessionId, payload }` (see docs/api/EVENT_CONTRACTS.md §1) | `ack { ok }` |
| service → collector / ui | `policy` | `EffectivePolicyResponse` (backend shape) | – |
| ui → service | `status.get` | `{}` | `status` (AgentStatus) |
| service → ui | `status` | AgentStatus snapshot (pushed on every change and at least every 30 s) | – |
| ui → service | `register` | `{ accessToken, apiBaseUrl }` – user JWT from `/api/v1/auth/login`; the service calls `/api/v1/agent/register`, stores the **device token** DPAPI-protected and discards the JWT | `register.result { ok, deviceId?, status?, employeeName?, error? }` |
| ui → service | `break.start` / `break.end` | `{ note? }` → emits `BREAK_START` / `BREAK_END` events | `ack` |
| ui → service | `sync.now` | `{}` | `sync.result { ok, accepted, duplicates, rejected, error? }` |
| ui → service | `diagnostics.get` | `{}` | `diagnostics` |
| service → ui | `notification` | `{ level: "info"\|"warning"\|"error", title, message }` | – |
| service → any | `error` | `{ code, message }` (sent with `replyTo` when a request could not be served) | – |

### AgentStatus

```json
{
  "registered": true, "deviceId": "…", "organizationId": "…", "employee": { "id": "…", "name": "Priya Sharma" },
  "connection": "ONLINE", "backendReachable": true,
  "queueDepth": 12, "deadLetterCount": 0, "lastSyncAt": "2026-11-04T09:29:40Z", "lastSyncError": null,
  "policyVersion": 3, "policyName": "Engineering policy", "policy": { "…": "EffectivePolicyResponse" },
  "monitoring": "ACTIVE",
  "currentApp": { "processName": "code.exe", "appName": "Visual Studio Code", "since": "2026-11-04T09:12:00Z" },
  "sessionStartedAt": "2026-11-04T08:58:11Z", "collectorConnected": true, "onBreak": false,
  "todayUsage": [ { "processName": "code.exe", "appName": "Visual Studio Code", "seconds": 5400 } ],
  "todaySummary": { "sessionSeconds": 9000, "activeSeconds": 7200, "idleSeconds": 900, "breakSeconds": 0, "lockedSeconds": 900 },
  "version": "1.0.0", "serviceVersion": "1.0.0", "apiBaseUrl": "https://workpulse.example.com"
}
```

`monitoring` values: `ACTIVE`, `PAUSED_OUTSIDE_WINDOW` (outside the policy's collection windows – session state only), `STOPPED` (collector not running), `REVOKED` (backend returned `DEVICE_REVOKED`), `PENDING_APPROVAL` (device awaiting IT approval; events are buffered), `NOT_REGISTERED`.

### Diagnostics

```json
{
  "queue": { "depth": 12, "files": 2, "bytes": 18231, "oldestEventAt": "…", "sequence": 10231 },
  "deadLetters": [ { "eventId": "…", "type": "INPUT_SUMMARY", "reason": "FORBIDDEN_CONTENT:text", "at": "…" } ],
  "recentErrors": [ { "at": "…", "message": "POST /activity/batch: 503" } ],
  "versions": { "service": "1.0.0", "collector": "1.0.0", "ui": "1.0.0", "protocol": 1 },
  "paths": { "queue": "C:\\ProgramData\\WorkPulse\\queue", "logs": "C:\\ProgramData\\WorkPulse\\logs" },
  "lastBatch": { "at": "…", "accepted": 118, "duplicates": 2, "rejected": 0 }
}
```

## Sequence: registration

1. UI → backend `POST /api/v1/auth/login` (employee credentials) → `accessToken` (kept in memory only).
2. UI → service `register { accessToken, apiBaseUrl }`.
3. Service → backend `POST /api/v1/agent/register` (Bearer JWT) with hostname, machineId (SHA-256 of `MachineGuid`), OS, agent version.
4. Service stores `deviceToken` (DPAPI, machine scope) and `device.json`; discards the JWT; replies `register.result`; pushes `status`.
5. From now on the service authenticates with `X-Device-Token` only.

## Sequence: event flow

collector `event` → service assigns `sequence`, appends to the encrypted queue, replies `ack`, updates the live status counters → `SyncWorker` batches to `POST /api/v1/activity/batch` → accepted + duplicates removed from the queue, rejected moved to the dead-letter file (surfaced in `diagnostics`, never silently dropped).
