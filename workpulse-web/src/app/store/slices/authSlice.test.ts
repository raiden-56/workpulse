import { describe, expect, it } from 'vitest';
import { authReducer, initialAuthState, loggedIn, loggedOut, noticeCleared, organizationSelected, sessionRestored, tokensRefreshed } from './authSlice';
import { makeUser } from '@/test/testUtils';

const tokens = { accessToken: 'a1', refreshToken: 'r1', tokenType: 'Bearer', expiresIn: 900, user: makeUser() };

describe('authSlice', () => {
  it('starts restoring and becomes anonymous when no session is stored', () => {
    expect(initialAuthState.status).toBe('restoring');
    const state = authReducer(initialAuthState, sessionRestored(null));
    expect(state.status).toBe('anonymous');
    expect(state.user).toBeNull();
  });

  it('restores a stored session including the organisation override', () => {
    const state = authReducer(initialAuthState, sessionRestored({ accessToken: 'a', refreshToken: null, user: makeUser(), organizationOverride: 'org-9' }));
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('a');
    expect(state.organizationOverride).toBe('org-9');
  });

  it('stores tokens and user on login and clears any notice', () => {
    const withNotice = { ...initialAuthState, notice: 'old notice' };
    const state = authReducer(withNotice, loggedIn(tokens));
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('a1');
    expect(state.refreshToken).toBe('r1');
    expect(state.user?.email).toBe('user@example.com');
    expect(state.notice).toBeNull();
  });

  it('keeps the previous refresh token when a refresh does not return one', () => {
    const loggedInState = authReducer(initialAuthState, loggedIn(tokens));
    const state = authReducer(loggedInState, tokensRefreshed({ ...tokens, accessToken: 'a2', refreshToken: null }));
    expect(state.accessToken).toBe('a2');
    expect(state.refreshToken).toBe('r1');
  });

  it('clears everything on logout and records the expiry reason as a notice', () => {
    const loggedInState = authReducer(initialAuthState, loggedIn({ ...tokens, user: makeUser({ guestType: 'DEMO' }) }));
    const state = authReducer(loggedInState, loggedOut({ reason: 'guest-expired' }));
    expect(state.status).toBe('anonymous');
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.notice).toMatch(/demo session has ended/i);
    expect(authReducer(state, noticeCleared()).notice).toBeNull();
  });

  it('tracks the organisation selected by a super admin', () => {
    const state = authReducer(authReducer(initialAuthState, loggedIn(tokens)), organizationSelected('org-2'));
    expect(state.organizationOverride).toBe('org-2');
    expect(authReducer(state, organizationSelected(null)).organizationOverride).toBeNull();
  });
});
