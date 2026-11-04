import type { AuthTokensResponse } from '@/types/auth';

export type SessionExpiryReason = 'expired' | 'guest-expired' | 'revoked';

/**
 * Decouples the HTTP layer from the Redux store: the store registers these callbacks at creation,
 * the axios interceptors call them. Avoids a circular import between store and http client.
 */
export interface AuthBridge {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  getOrganizationOverride: () => string | null;
  isGuest: () => boolean;
  onTokensRefreshed: (tokens: AuthTokensResponse) => void;
  onSessionExpired: (reason: SessionExpiryReason) => void;
}

const noop: AuthBridge = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  getOrganizationOverride: () => null,
  isGuest: () => false,
  onTokensRefreshed: () => undefined,
  onSessionExpired: () => undefined,
};

let current: AuthBridge = noop;

export function configureAuthBridge(bridge: AuthBridge): void {
  current = bridge;
}

export function authBridge(): AuthBridge {
  return current;
}
