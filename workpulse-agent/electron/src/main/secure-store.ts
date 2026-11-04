import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentSettings } from '../../../shared/ts/bridge';

export type { AgentSettings } from '../../../shared/ts/bridge';

export const DEFAULT_SETTINGS: AgentSettings = {
  apiBaseUrl: 'http://localhost:8080',
  theme: 'system',
  startAtLogin: true,
  minimizeToTray: true,
};

/**
 * Small settings store encrypted with Electron's safeStorage (DPAPI on Windows, current user).
 * Only UI preferences live here. Credentials and the device token are never stored by the UI:
 * the user JWT is kept in memory for the registration hand-off, the device token lives in the
 * service (machine-scope DPAPI).
 */
export class SecureStore {
  private readonly file: string;
  private cache: AgentSettings | null = null;

  constructor(directory: string = app.getPath('userData')) {
    this.file = path.join(directory, 'settings.bin');
  }

  load(): AgentSettings {
    if (this.cache) {
      return this.cache;
    }
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file);
        const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
        this.cache = { ...DEFAULT_SETTINGS, ...(JSON.parse(json) as Partial<AgentSettings>) };
        return this.cache;
      }
    } catch (error) {
      console.warn('Could not read settings; using defaults', error);
    }
    this.cache = { ...DEFAULT_SETTINGS };
    return this.cache;
  }

  save(settings: Partial<AgentSettings>): AgentSettings {
    const merged: AgentSettings = { ...this.load(), ...settings };
    const json = JSON.stringify(merged);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8');
    fs.writeFileSync(this.file, data);
    this.cache = merged;
    return merged;
  }
}
