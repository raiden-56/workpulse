import type { IpcMessage } from '../../../shared/ts/ipc';

interface Pending {
  resolve: (message: IpcMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Matches responses (`replyTo`) to outstanding requests (`id`) and enforces per-request timeouts.
 * Pure: no sockets, no Electron – unit tested in request-correlator.test.ts.
 */
export class RequestCorrelator {
  private readonly pending = new Map<string, Pending>();

  get size(): number {
    return this.pending.size;
  }

  register(id: string, timeoutMs: number): Promise<IpcMessage> {
    return new Promise<IpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${id} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  /** @returns true when the message answered an outstanding request. */
  resolve(message: IpcMessage): boolean {
    if (!message.replyTo) {
      return false;
    }
    const entry = this.pending.get(message.replyTo);
    if (!entry) {
      return false;
    }
    clearTimeout(entry.timer);
    this.pending.delete(message.replyTo);
    if (message.kind === 'error') {
      const body = (message.body ?? {}) as { code?: string; message?: string };
      entry.reject(new Error(`${body.code ?? 'ERROR'}: ${body.message ?? 'request failed'}`));
    } else {
      entry.resolve(message);
    }
    return true;
  }

  rejectAll(error: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }
}
