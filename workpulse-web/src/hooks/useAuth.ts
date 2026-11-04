import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { loggedOut, organizationSelected } from '@/app/store/slices/authSlice';
import { baseApi } from '@/services/api/baseApi';
import { useLogoutMutation } from '@/services/api/authApi';
import { useEndGuestSessionMutation } from '@/services/api/guestApi';
import { dashboardKindFor, isDemoGuest, isGuest, isSuperAdmin, primaryRole } from '@/constants/roles';

export function useAuth() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const [logoutRequest] = useLogoutMutation();
  const [endGuest] = useEndGuestSessionMutation();

  const signOut = useCallback(
    async (notice?: string) => {
      try {
        if (auth.user?.guestType) {
          await endGuest().unwrap();
        } else if (auth.accessToken) {
          await logoutRequest({ refreshToken: auth.refreshToken }).unwrap();
        }
      } catch {
        // the server-side session may already be gone; always clear locally
      } finally {
        dispatch(loggedOut(notice ? { notice } : undefined));
        dispatch(baseApi.util.resetApiState());
      }
    },
    [auth.accessToken, auth.refreshToken, auth.user?.guestType, dispatch, endGuest, logoutRequest],
  );

  const selectOrganization = useCallback(
    (organizationId: string | null) => {
      dispatch(organizationSelected(organizationId));
      dispatch(baseApi.util.resetApiState());
    },
    [dispatch],
  );

  const user = auth.user;
  return {
    status: auth.status,
    user,
    accessToken: auth.accessToken,
    organizationOverride: auth.organizationOverride,
    notice: auth.notice,
    isAuthenticated: auth.status === 'authenticated' && !!user,
    isSuperAdmin: isSuperAdmin(user),
    isGuest: isGuest(user),
    isDemoGuest: isDemoGuest(user),
    primaryRole: primaryRole(user),
    dashboardKind: dashboardKindFor(user, auth.organizationOverride),
    /** Organisation the UI is currently showing data for. */
    effectiveOrganizationId: auth.organizationOverride ?? user?.organizationId ?? null,
    signOut,
    selectOrganization,
  };
}
