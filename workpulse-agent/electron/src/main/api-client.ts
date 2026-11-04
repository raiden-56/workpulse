/**
 * Minimal backend client for the UI. The only thing the UI talks to the backend for is the
 * employee sign-in that produces the short-lived JWT handed to the service for device
 * registration. The JWT is never written to disk by the UI.
 */

export interface LoginResult {
  accessToken: string;
  user: {
    userId: string;
    email: string;
    displayName: string;
    organizationName: string | null;
    employeeId: string | null;
    demoOrganization: boolean;
  };
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

export function normalizeBaseUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new ApiError('INVALID_URL', 'API base URL must start with http:// or https://', 0);
  }
  return trimmed;
}

export async function login(apiBaseUrl: string, email: string, password: string): Promise<LoginResult> {
  const base = normalizeBaseUrl(apiBaseUrl);
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    throw new ApiError('NETWORK', `Cannot reach ${base}: ${(error as Error).message}`, 0);
  }
  const envelope = (await response.json().catch(() => ({}))) as ApiEnvelope<{ accessToken: string; user: LoginResult['user'] }>;
  if (!response.ok || !envelope.success || !envelope.data) {
    throw new ApiError(envelope.error?.code ?? 'HTTP_' + response.status, envelope.error?.message ?? `Sign-in failed (${response.status})`, response.status);
  }
  return { accessToken: envelope.data.accessToken, user: envelope.data.user };
}

export async function backendReachable(apiBaseUrl: string): Promise<boolean> {
  try {
    const base = normalizeBaseUrl(apiBaseUrl);
    const response = await fetch(`${base}/actuator/health/liveness`, { method: 'GET', signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}
