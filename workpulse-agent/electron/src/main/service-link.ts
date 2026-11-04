import type { AgentStatus, IpcKind, IpcMessage, NotificationBody } from '../../../shared/ts/ipc';

export type StatusListener = (status: AgentStatus) => void;
export type NotificationListener = (notification: NotificationBody) => void;
export type ConnectionListener = (connected: boolean) => void;

/**
 * What the UI needs from "the service": either the real named pipe (PipeClient) or the
 * in-process development mock (MockService). Both push `status` snapshots and answer requests.
 */
export interface ServiceLink {
  readonly kind: 'pipe' | 'mock';
  isConnected(): boolean;
  request<T = unknown>(kind: IpcKind, body?: unknown, timeoutMs?: number): Promise<IpcMessage<T>>;
  onStatus(listener: StatusListener): () => void;
  onNotification(listener: NotificationListener): () => void;
  onConnection(listener: ConnectionListener): () => void;
  start(): void;
  stop(): void;
}

export const UI_VERSION = '1.0.0';

export function emptyStatus(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    registered: false,
    deviceId: null,
    organizationId: null,
    employee: null,
    connection: 'UNKNOWN',
    backendReachable: false,
    queueDepth: 0,
    deadLetterCount: 0,
    lastSyncAt: null,
    lastSyncError: null,
    policyVersion: null,
    policyName: null,
    policy: null,
    monitoring: 'NOT_REGISTERED',
    currentApp: null,
    sessionStartedAt: null,
    collectorConnected: false,
    onBreak: false,
    todayUsage: [],
    todaySummary: { sessionSeconds: 0, activeSeconds: 0, idleSeconds: 0, breakSeconds: 0, lockedSeconds: 0 },
    version: UI_VERSION,
    serviceVersion: 'unknown',
    apiBaseUrl: '',
    ...overrides,
  };
}
