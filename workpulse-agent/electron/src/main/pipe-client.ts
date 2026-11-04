import net from 'node:net';
import { EventEmitter } from 'node:events';
import {
  createMessage,
  encodeFrame,
  LineFramer,
  PIPE_PATH,
  type AgentStatus,
  type HelloBody,
  type IpcKind,
  type IpcMessage,
  type NotificationBody,
} from '../../../shared/ts/ipc';
import { RequestCorrelator } from './request-correlator';
import { UI_VERSION, type ConnectionListener, type NotificationListener, type ServiceLink, type StatusListener } from './service-link';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const DEFAULT_TIMEOUT_MS = 10000;

type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; debug: (...args: unknown[]) => void };

/**
 * Newline-delimited JSON client for the service's named pipe. Reconnects with exponential
 * backoff, correlates responses by `replyTo`, and re-emits pushed `status` / `notification`
 * / `policy` messages.
 */
export class PipeClient extends EventEmitter implements ServiceLink {
  readonly kind = 'pipe' as const;
  private socket: net.Socket | null = null;
  private connected = false;
  private stopped = false;
  private reconnectDelay = RECONNECT_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly framer: LineFramer;
  private readonly correlator = new RequestCorrelator();

  constructor(
    private readonly pipePath: string = PIPE_PATH,
    private readonly log: Logger = console,
  ) {
    super();
    this.framer = new LineFramer({ onInvalid: (line, error) => this.log.warn('Discarding malformed pipe frame', line.slice(0, 80), error) });
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.destroy();
    this.socket = null;
    this.setConnected(false);
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

  request<T = unknown>(kind: IpcKind, body: unknown = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<IpcMessage<T>> {
    if (!this.socket || !this.connected) {
      return Promise.reject(new Error('Service not reachable'));
    }
    const message = createMessage(kind, body);
    const promise = this.correlator.register(message.id, timeoutMs) as Promise<IpcMessage<T>>;
    this.socket.write(encodeFrame(message), (error) => {
      if (error) {
        this.log.warn('Pipe write failed', error.message);
      }
    });
    return promise;
  }

  private connect(): void {
    if (this.stopped || this.socket) {
      return;
    }
    this.framer.reset();
    const socket = net.connect({ path: this.pipePath });
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      this.reconnectDelay = RECONNECT_MIN_MS;
      this.setConnected(true);
      const hello: HelloBody = { component: 'ui', version: UI_VERSION };
      socket.write(encodeFrame(createMessage('hello', hello)));
      this.log.info('Connected to service pipe', this.pipePath);
    });
    socket.on('data', (chunk: string) => {
      for (const message of this.framer.push(chunk)) {
        this.handle(message);
      }
    });
    socket.on('error', (error) => {
      this.log.debug('Pipe error', error.message);
    });
    socket.on('close', () => {
      this.socket = null;
      const wasConnected = this.connected;
      this.setConnected(false);
      this.correlator.rejectAll(new Error('Service connection closed'));
      if (wasConnected) {
        this.log.warn('Service pipe disconnected');
      }
      this.scheduleReconnect();
    });
  }

  private handle(message: IpcMessage): void {
    if (this.correlator.resolve(message)) {
      return;
    }
    switch (message.kind) {
      case 'status':
        this.emit('status', message.body as AgentStatus);
        break;
      case 'notification':
        this.emit('notification', message.body as NotificationBody);
        break;
      case 'policy':
        this.emit('policy', message.body);
        break;
      case 'hello.ack':
        this.emit('hello', message.body);
        break;
      default:
        this.log.debug('Unhandled pipe message', message.kind);
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return;
    }
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(RECONNECT_MAX_MS, this.reconnectDelay * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setConnected(value: boolean): void {
    if (this.connected !== value) {
      this.connected = value;
      this.emit('connection', value);
    }
  }
}
