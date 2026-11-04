/**
 * WorkPulse agent IPC contracts (named pipe between the Windows service, the user-session
 * collector and the Electron UI). Mirrors shared/cs/IpcMessages.cs and shared/ipc.schema.json.
 *
 * Transport: newline-delimited JSON over \\.\pipe\WorkPulse.Agent. The service is the server.
 * Every message is one JSON object per line. Responses carry `replyTo` = request `id`.
 */

export const PIPE_NAME = 'WorkPulse.Agent';
export const PIPE_PATH = '\\\\.\\pipe\\WorkPulse.Agent';
export const PROTOCOL_VERSION = 1;

export type IpcKind =
  | 'hello'
  | 'hello.ack'
  | 'event'
  | 'policy'
  | 'status.get'
  | 'status'
  | 'register'
  | 'register.result'
  | 'break.start'
  | 'break.end'
  | 'sync.now'
  | 'sync.result'
  | 'diagnostics.get'
  | 'diagnostics'
  | 'notification'
  | 'ack'
  | 'error';

export interface IpcMessage<T = unknown> {
  kind: IpcKind;
  /** UUID v4, unique per message. */
  id: string;
  /** ISO-8601 UTC timestamp of creation. */
  ts: string;
  /** For responses: the `id` of the request being answered. */
  replyTo?: string;
  body: T;
}

// ---------------------------------------------------------------------------
// Activity events (see docs/api/EVENT_CONTRACTS.md §1). The collector emits these to the
// service; the service assigns `sequence` on enqueue and forwards them to the backend.
// Forbidden by design: raw keystrokes, clipboard, screenshots, URLs, message or file contents.
// ---------------------------------------------------------------------------

export type ActivityEventType =
  | 'AGENT_STARTED'
  | 'AGENT_STOPPED'
  | 'AGENT_HEARTBEAT'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'SESSION_LOCK'
  | 'SESSION_UNLOCK'
  | 'FOREGROUND_APP'
  | 'IDLE_START'
  | 'IDLE_END'
  | 'INPUT_SUMMARY'
  | 'BREAK_START'
  | 'BREAK_END'
  | 'NETWORK_OFFLINE'
  | 'NETWORK_ONLINE'
  | 'POLICY_APPLIED'
  | 'DEVICE_INFO';

