import { EventEmitter } from 'node:events';
import {
  createMessage,
  type AgentStatus,
  type Diagnostics,
  type EffectivePolicy,
  type IpcKind,
  type IpcMessage,
  type RegisterBody,
  type RegisterResultBody,
} from '../../../shared/ts/ipc';
import { emptyStatus, UI_VERSION, type ConnectionListener, type NotificationListener, type ServiceLink, type StatusListener } from './service-link';

const MOCK_POLICY: EffectivePolicy = {
  policyId: 'mock-policy',
  name: 'Mock policy (development)',
  version: 1,
  resolvedFrom: 'MOCK',
  samplingIntervalSeconds: 10,
  idleThresholdSeconds: 300,
  workingHours: { from: '09:00', to: '18:00', days: [1, 2, 3, 4, 5] },
  collectionWindows: [{ days: [1, 2, 3, 4, 5, 6, 7], from: '00:00', to: '23:59', tz: 'UTC' }],
  collectWindowTitles: false,
  collectInputSummary: true,
  sensitiveAppExclusions: ['keepass.exe', '1password.exe'],
  dataCategories: ['FOREGROUND_APPLICATION', 'IDLE_TIME', 'SESSION_STATE', 'INPUT_SUMMARY', 'DEVICE_HEALTH'],
  employeeNotice:
    'DEVELOPMENT MOCK – no data is collected or sent. This notice is where the organisation’s monitoring policy text appears.',
  retentionDays: 30,
  minAgentVersion: '1.0.0',
};

const MOCK_APPS = [
  ['code.exe', 'Visual Studio Code'],
  ['chrome.exe', 'Google Chrome'],
  ['ms-teams.exe', 'Microsoft Teams'],
  ['outlook.exe', 'Microsoft Outlook'],
];

export interface MockServiceOptions {
  approvalDelayMs?: number;
  tickMs?: number;
}

/**
 * In-process stand-in for WorkPulse.Service, used only for UI development when the real pipe is
 * unavailable (WORKPULSE_MOCK_SERVICE=1, or dev mode with no service). Every snapshot carries
 * `mock: true` so the UI can label it "Mock service (development)". Never used in packaged builds.
 */
export class MockService extends EventEmitter implements ServiceLink {
  readonly kind = 'mock' as const;
  private status: AgentStatus;
  private running = false;
  private tick: ReturnType<typeof setInterval> | null = null;
  private approvalTimer: ReturnType<typeof setTimeout> | null = null;
  private appIndex = 0;
  private usage = new Map<string, number>();
  private readonly approvalDelayMs: number;
  private readonly tickMs: number;

  constructor(options: MockServiceOptions = {}) {
    super();
    this.approvalDelayMs = options.approvalDelayMs ?? 3000;
    this.tickMs = options.tickMs ?? 5000;
    this.status = emptyStatus({ serviceVersion: 'mock', apiBaseUrl: 'http://localhost:8080', mock: true, connection: 'ONLINE', backendReachable: true });
  }

  isConnected(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.emit('connection', true);
    this.tick = setInterval(() => this.simulateTick(), this.tickMs);
    this.pushStatus();
  }

  stop(): void {
    this.running = false;
    if (this.tick) {
      clearInterval(this.tick);
      this.tick = null;
    }
    if (this.approvalTimer) {
      clearTimeout(this.approvalTimer);
      this.approvalTimer = null;
    }
    this.emit('connection', false);
  }

  onStatus(listener: StatusListener): () => void {
    this.on('status', listener);
    return () => this.off('status', listener);
  }

  onNotification(listener: NotificationListener): () => void {
    this.on('notification', listener);
    return () => this.off('notification', listener);
  }

  onConnection(listener: ConnectionListener): () => void {
    this.on('connection', listener);
    return () => this.off('connection', listener);
  }

  snapshot(): AgentStatus {
    return { ...this.status, todayUsage: [...this.status.todayUsage], todaySummary: { ...this.status.todaySummary } };
  }

