/**
 * The `window.workpulse` API exposed by the Electron preload to the renderer. No Electron
 * imports here so the renderer can type-check against it without pulling in Node types.
 */
import type { AgentStatus, Diagnostics, NotificationBody, RegisterResultBody, SyncResultBody } from './ipc';

export interface AgentSettings {
  apiBaseUrl: string;
  theme: 'system' | 'light' | 'dark';
  startAtLogin: boolean;
  minimizeToTray: boolean;
}

export interface LoginUser {
  userId: string;
  email: string;
  displayName: string;
  organizationName: string | null;
  employeeId: string | null;
  demoOrganization: boolean;
}

export interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  serviceLink: 'pipe' | 'mock';
  packaged: boolean;
}

export interface WorkPulseBridge {
  getStatus(): Promise<AgentStatus>;
  subscribeStatus(listener: (status: AgentStatus) => void): () => void;
  subscribeNotifications(listener: (notification: NotificationBody) => void): () => void;
  subscribeConnection(listener: (connected: boolean) => void): () => void;
  login(email: string, password: string): Promise<{ user: LoginUser }>;
  register(): Promise<RegisterResultBody>;
  startBreak(note?: string): Promise<{ ok: boolean; error?: string }>;
  endBreak(): Promise<{ ok: boolean; error?: string }>;
  syncNow(): Promise<SyncResultBody>;
  getDiagnostics(): Promise<Diagnostics>;
  getSettings(): Promise<AgentSettings>;
  saveSettings(settings: Partial<AgentSettings>): Promise<AgentSettings>;
  checkBackend(): Promise<boolean>;
  openExternal(url: string): Promise<boolean>;
  appInfo(): Promise<AppInfo>;
}
