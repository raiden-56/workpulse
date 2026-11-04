import { Alert, Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useMyDashboardQuery } from '@/services/api/dashboardApi';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { StatusChip } from '@/components/common/StatusChip';
import { ROUTES } from '@/constants/routes';
import { formatDuration, formatRelative, formatTime } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { TimelineView, summaryTiles } from '../activity/TimelineView';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const me = useMyDashboardQuery(undefined, { pollingInterval: 60_000 });

  if (me.isLoading) {
    return <LoadingSkeleton variant="page" />;
  }
  if (me.error) {
    return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  }
  const d = me.data;
  if (!d || !d.hasEmployeeProfile || !d.employee) {
    return (
      <>
        <PageHeader title={`Welcome, ${user?.displayName ?? ''}`} subtitle="Your personal dashboard." />
        <EmptyState
          title="No employee profile is linked to your account"
          description="Personal activity, attendance and device information appear here once an administrator links your account to an employee record."
        />
      </>
    );
  }
  const status = d.status;
  const today = d.today;

  return (
    <>
      <PageHeader
        title={`Hello, ${d.employee.fullName.split(' ')[0]}`}
        subtitle={`${d.employee.designation ?? ''}${d.employee.teamName ? ` · ${d.employee.teamName}` : ''}${d.employee.departmentName ? ` · ${d.employee.departmentName}` : ''}`}
        eyebrow={`Today · ${d.date} · ${d.timezone}`}
        actions={
          <Button component={RouterLink} to={ROUTES.privacy} variant="outlined" size="small">
            What is collected about me
          </Button>
        }
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Panel title="Current status">
            {status ? (
              <Stack spacing={1}>
                <Box>
                  <StatusChip kind="activity" value={status.status} reason={status.reason} size="medium" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {status.reason ?? 'No agent data yet.'}
                </Typography>
                {status.foregroundApp && (
                  <Typography variant="body2">
                    Foreground: <strong>{status.foregroundApp}</strong>
                  </Typography>
                )}
                <KeyValueList
                  items={[
                    { label: 'Signed in', value: status.sessionStartedAt ? formatTime(status.sessionStartedAt, d.timezone) : '–' },
                    { label: 'Session', value: status.sessionDurationSeconds ? formatDuration(status.sessionDurationSeconds, { compact: true }) : '–' },
                    { label: 'Device', value: status.deviceName ?? '–' },
                    { label: 'Last sync', value: formatRelative(status.lastSyncAt) },
                  ]}
                />
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No status yet.
              </Typography>
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Panel title="Today at a glance" subtitle="Attendance duration is separate from active application engagement">
            {today ? (
              <Grid container spacing={1}>
                {summaryTiles(today).map((t) => (
                  <Grid key={t.label} size={{ xs: 6, sm: 4, md: 'grow' }}>
                    <Box sx={{ p: 1.25, border: '1px solid var(--wp-border)', borderRadius: 1.5, borderLeft: `3px solid ${t.color}` }}>
                      <Typography variant="caption" color="text.secondary">
                        {t.label}
                      </Typography>
                      <Typography variant="subtitle1" className="wp-tabular">
                        {formatDuration(t.value, { compact: true })}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No activity recorded today.
              </Typography>
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Panel title="Today's timeline" subtitle="Every interval shows why it was classified that way">
            <TimelineView date={d.date} showIntervals={false} compact />
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Applications today">
            <HorizontalBarChart ariaLabel="My foreground time per application today" data={d.topApplicationsToday.map((a) => ({ key: a.processName, label: a.appName ?? a.processName, seconds: a.durationSeconds, category: a.category }))} />
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Last 7 days" subtitle="Foreground hours per day">
            <TrendLineChart data={d.weekly} showEmployees={false} height={220} />
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="My devices">
            {d.devices.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No device is registered for you yet. Install the WorkPulse agent and sign in to register this workstation.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {d.devices.map((dev) => (
                  <Stack key={dev.id} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <div>
                      <Typography variant="body2" className="wp-mono">
                        {dev.hostname}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Agent {dev.agentVersion ?? '–'} · synced {formatRelative(dev.lastSyncAt)}
                      </Typography>
                    </div>
                    <Stack direction="row" spacing={0.5}>
                      <StatusChip kind="deviceStatus" value={dev.status} />
                      <StatusChip kind="deviceHealth" value={dev.health} />
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Monitoring policy" subtitle={d.policy ? `${d.policy.name} · v${d.policy.version} · resolved from ${d.policy.resolvedFrom.toLowerCase()}` : undefined}>
            {d.policy ? (
              <Stack spacing={1.5}>
                <Alert severity="info" variant="outlined" icon={false}>
                  {d.policy.employeeNotice ?? 'Application usage and idle time are recorded during working hours.'}
                </Alert>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {d.policy.dataCategories.map((c) => (
                    <Chip key={c} size="small" label={c.replace(/_/g, ' ').toLowerCase()} />
                  ))}
                </Stack>
                <KeyValueList
                  items={[
                    { label: 'Sampling', value: `every ${d.policy.samplingIntervalSeconds}s` },
                    { label: 'Idle threshold', value: formatDuration(d.policy.idleThresholdSeconds, { compact: true }) },
                    { label: 'Window titles', value: d.policy.collectWindowTitles ? 'collected (hashed)' : 'not collected' },
                    { label: 'Retention', value: `${d.policy.retentionDays} days` },
                  ]}
                />
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No policy resolved.
              </Typography>
            )}
          </Panel>
        </Grid>
      </Grid>
    </>
  );
}
