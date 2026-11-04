import { Button, Grid, List, ListItem, ListItemText, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuditLogsQuery, useDataAccessLogsQuery } from '@/services/api/auditApi';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { ROUTES } from '@/constants/routes';
import { formatDateTime, humanize } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';

export function AuditorDashboard() {
  const { user } = useAuth();
  const audit = useAuditLogsQuery({ page: 0, size: 10 });
  const access = useDataAccessLogsQuery({ page: 0, size: 10 });

  return (
    <>
      <PageHeader
        title="Auditor dashboard"
        subtitle="Read-only view of the audit trail and employee-data access history. Every read you perform here is itself recorded."
        eyebrow={user?.organizationName ?? undefined}
        actions={
          <Button component={RouterLink} to={ROUTES.audit} variant="outlined" size="small">
            Full audit log
          </Button>
        }
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Panel title="Latest administrative actions" padded={false}>
            {audit.isLoading && <LoadingSkeleton variant="list" rows={6} />}
            {audit.error ? <ErrorState error={audit.error} onRetry={() => audit.refetch()} /> : null}
            <List dense>
              {(audit.data?.items ?? []).map((a) => (
                <ListItem key={a.id} divider>
                  <ListItemText primary={`${humanize(a.action)} · ${humanize(a.entityType)}`} secondary={`${a.actorLabel ?? a.actorType} · ${formatDateTime(a.occurredAt)}`} />
                </ListItem>
              ))}
              {audit.data && audit.data.items.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No audit entries yet.
                </Typography>
              )}
            </List>
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Panel title="Employee data access" subtitle="Who looked at whose data" padded={false}>
            {access.isLoading && <LoadingSkeleton variant="list" rows={6} />}
            {access.error ? <ErrorState error={access.error} onRetry={() => access.refetch()} /> : null}
            <List dense>
              {(access.data?.items ?? []).map((a) => (
                <ListItem key={a.id} divider>
                  <ListItemText primary={`${humanize(a.resource)} · ${humanize(a.action)}`} secondary={`${a.actorType.toLowerCase()} ${a.actorUserId ?? ''} · ${formatDateTime(a.occurredAt)}`} />
                </ListItem>
              ))}
              {access.data && access.data.items.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No data access recorded yet.
                </Typography>
              )}
            </List>
          </Panel>
        </Grid>
      </Grid>
    </>
  );
}
