import { contextBridge, ipcRenderer } from 'electron';
import type { WorkPulseBridge } from '../../../shared/ts/bridge';

// Channel names are duplicated here (not imported from the main process) so the sandboxed
// preload has no module dependencies beyond `electron`.
const C = {
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

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

/** The only surface the renderer can reach (typed by shared/ts/bridge.ts). */
const bridge: WorkPulseBridge = {
  getStatus: () => ipcRenderer.invoke(C.getStatus),
  subscribeStatus: (listener) => subscribe(C.statusPush, listener),
  subscribeNotifications: (listener) => subscribe(C.notificationPush, listener),
  subscribeConnection: (listener) => subscribe(C.connectionPush, listener),
  login: (email, password) => ipcRenderer.invoke(C.login, { email, password }),
  register: () => ipcRenderer.invoke(C.register),
  startBreak: (note) => ipcRenderer.invoke(C.breakStart, note),
  endBreak: () => ipcRenderer.invoke(C.breakEnd),
  syncNow: () => ipcRenderer.invoke(C.syncNow),
  getDiagnostics: () => ipcRenderer.invoke(C.diagnostics),
  getSettings: () => ipcRenderer.invoke(C.settingsGet),
  saveSettings: (settings) => ipcRenderer.invoke(C.settingsSave, settings),
  checkBackend: () => ipcRenderer.invoke(C.backendCheck),
  openExternal: (url) => ipcRenderer.invoke(C.openExternal, url),
  appInfo: () => ipcRenderer.invoke(C.appInfo),
};

contextBridge.exposeInMainWorld('workpulse', bridge);
