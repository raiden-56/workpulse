import { useCallback } from 'react';
import { useAppSelector } from '@/app/store/hooks';
import { hasAll, hasAny } from '@/constants/permissions';

/** Permission checks driven by the permissions carried in the signed-in principal. */
export function usePermission() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions);
  const isGuest = useAppSelector((s) => !!s.auth.user?.guestType);

  const can = useCallback((required: string | readonly string[] | undefined) => hasAny(permissions, required), [permissions]);
  const canAll = useCallback((required: readonly string[]) => hasAll(permissions, required), [permissions]);
  /** Write actions are never available to guests, whatever permissions the token carries. */
  const canWrite = useCallback((required: string | readonly string[]) => !isGuest && hasAny(permissions, required), [isGuest, permissions]);

  return { can, canAll, canWrite, permissions: permissions ?? [], isGuest };
}
