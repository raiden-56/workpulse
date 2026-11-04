import type { MeResponse } from '@/types/auth';

export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  user: MeResponse;
  organizationOverride: string | null;
}

const KEY = 'workpulse.session';

export function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.accessToken || !parsed.user) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user,
      organizationOverride: parsed.organizationOverride ?? null,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(KEY, JSON.stringify(session));
    }
  } catch {
    // storage unavailable (private mode, quota); the session simply lives in memory
  }
}

export function clearSession(): void {
  saveSession(null);
}
