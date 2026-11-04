import { Alert, Chip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePoliciesQuery } from '@/services/api/policiesApi';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ROUTES } from '@/constants/routes';
import type { PolicyResponse } from '@/types/policies';
import { formatDuration, formatRelative, humanize } from '@/utils/format';

export function PoliciesPage() {
  const policies = usePoliciesQuery();
  const navigate = useNavigate();
  const columns: Column<PolicyResponse>[] = [
    {
      id: 'name',
      label: 'Policy',
      render: (p) => (
        <div>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {p.name} {p.isDefault && <Chip size="small" label="default" sx={{ ml: 0.5 }} />}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            v{p.version} · {p.status.toLowerCase()}
          </Typography>
        </div>
      ),
    },
    { id: 'level', label: 'Level', render: (p) => humanize(p.level) },
    { id: 'sampling', label: 'Sampling', hideBelow: 'md', render: (p) => `${p.samplingIntervalSeconds}s` },
    { id: 'idle', label: 'Idle threshold', hideBelow: 'md', render: (p) => formatDuration(p.idleThresholdSeconds, { compact: true }) },
    { id: 'titles', label: 'Window titles', hideBelow: 'lg', render: (p) => (p.collectWindowTitles ? 'Hashed' : 'Off') },
    { id: 'retention', label: 'Retention', hideBelow: 'sm', render: (p) => `${p.retentionDays} days` },
    { id: 'updated', label: 'Updated', hideBelow: 'lg', render: (p) => formatRelative(p.updatedAt) },
  ];
  return (
    <>
      <PageHeader title="Monitoring policies" subtitle="What is collected, when, and for how long. Policies resolve from employee → team → department → organisation default." />
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        Policies are read-only in this phase. Editing, assignment and version history arrive with the privacy and compliance centre (Phase 11). The least intrusive policy that meets the organisation's purpose is always preferred.
      </Alert>
      <Panel padded={false}>
        {policies.error ? <ErrorState error={policies.error} onRetry={() => policies.refetch()} /> : null}
        <DataTable columns={columns} rows={policies.data ?? []} rowKey={(p) => p.id} loading={policies.isLoading} onRowClick={(p) => navigate(ROUTES.policy(p.id))} emptyTitle="No policies" caption="Monitoring policies" />
      </Panel>
    </>
  );
}
