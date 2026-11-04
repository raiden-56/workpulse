import { useCallback, useEffect, useState } from 'react';
import type { AgentStatus, NotificationBody } from '@shared/ipc';
import type { AgentSettings, AppInfo } from '@shared/bridge';

export interface UiNotification extends NotificationBody {
  id: number;
  at: string;
  read: boolean;
}

const FALLBACK_STATUS: AgentStatus = {
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
  version: '1.0.0',
  serviceVersion: 'unknown',
  apiBaseUrl: '',
};

export function useAgent() {
  const [status, setStatus] = useState<AgentStatus>(FALLBACK_STATUS);
  const [connected, setConnected] = useState(false);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [notifications, setNotifications] = useState<UiNotification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const next = await window.workpulse.getStatus();
      setStatus(next);
    } catch {
      // keep the last snapshot; the banner shows "service not reachable" through `connected`
    }
  }, []);

  useEffect(() => {
    void refresh();
    void window.workpulse.getSettings().then(setSettings);
    void window.workpulse.appInfo().then(setAppInfo);
    const offStatus = window.workpulse.subscribeStatus((next) => {
      setStatus(next);
      setConnected(true);
    });
    const offNotification = window.workpulse.subscribeNotifications((n) =>
      setNotifications((list) => [{ ...n, id: Date.now() + Math.random(), at: new Date().toISOString(), read: false }, ...list].slice(0, 50)),
    );
    const offConnection = window.workpulse.subscribeConnection((value) => {
      setConnected(value);
      if (value) {
        void refresh();
      }
    });
    const poll = setInterval(() => void refresh(), 30000);
    return () => {
      offStatus();
      offNotification();
      offConnection();
      clearInterval(poll);
    };
  }, [refresh]);

  const saveSettings = useCallback(async (partial: Partial<AgentSettings>) => {
    const saved = await window.workpulse.saveSettings(partial);
    setSettings(saved);
    return saved;
  }, []);

  const markAllRead = useCallback(() => setNotifications((list) => list.map((n) => ({ ...n, read: true }))), []);

  return { status, connected, settings, appInfo, notifications, refresh, saveSettings, markAllRead };
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) {
    return '0m';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
