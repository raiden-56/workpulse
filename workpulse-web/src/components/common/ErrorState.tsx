import { Alert, AlertTitle, Button } from '@mui/material';
import { errorMessage, getApiError } from '@/utils/errors';

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({ error, title = 'Could not load this view', onRetry }: ErrorStateProps) {
  const api = getApiError(error);
  return (
    <Alert
      severity="error"
      role="alert"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
      sx={{ my: 1 }}
    >
      <AlertTitle>{title}</AlertTitle>
      {errorMessage(error)}
      {api?.traceId && (
        <span className="wp-mono" style={{ display: 'block', marginTop: 4, opacity: 0.7 }}>
          trace {api.traceId}
        </span>
      )}
    </Alert>
  );
}
