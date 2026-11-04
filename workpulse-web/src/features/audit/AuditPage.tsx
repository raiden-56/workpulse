import { Box, Button, Dialog, DialogContent, DialogTitle, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useAuditLogsQuery, useDataAccessLogsQuery } from '@/services/api/auditApi';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { SearchField } from '@/components/filters/SearchField';
import { DataTable, type Column } from '@/components/tables/DataTable';
import type { AuditLogResponse, DataAccessLogResponse } from '@/types/audit';
import { formatDateTime, humanize } from '@/utils/format';

export function AuditPage() {
  const [tab, setTab] = useState(0);
  return (
    <>
      <PageHeader title="Audit logs" subtitle="Administrative changes and employee-data access, recorded by the backend for every privileged action." />
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid var(--wp-border)' }}>
        <Tab label="Audit trail" />
        <Tab label="Data access" />
      </Tabs>
      {tab === 0 ? <AuditTrail /> : <DataAccess />}
    </>
  );
}

function AuditTrail() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [detail, setDetail] = useState<AuditLogResponse | null>(null);
  const logs = useAuditLogsQuery({
    q: q || undefined,
    action: action || undefined,
    entityType: entityType || undefined,
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
    page,
    size,
  });
  const columns: Column<AuditLogResponse>[] = [
    { id: 'occurredAt', label: 'When', render: (a) => formatDateTime(a.occurredAt) },
    { id: 'actor', label: 'Actor', render: (a) => `${a.actorLabel ?? a.actorType}` },
    { id: 'action', label: 'Action', render: (a) => humanize(a.action) },
    { id: 'entity', label: 'Entity', hideBelow: 'md', render: (a) => `${humanize(a.entityType)}${a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ''}` },
    { id: 'ip', label: 'IP', hideBelow: 'lg', render: (a) => a.ipAddress ?? '–' },
    { id: 'details', label: '', align: 'right', render: (a) => (a.before || a.after ? <Button size="small" onClick={(e) => { e.stopPropagation(); setDetail(a); }}>Details</Button> : null) },
  ];
  return (
    <Panel padded={false}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} sx={{ p: 2 }}>
        <SearchField value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Search actor, action…" />
        <TextField label="Action" value={action} onChange={(e) => { setAction(e.target.value.toUpperCase()); setPage(0); }} placeholder="e.g. EMPLOYEE_CREATED" />
        <TextField label="Entity type" value={entityType} onChange={(e) => { setEntityType(e.target.value.toUpperCase()); setPage(0); }} placeholder="e.g. DEVICE" />
        <TextField type="date" label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>
      {logs.error ? <ErrorState error={logs.error} onRetry={() => logs.refetch()} /> : null}
      <DataTable columns={columns} rows={logs.data?.items ?? []} rowKey={(a) => a.id} loading={logs.isLoading} meta={logs.data?.meta} page={page} size={size} onPageChange={setPage} onSizeChange={setSize} emptyTitle="No audit entries match" caption="Audit trail" dense />
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{detail ? humanize(detail.action) : ''}</DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {detail.actorLabel ?? detail.actorType} · {formatDateTime(detail.occurredAt)} · {humanize(detail.entityType)} {detail.entityId}
              </Typography>
              <JsonBlock title="Before" value={detail.before} />
              <JsonBlock title="After" value={detail.after} />
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function JsonBlock({ title, value }: { title: string; value?: Record<string, unknown> | null }) {
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      <Box component="pre" className="wp-mono" sx={{ m: 0, p: 1.5, bgcolor: 'var(--wp-surface-muted)', borderRadius: 1, overflowX: 'auto', fontSize: 12 }}>
        {value ? JSON.stringify(value, null, 2) : '—'}
      </Box>
    </Box>
  );
}

function DataAccess() {
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const logs = useDataAccessLogsQuery({ employeeId: employeeId || undefined, page, size });
  const columns: Column<DataAccessLogResponse>[] = [
    { id: 'occurredAt', label: 'When', render: (a) => formatDateTime(a.occurredAt) },
    { id: 'actor', label: 'Actor', render: (a) => `${a.actorType.toLowerCase()} ${a.actorUserId ?? ''}` },
    { id: 'resource', label: 'Resource', render: (a) => `${humanize(a.resource)} · ${humanize(a.action)}` },
    { id: 'subject', label: 'Subject employee', hideBelow: 'md', render: (a) => a.subjectEmployeeId ?? '–' },
    { id: 'detail', label: 'Detail', hideBelow: 'lg', render: (a) => (a.detail && Object.keys(a.detail).length ? JSON.stringify(a.detail) : '–') },
  ];
  return (
    <Panel padded={false}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 2 }}>
        <TextField label="Subject employee id" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value.trim()); setPage(0); }} sx={{ minWidth: 320 }} />
      </Stack>
      {logs.error ? <ErrorState error={logs.error} onRetry={() => logs.refetch()} /> : null}
      <DataTable columns={columns} rows={logs.data?.items ?? []} rowKey={(a) => a.id} loading={logs.isLoading} meta={logs.data?.meta} page={page} size={size} onPageChange={setPage} onSizeChange={setSize} emptyTitle="No data access recorded" caption="Employee data access log" dense />
    </Panel>
  );
}
