import { Chip, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ACTIVITY_STATES, type ActivityState, type LiveStatusResponse } from '@/types/activity';
import { ACTIVITY_STATUS_META } from '@/constants/status';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { useLiveSummaryQuery } from '@/services/api/activityApi';
import { DataTable, type Column, type SortState } from '@/components/tables/DataTable';
import { SearchField } from '@/components/filters/SearchField';
import { DepartmentTeamFilter } from '@/components/filters/DepartmentTeamFilter';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusChip } from '@/components/common/StatusChip';
import { Panel } from '@/components/common/Panel';
import { formatDuration, formatRelative, formatTime } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';

const SORTERS: Record<string, (a: LiveStatusResponse, b: LiveStatusResponse) => number> = {
  employeeName: (a, b) => a.employeeName.localeCompare(b.employeeName),
  departmentName: (a, b) => (a.departmentName ?? '').localeCompare(b.departmentName ?? ''),
  status: (a, b) => a.status.localeCompare(b.status),
  foregroundApp: (a, b) => (a.foregroundApp ?? '').localeCompare(b.foregroundApp ?? ''),
  sessionStartedAt: (a, b) => (a.sessionStartedAt ?? '').localeCompare(b.sessionStartedAt ?? ''),
  lastSyncAt: (a, b) => (a.lastSyncAt ?? '').localeCompare(b.lastSyncAt ?? ''),
};

export function LiveMonitoringPage() {
  const { user } = useAuth();
  const tz = user?.organizationTimezone ?? null;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (params.get('status') as ActivityState | null) ?? undefined;
  const departmentId = params.get('departmentId') ?? undefined;
  const teamId = params.get('teamId') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const [size, setSize] = useState(50);
  const [sort, setSort] = useState<SortState | undefined>();
  const [selected, setSelected] = useState<LiveStatusResponse | null>(null);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const live = useLiveStatus({ q: q || undefined, status, departmentId, teamId, page, size });
  const summary = useLiveSummaryQuery(undefined, { pollingInterval: 30_000 });

  const rows = useMemo(() => {
    if (!sort) return live.rows;
    const sorter = SORTERS[sort.field];
    if (!sorter) return live.rows;
    const sorted = [...live.rows].sort(sorter);
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [live.rows, sort]);

  const columns: Column<LiveStatusResponse>[] = [
    {
      id: 'employeeName',
      label: 'Employee',
      sortable: true,
      render: (r) => (
        <div>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {r.employeeName}
          </Typography>
          <Typography variant="caption" color="text.secondary" className="wp-mono">
            {r.employeeCode}
          </Typography>
        </div>
      ),
    },
    { id: 'departmentName', label: 'Department / team', sortable: true, hideBelow: 'md', render: (r) => `${r.departmentName ?? '–'}${r.teamName ? ` · ${r.teamName}` : ''}` },
    { id: 'status', label: 'Status', sortable: true, render: (r) => <StatusChip kind="activity" value={r.status} reason={r.reason} /> },
    { id: 'foregroundApp', label: 'Foreground application', sortable: true, hideBelow: 'sm', render: (r) => r.foregroundApp ?? <Typography variant="caption" color="text.secondary">–</Typography> },
    { id: 'deviceName', label: 'Device', hideBelow: 'lg', render: (r) => (r.deviceName ? <Stack direction="row" spacing={0.5} alignItems="center"><span className="wp-mono">{r.deviceName}</span>{r.deviceHealth && <StatusChip kind="deviceHealth" value={r.deviceHealth} />}</Stack> : '–') },
    { id: 'sessionStartedAt', label: 'Login', sortable: true, hideBelow: 'md', render: (r) => (r.sessionStartedAt ? `${formatTime(r.sessionStartedAt, tz)} · ${formatDuration(r.sessionDurationSeconds, { compact: true })}` : '–') },
    { id: 'lastSyncAt', label: 'Last sync', sortable: true, hideBelow: 'lg', render: (r) => formatRelative(r.lastSyncAt) },
  ];

  return (
    <>
      <PageHeader
        title="Live workforce monitoring"
        subtitle="Current state of every employee in your scope. Hover a status to read why it was classified that way."
        actions={
          <Tooltip title={live.socketConnected ? 'Receiving real-time updates over WebSocket' : 'Refreshing every 30 seconds'}>
            <Chip size="small" variant="outlined" color={live.socketConnected ? 'success' : 'default'} label={live.socketConnected ? 'Real-time' : 'Polling'} />
          </Tooltip>
        }
      />
      {summary.data && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }} component="ul" aria-label="Status summary" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <Chip component="li" label={`All · ${summary.data.total}`} onClick={() => setParam('status')} variant={status ? 'outlined' : 'filled'} />
          {ACTIVITY_STATES.map((s) => (
            <Chip
              key={s}
              component="li"
              label={`${ACTIVITY_STATUS_META[s].label} · ${summary.data!.byStatus[s] ?? 0}`}
              onClick={() => setParam('status', status === s ? undefined : s)}
              variant={status === s ? 'filled' : 'outlined'}
              sx={{ borderColor: ACTIVITY_STATUS_META[s].color }}
            />
          ))}
        </Stack>
      )}
      <Panel padded={false}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 2 }} alignItems={{ md: 'center' }}>
          <SearchField value={q} onChange={(v) => setParam('q', v || undefined)} placeholder="Search name, code, app, device…" />
          <DepartmentTeamFilter departmentId={departmentId} teamId={teamId} onChange={(n) => { setParam('departmentId', n.departmentId); setParam('teamId', n.teamId); }} />
          <TextField select label="Status" value={status ?? ''} onChange={(e) => setParam('status', e.target.value || undefined)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All statuses</MenuItem>
            {ACTIVITY_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {ACTIVITY_STATUS_META[s].label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {live.error ? <ErrorState error={live.error} onRetry={() => live.refetch()} /> : null}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.employeeId}
          loading={live.isLoading}
          meta={live.meta}
          page={page}
          size={size}
          onPageChange={(p) => setParam('page', p ? String(p) : undefined)}
          onSizeChange={setSize}
          sort={sort}
          onSortChange={setSort}
          onRowClick={setSelected}
          emptyTitle="No employees match these filters"
          caption="Live status of employees"
        />
      </Panel>
      <EmployeeDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </>
  );
}
