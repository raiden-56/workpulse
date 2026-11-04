import { Box, CircularProgress } from '@mui/material';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermission } from '@/hooks/usePermission';
import { ROUTES } from '@/constants/routes';

export function FullScreenLoader() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading">
      <CircularProgress />
    </Box>
  );
}

export function RequireAuth({ children }: PropsWithChildren) {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();
  if (status === 'restoring') {
    return <FullScreenLoader />;
  }
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

export function RequireAnonymous({ children }: PropsWithChildren) {
  const { status, isAuthenticated } = useAuth();
  if (status === 'restoring') {
    return <FullScreenLoader />;
  }
  if (isAuthenticated) {
    return <Navigate to={ROUTES.root} replace />;
  }
  return <>{children}</>;
}

interface RequirePermissionProps {
  permission: string | readonly string[];
}

export function RequirePermission({ permission, children }: PropsWithChildren<RequirePermissionProps>) {
  const { can } = usePermission();
  if (!can(permission)) {
    return <Navigate to={ROUTES.forbidden} replace />;
  }
  return <>{children}</>;
}
