import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import type { LiveStatusDelta } from '@/types/activity';

export interface LiveSocketOptions {
  token: string;
  organizationId: string;
  onDelta: (delta: LiveStatusDelta) => void;
  onStateChange?: (connected: boolean) => void;
}

export function wsBaseUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws/websocket`;
}

/**
 * Subscribes to the organisation's live topic. Any failure is swallowed: the caller keeps polling.
 * Returns a disposer.
 */
export function connectLiveSocket(options: LiveSocketOptions): () => void {
  let subscription: StompSubscription | null = null;
  let disposed = false;
  const client = new Client({
    brokerURL: wsBaseUrl(),
    connectHeaders: { Authorization: `Bearer ${options.token}` },
    reconnectDelay: 10_000,
    heartbeatIncoming: 20_000,
    heartbeatOutgoing: 20_000,
    debug: () => undefined,
    onConnect: () => {
      if (disposed) {
        return;
      }
      options.onStateChange?.(true);
      subscription = client.subscribe(`/topic/org.${options.organizationId}.live`, (message: IMessage) => {
        try {
          options.onDelta(JSON.parse(message.body) as LiveStatusDelta);
        } catch {
          // malformed payload: ignore, polling will reconcile
        }
      });
    },
    onDisconnect: () => options.onStateChange?.(false),
    onWebSocketClose: () => options.onStateChange?.(false),
    onStompError: () => options.onStateChange?.(false),
    onWebSocketError: () => options.onStateChange?.(false),
  });
  try {
    client.activate();
  } catch {
    options.onStateChange?.(false);
  }
  return () => {
    disposed = true;
    try {
      subscription?.unsubscribe();
      void client.deactivate();
    } catch {
      // ignore
    }
  };
}
