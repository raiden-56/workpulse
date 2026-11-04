import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessage, encodeFrame, isIpcMessage, LineFramer, type IpcMessage } from '../../../shared/ts/ipc';
import { RequestCorrelator } from './request-correlator';

describe('LineFramer', () => {
  it('yields complete frames and keeps partial tails', () => {
    const framer = new LineFramer();
    const a = createMessage('status.get', {});
    const b = createMessage('ack', { ok: true }, a.id);
    const wire = encodeFrame(a) + encodeFrame(b);
    const cut = Math.floor(wire.length / 2);

    const first = framer.push(wire.slice(0, cut));
    const second = framer.push(wire.slice(cut));
    const all = [...first, ...second];

    expect(all.map((m) => m.kind)).toEqual(['status.get', 'ack']);
    expect(all[1].replyTo).toBe(a.id);
  });

  it('handles CRLF and multiple frames in one chunk', () => {
    const framer = new LineFramer();
    const msgs = [createMessage('hello', { component: 'ui', version: '1' }), createMessage('sync.now', {})];
    const out = framer.push(msgs.map((m) => JSON.stringify(m)).join('\r\n') + '\r\n');
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe('hello');
  });

  it('skips malformed lines without losing the stream', () => {
    const invalid: string[] = [];
    const framer = new LineFramer({ onInvalid: (line) => invalid.push(line) });
    const good = createMessage('ack', { ok: true });
    const out = framer.push('{not json}\n' + '{"kind":"x"}\n' + encodeFrame(good));
    expect(invalid).toHaveLength(2);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(good.id);
  });

  it('validates the envelope shape', () => {
    expect(isIpcMessage({ kind: 'ack', id: '1', ts: 'now', body: {} })).toBe(true);
    expect(isIpcMessage({ kind: 'ack', id: '1' })).toBe(false);
    expect(isIpcMessage(null)).toBe(false);
  });
});

describe('RequestCorrelator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves a request from its reply', async () => {
    const correlator = new RequestCorrelator();
    const request = createMessage('status.get', {});
    const promise = correlator.register(request.id, 1000);
    const reply: IpcMessage = createMessage('status', { registered: false }, request.id);

    expect(correlator.resolve(reply)).toBe(true);
    await expect(promise).resolves.toMatchObject({ kind: 'status' });
    expect(correlator.size).toBe(0);
  });

  it('rejects when the reply is an error frame', async () => {
    const correlator = new RequestCorrelator();
    const promise = correlator.register('req-1', 1000);
    correlator.resolve(createMessage('error', { code: 'NOT_REGISTERED', message: 'Register first' }, 'req-1'));
    await expect(promise).rejects.toThrow('NOT_REGISTERED: Register first');
  });

  it('ignores unrelated or unsolicited messages', () => {
    const correlator = new RequestCorrelator();
    void correlator.register('req-2', 1000).catch(() => undefined);
    expect(correlator.resolve(createMessage('status', {}))).toBe(false);
    expect(correlator.resolve(createMessage('ack', { ok: true }, 'someone-else'))).toBe(false);
    expect(correlator.size).toBe(1);
    correlator.rejectAll(new Error('closed'));
  });

  it('times out and clears the pending entry', async () => {
    const correlator = new RequestCorrelator();
    const promise = correlator.register('slow', 500);
    const assertion = expect(promise).rejects.toThrow('timed out');
    vi.advanceTimersByTime(600);
    await assertion;
    expect(correlator.size).toBe(0);
  });

  it('rejects everything on disconnect', async () => {
    const correlator = new RequestCorrelator();
    const a = correlator.register('a', 5000);
    const b = correlator.register('b', 5000);
    correlator.rejectAll(new Error('Service connection closed'));
    await expect(a).rejects.toThrow('closed');
    await expect(b).rejects.toThrow('closed');
    expect(correlator.size).toBe(0);
  });
});