  async request<T = unknown>(kind: IpcKind, body: unknown = {}): Promise<IpcMessage<T>> {
    if (!this.running) {
      throw new Error('Service not reachable');
    }
    switch (kind) {
      case 'status.get':
        return createMessage('status', this.snapshot()) as IpcMessage<T>;
      case 'register':
        return createMessage('register.result', this.register(body as RegisterBody)) as IpcMessage<T>;
      case 'break.start':
        this.status = { ...this.status, onBreak: true };
        this.pushStatus();
        return createMessage('ack', { ok: true }) as IpcMessage<T>;
      case 'break.end':
        this.status = { ...this.status, onBreak: false };
        this.pushStatus();
        return createMessage('ack', { ok: true }) as IpcMessage<T>;
      case 'sync.now': {
        const accepted = this.status.queueDepth;
        this.status = { ...this.status, queueDepth: 0, lastSyncAt: new Date().toISOString(), lastSyncError: null };
        this.pushStatus();
        return createMessage('sync.result', { ok: true, accepted, duplicates: 0, rejected: 0 }) as IpcMessage<T>;
      }
      case 'diagnostics.get':
        return createMessage('diagnostics', this.diagnostics()) as IpcMessage<T>;
      default:
        return createMessage('error', { code: 'UNSUPPORTED', message: `Mock does not implement ${kind}` }) as IpcMessage<T>;
    }
  }

  private register(body: RegisterBody): RegisterResultBody {
    if (!body || !body.accessToken) {
      return { ok: false, error: 'accessToken is required' };
    }
    this.status = {
      ...this.status,
      registered: true,
      deviceId: 'mock-device-0001',
      organizationId: 'mock-org',
      employee: { id: 'mock-employee', name: 'Demo Employee' },
      apiBaseUrl: body.apiBaseUrl || this.status.apiBaseUrl,
      monitoring: 'PENDING_APPROVAL',
      policy: MOCK_POLICY,
      policyName: MOCK_POLICY.name,
      policyVersion: MOCK_POLICY.version,
      connection: 'ONLINE',
      backendReachable: true,
    };
    this.pushStatus();
    this.approvalTimer = setTimeout(() => {
      this.approvalTimer = null;
      this.status = {
        ...this.status,
        monitoring: 'ACTIVE',
        collectorConnected: true,
        sessionStartedAt: new Date().toISOString(),
      };
      this.emit('notification', { level: 'info', title: 'Device approved', message: 'Monitoring is active (mock).' });
      this.pushStatus();
    }, this.approvalDelayMs);
    return { ok: true, deviceId: 'mock-device-0001', status: 'PENDING', employeeName: 'Demo Employee' };
  }

  private simulateTick(): void {
    if (this.status.monitoring !== 'ACTIVE') {
      return;
    }
    const [processName, appName] = MOCK_APPS[this.appIndex % MOCK_APPS.length];
    if (!this.status.onBreak) {
      this.usage.set(processName, (this.usage.get(processName) ?? 0) + this.tickMs / 1000);
    }
    if (Math.random() < 0.3) {
      this.appIndex += 1;
    }
    const todayUsage = [...this.usage.entries()]
      .map(([p, seconds]) => ({ processName: p, appName: MOCK_APPS.find((a) => a[0] === p)?.[1] ?? p, seconds: Math.round(seconds) }))
      .sort((a, b) => b.seconds - a.seconds);
    const summary = this.status.todaySummary;
    this.status = {
      ...this.status,
      currentApp: this.status.onBreak ? null : { processName, appName, since: this.status.currentApp?.processName === processName ? this.status.currentApp.since : new Date().toISOString() },
      queueDepth: this.status.queueDepth + 1,
      todayUsage,
      todaySummary: {
        ...summary,
        sessionSeconds: summary.sessionSeconds + this.tickMs / 1000,
        activeSeconds: summary.activeSeconds + (this.status.onBreak ? 0 : this.tickMs / 1000),
        breakSeconds: summary.breakSeconds + (this.status.onBreak ? this.tickMs / 1000 : 0),
      },
    };
    this.pushStatus();
  }

  private diagnostics(): Diagnostics {
    return {
      queue: { depth: this.status.queueDepth, files: 1, bytes: this.status.queueDepth * 240, oldestEventAt: null, sequence: this.status.queueDepth },
      deadLetters: [],
      recentErrors: [],
      versions: { service: 'mock', collector: 'mock', ui: UI_VERSION, protocol: 1 },
      paths: { queue: '(mock – nothing is written)', logs: '(mock)' },
      lastBatch: this.status.lastSyncAt ? { at: this.status.lastSyncAt, accepted: 0, duplicates: 0, rejected: 0 } : null,
      mock: true,
    };
  }

  private pushStatus(): void {
    this.emit('status', this.snapshot());
  }
}
