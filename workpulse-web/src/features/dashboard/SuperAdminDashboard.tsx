import { Alert, Button, Chip, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useOrganizationsQuery, useSystemHealthQuery } from '@/services/api/organizationApi';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { StatusChip } from '@/components/common/StatusChip';
import { ROUTES } from '@/constants/routes';
import { formatDuration } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';

export function SuperAdminDashboard() {
  const { selectOrganization } = useAuth();
  const orgs = useOrganizationsQuery();
  const health = useSystemHealthQuery(undefined, { pollingInterval: 30_000 });

  return (
    <>
      <PageHeader
        title="Platform administration"
        subtitle="Organisations hosted on this WorkPulse deployment and platform health. Select an organisation to open its dashboards."
        actions={
          <Button component={RouterLink} to={ROUTES.organizations} variant="contained" size="small">
            Manage organisations
          </Button>
        }
      />
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        As a super admin you are not inside any organisation. Choose one below (or in the top bar) to view its employees, devices and activity with your global permissions.
      </Alert>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Panel title="Organisations" padded={false}>
            {orgs.isLoading && <LoadingSkeleton variant="table" rows={4} />}
            {orgs.error ? <ErrorState error={orgs.error} onRetry={() => orgs.refetch()} /> : null}
            {orgs.data && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Slug</TableCell>
                    <TableCell>Timezone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orgs.data.map((o) => (
                    <TableRow key={o.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">{o.name}</Typography>
                          {o.demo && <Chip size="small" label="demo" color="warning" variant="outlined" />}
                        </Stack>
                      </TableCell>
                      <TableCell className="wp-mono">{o.slug}</TableCell>
                      <TableCell>{o.timezone}</TableCell>
                      <TableCell>
                        <StatusChip value={o.status} color={o.status === 'ACTIVE' ? '#4E8866' : '#C18B43'} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => selectOrganization(o.id)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Panel title="System health" subtitle="Checked every 30 seconds">
            {health.isLoading && <LoadingSkeleton variant="list" rows={4} />}
            {health.error ? <ErrorState error={health.error} onRetry={() => health.refetch()} /> : null}
            {health.data && (
              <KeyValueList
                items={[
                  { label: 'Database', value: <StatusChip value={health.data.database} color={health.data.database === 'UP' ? '#4E8866' : '#B75E56'} /> },
                  { label: 'Redis', value: <StatusChip value={health.data.redis} color={health.data.redis === 'UP' ? '#4E8866' : '#B75E56'} /> },
                  { label: 'RabbitMQ', value: <StatusChip value={health.data.rabbitmq} color={health.data.rabbitmq === 'UP' ? '#4E8866' : '#B75E56'} /> },
                  { label: 'Uptime', value: formatDuration(health.data.uptimeSeconds, { compact: true }) },
                  { label: 'Version', value: <span className="wp-mono">{health.data.version}</span> },
                ]}
              />
            )}
          </Panel>
        </Grid>
      </Grid>
    </>
  );
}
