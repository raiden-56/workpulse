import type { ApiError } from '@/types/api';

export interface ApiQueryError {
  status: number;
  data?: ApiError;
}

export function isApiQueryError(value: unknown): value is ApiQueryError {
  return typeof value === 'object' && value !== null && 'status' in value;
}

export function getApiError(value: unknown): ApiError | undefined {
  if (isApiQueryError(value)) {
    return value.data;
  }
  return undefined;
}

const FRIENDLY: Record<string, string> = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  ACCOUNT_SUSPENDED: 'This account is suspended or not yet activated. Contact your administrator.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  TOKEN_REUSED: 'Your session was invalidated for security reasons. Please sign in again.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'The requested record could not be found.',
  CONFLICT: 'This conflicts with existing data.',
  VALIDATION_ERROR: 'Some fields need attention.',
  GUEST_EXPIRED: 'The demo session has ended.',
  DEVICE_REVOKED: 'This device has been revoked.',
  INTERNAL_ERROR: 'Something went wrong on the server. Please try again.',
};

export function errorMessage(value: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const api = getApiError(value);
  if (api) {
    if (api.details && api.details.length > 0) {
      return api.details.map((d) => `${d.field}: ${d.message}`).join(', ');
    }
    return FRIENDLY[api.code] ?? api.message ?? fallback;
  }
  if (isApiQueryError(value) && value.status === 0) {
    return 'Cannot reach the WorkPulse API. Check your connection and try again.';
  }
  if (value instanceof Error) {
    return value.message;
  }
  return fallback;
}
