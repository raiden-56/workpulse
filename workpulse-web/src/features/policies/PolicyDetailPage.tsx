import { Alert, Chip, Grid, Stack } from '@mui/material';
import { useParams } from 'react-router-dom';
import { usePolicyQuery } from '@/services/api/policiesApi';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { formatDateTime, formatDuration, humanize } from '@/utils/format';

export function PolicyDetailPage() {
  const { id = '' } = useParams();
  const policy = usePolicyQuery(id);
  if (policy.isLoading) return <LoadingSkeleton variant="page" />;
  if (policy.error || !policy.data) return <ErrorState error={policy.error ?? new Error('Policy not found')} onRetry={() => policy.refetch()} />;
  const p = policy.data;
  return (
    <>
      <PageHeader
        title={p.name}
        eyebrow={`${humanize(p.level)} policy · version ${p.version}`}
        subtitle={
          <Stack direction="row" spacing={1}>
            <Chip size="small" label={p.status.toLowerCase()} />
            {p.isDefault && <Chip size="small" color="primary" label="organisation default" />}
          </Stack>
        }
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Collection">
            <KeyValueList
              items={[
                { label: 'Sampling interval', value: `${p.samplingIntervalSeconds} seconds` },
                { label: 'Idle threshold', value: formatDuration(p.idleThresholdSeconds, { compact: true }) },
                { label: 'Collection windows', value: p.collectionWindows.length ? p.collectionWindows.map((w, i) => <div key={i}>{`${w.from}–${w.to} · days ${(w.days ?? []).join(', ')} · ${w.tz ?? ''}`}</div>) : 'Always' },
                { label: 'Working hours', value: JSON.stringify(p.workingHours) },
                { label: 'Window titles', value: p.collectWindowTitles ? 'Collected as salted hashes only' : 'Not collected' },
                { label: 'Input summary', value: p.collectInputSummary ? 'Aggregate counts per interval (no key codes)' : 'Not collected' },
                { label: 'Minimum agent', value: p.minAgentVersion },
              ]}
            />
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Data and retention">
            <Stack spacing={2}>
              <KeyValueList
                items={[
                  { label: 'Retention', value: `${p.retentionDays} days` },
                  { label: 'Updated', value: formatDateTime(p.updatedAt) },
                ]}
              />
              <div>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {p.dataCategories.map((c) => (
                    <Chip key={c} size="small" label={humanize(c)} />
                  ))}
                </Stack>
              </div>
              <div>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {p.sensitiveAppExclusions.length === 0 && <Chip size="small" variant="outlined" label="No excluded applications" />}
                  {p.sensitiveAppExclusions.map((a) => (
                    <Chip key={a} size="small" variant="outlined" label={a} className="wp-mono" />
                  ))}
                </Stack>
              </div>
            </Stack>
          </Panel>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Panel title="Employee notice" subtitle="Shown to employees in the agent and the privacy page">
            <Alert severity="info" variant="outlined" icon={false}>
              {p.employeeNotice ?? 'No notice configured.'}
            </Alert>
          </Panel>
        </Grid>
      </Grid>
    </>
  );
}
