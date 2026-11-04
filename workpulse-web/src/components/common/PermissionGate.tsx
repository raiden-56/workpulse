import type { PropsWithChildren, ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGateProps {
  /** Any of these permissions is enough. */
  permission: string | readonly string[];
  /** Also require the principal not to be a guest (for write actions). */
  write?: boolean;
  fallback?: ReactNode;
}

/** Renders children only when the signed-in principal holds one of the permissions. */
export function PermissionGate({ permission, write, fallback = null, children }: PropsWithChildren<PermissionGateProps>) {
  const { can, canWrite } = usePermission();
  const allowed = write ? canWrite(permission) : can(permission);
  return <>{allowed ? children : fallback}</>;
}
