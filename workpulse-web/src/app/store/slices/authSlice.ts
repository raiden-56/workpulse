import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthTokensResponse, MeResponse } from '@/types/auth';
import type { StoredSession } from '@/services/session';
import type { SessionExpiryReason } from '@/services/authBridge';

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

export interface AuthState {
  status: AuthStatus;
  user: MeResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Organisation selected by a super admin (sent as X-Organization-Id). */
  organizationOverride: string | null;
  /** One-shot message shown on the login page (e.g. "demo session ended"). */
  notice: string | null;
}

export const initialAuthState: AuthState = {
  status: 'restoring',
  user: null,
  accessToken: null,
  refreshToken: null,
  organizationOverride: null,
  notice: null,
};

const EXPIRY_NOTICES: Record<SessionExpiryReason, string> = {
  expired: 'Your session has expired. Please sign in again.',
  'guest-expired': 'Your demo session has ended. Start a new guest session to keep exploring.',
  revoked: 'Your session was invalidated for security reasons. Please sign in again.',
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    sessionRestored(state, action: PayloadAction<StoredSession | null>) {
      if (!action.payload) {
        state.status = 'anonymous';
        return;
      }
      state.status = 'authenticated';
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.organizationOverride = action.payload.organizationOverride;
    },
    loggedIn(state, action: PayloadAction<AuthTokensResponse>) {
      state.status = 'authenticated';
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? null;
      state.organizationOverride = null;
      state.notice = null;
    },
    tokensRefreshed(state, action: PayloadAction<AuthTokensResponse>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? state.refreshToken;
      state.user = action.payload.user;
      state.status = 'authenticated';
    },
    userUpdated(state, action: PayloadAction<MeResponse>) {
      state.user = action.payload;
    },
    organizationSelected(state, action: PayloadAction<string | null>) {
      state.organizationOverride = action.payload;
    },
    loggedOut(state, action: PayloadAction<{ reason?: SessionExpiryReason; notice?: string } | undefined>) {
      state.status = 'anonymous';
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.organizationOverride = null;
      state.notice = action.payload?.notice ?? (action.payload?.reason ? EXPIRY_NOTICES[action.payload.reason] : null);
    },
    noticeCleared(state) {
      state.notice = null;
    },
  },
});

export const { sessionRestored, loggedIn, tokensRefreshed, userUpdated, organizationSelected, loggedOut, noticeCleared } =
  authSlice.actions;

export const authReducer = authSlice.reducer;
