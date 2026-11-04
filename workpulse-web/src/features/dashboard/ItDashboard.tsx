import { Button, Chip, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useApproveDeviceMutation, useDeviceSummaryQuery, useDevicesQuery } from '@/services/api/devicesApi';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { StatCard } from '@/components/common/StatCard';
import { StatusChip } from '@/components/common/StatusChip';
import { P } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { formatRelative } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';

export function ItDashboard() {
  const { user } = useAuth();
  const summary = useDeviceSummaryQuery(undefined, { pollingInterval: 60_000 });
  const attention = useDevicesQuery({ size: 10, sort: 'lastSeenAt,asc', status: 'APPROVED' });
  const pending = useDevicesQuery({ status: 'PENDING', size: 10 });
  const all = useDevicesQuery({ size: 200 });
  const [approve, approveState] = useApproveDeviceMutation();

  const versions = (all.data?.items ?? []).reduce<Record<string, number>>((acc, d) => {
    const v = d.agentVersion ?? 'unknown';
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="IT dashboard"
        subtitle="Device inventory, agent health and approvals. Agent version management and remote diagnostics arrive in Phase 5."
        eyebrow={user?.organizationName ?? undefined}
        actions={
          <Button component={RouterLink} to={ROUTES.devices} variant="outlined" size="small">
            Device inventory
          </Button>
        }
      />
      {summary.error ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} /> : null}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Registered devices" value={s?.total ?? 0} hint={s ? `${s.approved} approved` : undefined} loading={summary.isLoading} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Connected" value={s?.connected ?? 0} hint={s ? `${s.disconnected} disconnected` : undefined} tone="positive" loading={summary.isLoading} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Degraded / offline" value={s ? s.degraded + s.offline : 0} hint={s ? `${s.degraded} degraded · ${s.offline} offline` : undefined} tone="warning" loading={summary.isLoading} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Pending approval" value={s?.pending ?? 0} hint={s ? `${s.revoked} revoked` : undefined} tone={s?.pending ? 'critical' : 'neutral'} loading={summary.isLoading} />
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Panel title="Devices needing attention" subtitle="Approved devices ordered by last contact" padded={false} actions={<Button size="small" component={RouterLink} to={`${ROUTES.devices}?health=OFFLINE`}>View all</Button>}>
            {attention.isLoading && <LoadingSkeleton variant="table" rows={5} />}
            {attention.data && attention.data.items.length === 0 && <EmptyState compact title="No approved devices yet" />}
            {attention.data && attention.data.items.length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Device</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Health</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell>Last seen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attention.data.items.map((d) => (
                    <TableRow key={d.id} hover>
                      <TableCell className="wp-mono">{d.hostname}</TableCell>
                      <TableCell>{d.employeeName ?? <Typography variant="caption" color="text.secondary">Unassigned</Typography>}</TableCell>
                      <TableCell>
                        <StatusChip kind="deviceHealth" value={d.health} />
                      </TableCell>
                      <TableCell className="wp-mono">{d.agentVersion ?? '–'}</TableCell>
                      <TableCell>{formatRelative(d.lastSeenAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <Panel title="Pending approvals" subtitle="Registered by employees, awaiting IT approval">
              {pending.data && pending.data.items.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No devices are waiting for approval.
                </Typography>
              )}
              <Stack spacing={1}>
                {(pending.data?.items ?? []).map((d) => (
                  <Stack key={d.id} direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                    <div>
                      <Typography variant="body2" className="wp-mono">
                        {d.hostname}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {d.employeeName ?? 'Unassigned'} · registered {formatRelative(d.registeredAt)}
                      </Typography>
                    </div>
                    <PermissionGate permission={P.DEVICE_APPROVE} write>
                      <Button size="small" variant="outlined" onClick={() => approve(d.id)} disabled={approveState.isLoading}>
                        Approve
                      </Button>
                    </PermissionGate>
                  </Stack>
                ))}
              </Stack>
            </Panel>
            <Panel title="Agent versions" subtitle={all.data ? `Across ${all.data.items.length} devices` : undefined}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {Object.entries(versions)
                  .sort((a, b) => b[1] - a[1])
                  .map(([v, n]) => (
                    <Chip key={v} label={`${v} · ${n}`} variant="outlined" size="small" className="wp-mono" />
                  ))}
                {Object.keys(versions).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No agents have reported yet.
                  </Typography>
                )}
              </Stack>
            </Panel>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
