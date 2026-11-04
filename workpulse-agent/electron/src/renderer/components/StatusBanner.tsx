import { Box, Chip, Stack, Typography } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import type { AgentStatus } from '@shared/ipc';
import { formatTime } from '../hooks/useAgent';

export interface BannerState {
  label: string;
  detail: string;
  color: 'success' | 'warning' | 'error' | 'info' | 'default';
}

/** Single source of truth for how the monitoring state is described to the employee. */
export function describeMonitoring(status: AgentStatus, connected: boolean): BannerState {
  if (!connected) {
    return { label: 'Service not reachable', detail: 'The WorkPulse background service is not running or cannot be contacted. Nothing is being collected.', color: 'error' };
  }
  switch (status.monitoring) {
    case 'ACTIVE':
      return status.onBreak
        ? { label: 'On break', detail: 'You declared a break. Application sampling is paused until you end it.', color: 'warning' }
        : { label: 'Monitoring active', detail: `Foreground application, idle time and session state are being recorded${status.currentApp ? ` · now: ${status.currentApp.appName}` : ''}.`, color: 'success' };
    case 'PAUSED_OUTSIDE_WINDOW':
      return { label: 'Paused – outside working hours', detail: 'Only session sign-in / sign-out is tracked outside the collection window defined by your organisation.', color: 'warning' };
    case 'STOPPED':
      return { label: 'Monitoring stopped', detail: 'The activity collector is not running in your session. Nothing is being collected.', color: 'error' };
    case 'REVOKED':
      return { label: 'Device revoked', detail: 'Your IT administrator revoked this device. Collection has stopped; contact IT to re-enable it.', color: 'error' };
    case 'PENDING_APPROVAL':
      return { label: 'Awaiting IT approval', detail: 'The device is registered. Events are stored locally until an administrator approves it.', color: 'info' };
    default:
      return { label: 'Not registered', detail: 'Sign in and register this device to start. Nothing is collected before registration.', color: 'default' };
  }
}

export function StatusBanner({ status, connected, serviceLink }: { status: AgentStatus; connected: boolean; serviceLink: 'pipe' | 'mock' | null }) {
  const state = describeMonitoring(status, connected);
  const mock = status.mock || serviceLink === 'mock';
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={(theme) => ({
        px: 3,
        py: 1.25,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      })}
    >
      <CircleIcon color={state.color === 'default' ? 'disabled' : state.color} sx={{ fontSize: 14 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2">{state.label}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap title={state.detail}>
          {state.detail}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {mock && <Chip size="small" color="warning" variant="outlined" label="Mock service (development)" />}
        {status.registered && (
          <Chip size="small" variant="outlined" label={status.connection === 'ONLINE' ? `Synced ${formatTime(status.lastSyncAt)}` : status.connection === 'REVOKED' ? 'Revoked' : 'Offline · buffering'} />
        )}
        {status.queueDepth > 0 && <Chip size="small" variant="outlined" label={`${status.queueDepth} queued`} />}
      </Stack>
    </Box>
  );
}
