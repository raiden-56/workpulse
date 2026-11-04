import { Box, Button, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { LiveStatusResponse } from '@/types/activity';
import { KeyValueList } from '@/components/common/Panel';
import { StatusChip } from '@/components/common/StatusChip';
import { ROUTES } from '@/constants/routes';
import { formatDuration, formatRelative, formatTime, todayIso } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { TimelineView } from '../activity/TimelineView';

interface EmployeeDetailDrawerProps {
  row: LiveStatusResponse | null;
  onClose: () => void;
}

export function EmployeeDetailDrawer({ row, onClose }: EmployeeDetailDrawerProps) {
  const { user } = useAuth();
  const tz = user?.organizationTimezone ?? null;
  const [date, setDate] = useState(() => todayIso(tz));

  return (
    <Drawer anchor="right" open={!!row} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%' } } }}>
      {row && (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <div>
              <Typography variant="h4">{row.employeeName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {row.employeeCode} · {row.departmentName ?? '–'}
                {row.teamName ? ` · ${row.teamName}` : ''}
              </Typography>
            </div>
            <IconButton onClick={onClose} aria-label="Close details">
              <CloseIcon />
            </IconButton>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
            <StatusChip kind="activity" value={row.status} reason={row.reason} size="medium" />
            {row.foregroundApp && <Typography variant="body2">{row.foregroundApp}</Typography>}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {row.reason}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <KeyValueList
            items={[
              { label: 'Since', value: row.sinceAt ? formatTime(row.sinceAt, tz) : '–' },
              { label: 'Signed in', value: row.sessionStartedAt ? `${formatTime(row.sessionStartedAt, tz)} (${formatDuration(row.sessionDurationSeconds, { compact: true })})` : 'No active session' },
              { label: 'Device', value: row.deviceName ? <span className="wp-mono">{row.deviceName}</span> : '–' },
              { label: 'Device health', value: row.deviceHealth ? <StatusChip kind="deviceHealth" value={row.deviceHealth} /> : '–' },
              { label: 'Agent version', value: row.agentVersion ? <span className="wp-mono">{row.agentVersion}</span> : '–' },
              { label: 'Last sync', value: formatRelative(row.lastSyncAt) },
            ]}
          />
          <Stack direction="row" spacing={1} sx={{ my: 2 }}>
            <Button component={RouterLink} to={ROUTES.employee(row.employeeId)} size="small" variant="outlined">
              Open profile
            </Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 1 }}>
            Activity timeline
          </Typography>
          <TimelineView employeeId={row.employeeId} date={date} onDateChange={setDate} compact />
        </Box>
      )}
    </Drawer>
  );
}
