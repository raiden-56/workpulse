import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import type { FormEventHandler, PropsWithChildren, ReactNode } from 'react';
import { errorMessage } from '@/utils/errors';

interface FormDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  submitLabel?: string;
  submitting?: boolean;
  error?: unknown;
  maxWidth?: 'xs' | 'sm' | 'md';
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  extraActions?: ReactNode;
}

export function FormDialog({ open, title, description, submitLabel = 'Save', submitting, error, maxWidth = 'sm', onClose, onSubmit, extraActions, children }: PropsWithChildren<FormDialogProps>) {
  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth={maxWidth} fullWidth aria-labelledby="form-dialog-title">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle id="form-dialog-title">{title}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {description}
          {error ? <Alert severity="error">{errorMessage(error)}</Alert> : null}
          {children}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {extraActions}
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
