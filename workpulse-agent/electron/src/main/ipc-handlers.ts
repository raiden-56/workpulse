import { app, ipcMain, shell, type BrowserWindow } from 'electron';
import type { AgentStatus, Diagnostics, NotificationBody, RegisterResultBody, SyncResultBody } from '../../../shared/ts/ipc';
import { backendReachable, login, normalizeBaseUrl } from './api-client';
import type { SecureStore, AgentSettings } from './secure-store';
import type { ServiceManager } from './service-manager';

export const CHANNELS = {
  getStatus: 'wp:status.get',
  statusPush: 'wp:status',
  notificationPush: 'wp:notification',
  connectionPush: 'wp:connection',
  login: 'wp:login',
  register: 'wp:register',
  breakStart: 'wp:break.start',
  breakEnd: 'wp:break.end',
  syncNow: 'wp:sync.now',
  diagnostics: 'wp:diagnostics',
  settingsGet: 'wp:settings.get',
  settingsSave: 'wp:settings.save',
  openExternal: 'wp:openExternal',
  backendCheck: 'wp:backend.check',
  appInfo: 'wp:app.info',
} as const;

const ALLOWED_EXTERNAL = /^https?:\/\//i;

/** Wires renderer requests (via the preload bridge) to the service link and local stores. */
export function registerIpcHandlers(services: ServiceManager, store: SecureStore, getWindow: () => BrowserWindow | null): void {
  // In-memory only: the JWT lives here between sign-in and registration, then is dropped.
  let pendingAccessToken: string | null = null;

  ipcMain.handle(CHANNELS.getStatus, async (): Promise<AgentStatus> => {
    if (!services.isConnected()) {
      return { ...services.currentStatus(), connection: 'UNKNOWN' };
    }
    try {
      const reply = await services.request<AgentStatus>('status.get');
      return reply.body;
    } catch {
      return services.currentStatus();
    }
  });

  ipcMain.handle(CHANNELS.login, async (_event, payload: { email: string; password: string }) => {
    const settings = store.load();
    const result = await login(settings.apiBaseUrl, String(payload.email ?? ''), String(payload.password ?? ''));
    pendingAccessToken = result.accessToken;
    return { user: result.user };
  });

  ipcMain.handle(CHANNELS.register, async (): Promise<RegisterResultBody> => {
    if (!pendingAccessToken) {
      return { ok: false, error: 'Sign in first' };
    }
    const settings = store.load();
    const token = pendingAccessToken;
    pendingAccessToken = null;
    const reply = await services.request<RegisterResultBody>('register', { accessToken: token, apiBaseUrl: normalizeBaseUrl(settings.apiBaseUrl) }, 30000);
    return reply.body;
  });

  ipcMain.handle(CHANNELS.breakStart, async (_event, note?: string) => (await services.request('break.start', { note: note?.slice(0, 255) })).body);
  ipcMain.handle(CHANNELS.breakEnd, async () => (await services.request('break.end', {})).body);
  ipcMain.handle(CHANNELS.syncNow, async (): Promise<SyncResultBody> => (await services.request<SyncResultBody>('sync.now', {}, 60000)).body);
  ipcMain.handle(CHANNELS.diagnostics, async (): Promise<Diagnostics> => (await services.request<Diagnostics>('diagnostics.get')).body);

  ipcMain.handle(CHANNELS.settingsGet, () => store.load());
  ipcMain.handle(CHANNELS.settingsSave, (_event, partial: Partial<AgentSettings>) => {
    const safe: Partial<AgentSettings> = {};
    if (typeof partial.apiBaseUrl === 'string') {
      safe.apiBaseUrl = normalizeBaseUrl(partial.apiBaseUrl);
    }
    if (partial.theme === 'system' || partial.theme === 'light' || partial.theme === 'dark') {
      safe.theme = partial.theme;
    }
    if (typeof partial.startAtLogin === 'boolean') {
      safe.startAtLogin = partial.startAtLogin;
    }
    if (typeof partial.minimizeToTray === 'boolean') {
      safe.minimizeToTray = partial.minimizeToTray;
    }
    const saved = store.save(safe);
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: saved.startAtLogin, args: ['--hidden'] });
    }
    return saved;
  });

  ipcMain.handle(CHANNELS.backendCheck, async () => backendReachable(store.load().apiBaseUrl));

  ipcMain.handle(CHANNELS.openExternal, async (_event, url: string) => {
    if (typeof url === 'string' && ALLOWED_EXTERNAL.test(url)) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle(CHANNELS.appInfo, () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    serviceLink: services.kind,
    packaged: app.isPackaged,
  }));

  services.on('status', (status: AgentStatus) => getWindow()?.webContents.send(CHANNELS.statusPush, status));
  services.on('notification', (n: NotificationBody) => getWindow()?.webContents.send(CHANNELS.notificationPush, n));
  services.on('connection', (connected: boolean) => getWindow()?.webContents.send(CHANNELS.connectionPush, connected));
}
