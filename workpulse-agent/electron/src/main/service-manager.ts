import { EventEmitter } from 'node:events';
import type { AgentStatus, IpcKind, IpcMessage, NotificationBody } from '../../../shared/ts/ipc';
import { MockService } from './mock-service';
import { PipeClient } from './pipe-client';
import { emptyStatus, type ServiceLink } from './service-link';

type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; debug: (...args: unknown[]) => void };

export interface ServiceManagerOptions {
  /** Force the in-process mock (WORKPULSE_MOCK_SERVICE=1). */
  forceMock: boolean;
  /** Development build: fall back to the mock when the pipe stays unreachable. Never in packaged builds. */
  allowMockFallback: boolean;
  fallbackAfterMs?: number;
  log?: Logger;
}

/**
 * Owns the active ServiceLink (pipe or mock), forwards its events, and swaps to the mock in
 * development when the real service cannot be reached.
 */
export class ServiceManager extends EventEmitter {
  private link: ServiceLink;
  private lastStatus: AgentStatus = emptyStatus();
  private unsubscribe: Array<() => void> = [];
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly log: Logger;

  constructor(private readonly options: ServiceManagerOptions) {
    super();
    this.log = options.log ?? console;
    this.link = options.forceMock ? new MockService() : new PipeClient(undefined, this.log);
    this.attach();
  }

  get kind(): 'pipe' | 'mock' {
    return this.link.kind;
  }

  start(): void {
    this.link.start();
    if (this.link.kind === 'pipe' && this.options.allowMockFallback) {
      this.fallbackTimer = setTimeout(() => {
        this.fallbackTimer = null;
        if (!this.link.isConnected()) {
          this.log.warn('Service pipe unreachable in development; switching to the in-process mock service');
          this.swapToMock();
        }
      }, this.options.fallbackAfterMs ?? 5000);
    }
  }

  stop(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.detach();
    this.link.stop();
  }

  isConnected(): boolean {
    return this.link.isConnected();
  }

  currentStatus(): AgentStatus {
    return this.lastStatus;
  }

  request<T = unknown>(kind: IpcKind, body?: unknown, timeoutMs?: number): Promise<IpcMessage<T>> {
    return this.link.request<T>(kind, body, timeoutMs);
  }

  private swapToMock(): void {
    this.detach();
    this.link.stop();
    this.link = new MockService();
    this.attach();
    this.link.start();
  }

  private attach(): void {
    this.unsubscribe = [
      this.link.onStatus((status) => {
        this.lastStatus = status;
        this.emit('status', status);
      }),
      this.link.onNotification((notification: NotificationBody) => this.emit('notification', notification)),
      this.link.onConnection((connected) => {
        this.emit('connection', connected);
        if (!connected) {
          this.lastStatus = { ...this.lastStatus, connection: 'UNKNOWN' };
        }
      }),
    ];
  }

  private detach(): void {
    this.unsubscribe.forEach((fn) => fn());
    this.unsubscribe = [];
  }
}