export interface ActivityEvent {
  eventId: string;
  /** null until the service assigns it. */
  sequence: number | null;
  type: ActivityEventType;
  occurredAt: string;
  sessionId: string | null;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Policy (backend PolicyDtos.EffectivePolicyResponse)
// ---------------------------------------------------------------------------

export interface CollectionWindow {
  days: number[];
  from: string;
  to: string;
  tz: string;
}

export interface EffectivePolicy {
  policyId: string | null;
  name: string;
  version: number;
  resolvedFrom: string;
  samplingIntervalSeconds: number;
  idleThresholdSeconds: number;
  workingHours: Record<string, unknown>;
  collectionWindows: CollectionWindow[];
  collectWindowTitles: boolean;
  collectInputSummary: boolean;
  sensitiveAppExclusions: string[];
  dataCategories: string[];
  employeeNotice: string | null;
  retentionDays: number;
  minAgentVersion: string | null;
}

// ---------------------------------------------------------------------------
// Message bodies
// ---------------------------------------------------------------------------

export interface HelloBody {
  component: 'collector' | 'ui';
  version: string;
  sessionId?: string;
  windowsUser?: string;
}

export interface HelloAckBody {
  serviceVersion: string;
  protocolVersion: number;
}

export interface RegisterBody {
  /** Short-lived user JWT obtained by the UI; the service discards it after registration. */
  accessToken: string;
  apiBaseUrl: string;
}

export interface RegisterResultBody {
  ok: boolean;
  deviceId?: string;
  status?: 'PENDING' | 'APPROVED' | 'REVOKED' | 'RETIRED';
  employeeName?: string;
  error?: string;
}

export interface BreakBody {
  note?: string;
}

export interface AckBody {
  ok: boolean;
  error?: string;
}

export interface SyncResultBody {
  ok: boolean;
  accepted: number;
  duplicates: number;
  rejected: number;
  error?: string;
}

export interface ErrorBody {
  code: string;
  message: string;
}

export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'REVOKED' | 'UNKNOWN';

export type MonitoringState =
  | 'ACTIVE'
  | 'PAUSED_OUTSIDE_WINDOW'
  | 'STOPPED'
  | 'REVOKED'
  | 'PENDING_APPROVAL'
  | 'NOT_REGISTERED';

export interface CurrentApp {
  processName: string;
  appName: string;
  since: string;
}

export interface AppUsageEntry {
  processName: string;
  appName: string;
  seconds: number;
}

export interface TodaySummary {
  sessionSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
  breakSeconds: number;
  lockedSeconds: number;
}

/** Snapshot pushed by the service to the UI (`status`), also returned for `status.get`. */
export interface AgentStatus {
  registered: boolean;
  deviceId: string | null;
  organizationId: string | null;
  employee: { id: string; name: string } | null;
  connection: ConnectionState;
  backendReachable: boolean;
  queueDepth: number;
  deadLetterCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  policyVersion: number | null;
  policyName: string | null;
  policy: EffectivePolicy | null;
  monitoring: MonitoringState;
  currentApp: CurrentApp | null;
  sessionStartedAt: string | null;
  collectorConnected: boolean;
  onBreak: boolean;
  todayUsage: AppUsageEntry[];
  todaySummary: TodaySummary;
  version: string;
  serviceVersion: string;
  apiBaseUrl: string;
  /** True only for the in-process development mock, never for the real service. */
  mock?: boolean;
}

export interface DeadLetterEntry {
  eventId: string;
  type: string;
  reason: string;
  at: string;
}

export interface Diagnostics {
  queue: {
    depth: number;
    files: number;
    bytes: number;
    oldestEventAt: string | null;
    sequence: number;
  };
  deadLetters: DeadLetterEntry[];
  recentErrors: { at: string; message: string }[];
  versions: { service: string; collector: string | null; ui: string; protocol: number };
  paths: Record<string, string>;
  lastBatch: { at: string; accepted: number; duplicates: number; rejected: number } | null;
  mock?: boolean;
}

export interface NotificationBody {
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Framing helpers (pure, unit-tested)
// ---------------------------------------------------------------------------

function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  // RFC 4122 v4 fallback (non-cryptographic; only reached on very old runtimes)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createMessage<T>(kind: IpcKind, body: T, replyTo?: string): IpcMessage<T> {
  const message: IpcMessage<T> = { kind, id: uuid(), ts: new Date().toISOString(), body };
  if (replyTo) {
    message.replyTo = replyTo;
  }
  return message;
}

export function encodeFrame(message: IpcMessage): string {
  return JSON.stringify(message) + '\n';
}

export function isIpcMessage(value: unknown): value is IpcMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const m = value as Record<string, unknown>;
  return typeof m.kind === 'string' && typeof m.id === 'string' && typeof m.ts === 'string' && 'body' in m;
}

/**
 * Accumulates socket chunks and yields complete, parsed messages. Malformed lines are
 * reported through `onInvalid` and skipped; the stream keeps going.
 */
export class LineFramer {
  private buffer = '';
  private readonly maxLine: number;
  private readonly onInvalid?: (line: string, error: unknown) => void;

  constructor(options: { maxLineBytes?: number; onInvalid?: (line: string, error: unknown) => void } = {}) {
    this.maxLine = options.maxLineBytes ?? 4 * 1024 * 1024;
    this.onInvalid = options.onInvalid;
  }

  push(chunk: string | Uint8Array): IpcMessage[] {
    this.buffer += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    const out: IpcMessage[] = [];
    let index = this.buffer.indexOf('\n');
    while (index >= 0) {
      const line = this.buffer.slice(0, index).replace(/\r$/, '');
      this.buffer = this.buffer.slice(index + 1);
      if (line.trim().length > 0) {
        try {
          const parsed: unknown = JSON.parse(line);
          if (isIpcMessage(parsed)) {
            out.push(parsed);
          } else {
            this.onInvalid?.(line, new Error('Not an IPC message'));
          }
        } catch (error) {
          this.onInvalid?.(line, error);
        }
      }
      index = this.buffer.indexOf('\n');
    }
    if (this.buffer.length > this.maxLine) {
      this.onInvalid?.(this.buffer.slice(0, 64) + '…', new Error('Line too long'));
      this.buffer = '';
    }
    return out;
  }

  reset(): void {
    this.buffer = '';
  }
}
