import { Button } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ROUTES } from '@/constants/routes';

export function ForbiddenPage() {
  return (
    <EmptyState
      icon={<LockOutlinedIcon />}
      title="You do not have access to this page"
      description="Your role does not include the permission required here. If you believe this is a mistake, contact your organisation administrator."
      action={
        <Button component={RouterLink} to={ROUTES.root} variant="contained">
          Back to dashboard
        </Button>
      }
    />
  );
}

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<SearchOffOutlinedIcon />}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={
        <Button component={RouterLink} to={ROUTES.root} variant="contained">
          Back to dashboard
        </Button>
      }
    />
  );
}
