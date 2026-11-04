import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentStatus, RegisterResultBody, SyncResultBody } from '../../../shared/ts/ipc';
import { MockService } from './mock-service';

describe('MockService status transitions', () => {
  let service: MockService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new MockService({ approvalDelayMs: 1000, tickMs: 1000 });
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('refuses requests until started, then reports an unregistered mock status', async () => {
    await expect(service.request('status.get')).rejects.toThrow('Service not reachable');
    service.start();
    const reply = await service.request<AgentStatus>('status.get');
    expect(reply.kind).toBe('status');
    expect(reply.body.mock).toBe(true);
    expect(reply.body.registered).toBe(false);
    expect(reply.body.monitoring).toBe('NOT_REGISTERED');
  });

  it('moves from registration to pending approval to active', async () => {
    service.start();
    const statuses: AgentStatus[] = [];
    service.onStatus((s) => statuses.push(s));

    const result = await service.request<RegisterResultBody>('register', { accessToken: 'jwt', apiBaseUrl: 'http://api.test' });
    expect(result.body.ok).toBe(true);
    expect(statuses.at(-1)?.monitoring).toBe('PENDING_APPROVAL');
    expect(statuses.at(-1)?.apiBaseUrl).toBe('http://api.test');
    expect(statuses.at(-1)?.policy?.employeeNotice).toContain('MOCK');

    vi.advanceTimersByTime(1000);
    expect(statuses.at(-1)?.monitoring).toBe('ACTIVE');
    expect(statuses.at(-1)?.collectorConnected).toBe(true);
    expect(statuses.at(-1)?.sessionStartedAt).not.toBeNull();
  });

  it('rejects registration without a token', async () => {
    service.start();
    const result = await service.request<RegisterResultBody>('register', { accessToken: '', apiBaseUrl: '' });
    expect(result.body.ok).toBe(false);
    expect(service.snapshot().registered).toBe(false);
  });

  it('tracks breaks, usage and manual sync once active', async () => {
    service.start();
    await service.request('register', { accessToken: 'jwt', apiBaseUrl: 'http://api.test' });
    vi.advanceTimersByTime(1000); // approval
    vi.advanceTimersByTime(3000); // three ticks of activity
    let snapshot = service.snapshot();
    expect(snapshot.queueDepth).toBe(3);
    expect(snapshot.todaySummary.activeSeconds).toBe(3);
    expect(snapshot.todayUsage.reduce((sum, u) => sum + u.seconds, 0)).toBe(3);
    expect(snapshot.currentApp).not.toBeNull();

    await service.request('break.start', { note: 'Lunch' });
    expect(service.snapshot().onBreak).toBe(true);
    vi.advanceTimersByTime(2000);
    snapshot = service.snapshot();
    expect(snapshot.todaySummary.breakSeconds).toBe(2);
    expect(snapshot.todaySummary.activeSeconds).toBe(3);
    expect(snapshot.currentApp).toBeNull();

    await service.request('break.end');
    expect(service.snapshot().onBreak).toBe(false);

    const sync = await service.request<SyncResultBody>('sync.now');
    expect(sync.body.ok).toBe(true);
    expect(sync.body.accepted).toBe(5);
    expect(service.snapshot().queueDepth).toBe(0);
    expect(service.snapshot().lastSyncAt).not.toBeNull();
  });

  it('answers diagnostics and unknown kinds safely', async () => {
    service.start();
    const diag = await service.request<{ mock: boolean; versions: { protocol: number } }>('diagnostics.get');
    expect(diag.kind).toBe('diagnostics');
    expect(diag.body.mock).toBe(true);
    expect(diag.body.versions.protocol).toBe(1);
    const unknown = await service.request('policy');
    expect(unknown.kind).toBe('error');
  });
});
