import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { loggedOut, userUpdated } from '@/app/store/slices/authSlice';
import { useLazyMeQuery } from '@/services/api/authApi';

/**
 * On start-up, refreshes the stored principal from `GET /auth/me` (roles may have changed) and
 * schedules the automatic end of demo guest sessions.
 */
export function SessionBootstrap() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const guestExpiresAt = useAppSelector((s) => s.auth.user?.guestExpiresAt ?? null);
  const [fetchMe] = useLazyMeQuery();

  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) {
      return;
    }
    fetchMe()
      .unwrap()
      .then((me) => dispatch(userUpdated(me)))
      .catch(() => {
        // a 401 is handled by the HTTP layer (session expiry); other errors keep the cached principal
      });
  }, [status, accessToken, fetchMe, dispatch]);

  useEffect(() => {
    if (!guestExpiresAt) {
      return undefined;
    }
    const remaining = new Date(guestExpiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      dispatch(loggedOut({ reason: 'guest-expired' }));
      return undefined;
    }
    const handle = window.setTimeout(() => dispatch(loggedOut({ reason: 'guest-expired' })), Math.min(remaining, 2_147_000_000));
    return () => window.clearTimeout(handle);
  }, [guestExpiresAt, dispatch]);

  return null;
}
