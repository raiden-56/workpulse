import { Box, Button, Divider, Drawer, Grid, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApproveDeviceMutation, useAssignDeviceEmployeeMutation, useDeviceSummaryQuery, useDevicesQuery, useRevokeDeviceMutation } from '@/services/api/devicesApi';
import { useEmployeesQuery } from '@/services/api/employeesApi';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/dialogs/FormDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { StatCard } from '@/components/common/StatCard';
import { StatusChip } from '@/components/common/StatusChip';
import { SearchField } from '@/components/filters/SearchField';
import { DepartmentTeamFilter } from '@/components/filters/DepartmentTeamFilter';
import { DataTable, type Column, type SortState } from '@/components/tables/DataTable';
import { P } from '@/constants/permissions';
import { DEVICE_HEALTHS, DEVICE_STATUSES, type DeviceHealth, type DeviceResponse, type DeviceStatus } from '@/types/devices';
import { formatDateTime, formatRelative, humanize } from '@/utils/format';

export function DevicesPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (params.get('status') as DeviceStatus | null) ?? undefined;
  const health = (params.get('health') as DeviceHealth | null) ?? undefined;
  const departmentId = params.get('departmentId') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState<SortState>({ field: 'lastSeenAt', direction: 'desc' });
  const [selected, setSelected] = useState<DeviceResponse | null>(null);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const summary = useDeviceSummaryQuery();
  const devices = useDevicesQuery({ q: q || undefined, status, health, departmentId, page, size, sort: `${sort.field},${sort.direction}` });
  const s = summary.data;
  const live = selected ? (devices.data?.items.find((d) => d.id === selected.id) ?? selected) : null;

  const columns: Column<DeviceResponse>[] = [
    { id: 'hostname', label: 'Device', sortable: true, render: (d) => <span className="wp-mono">{d.hostname}</span> },
    { id: 'employee', label: 'Employee', render: (d) => d.employeeName ?? <Typography variant="caption" color="text.secondary">Unassigned</Typography> },
    { id: 'department', label: 'Department', hideBelow: 'lg', render: (d) => d.departmentName ?? '–' },
    { id: 'status', label: 'Status', sortable: true, render: (d) => <StatusChip kind="deviceStatus" value={d.status} /> },
    { id: 'health', label: 'Health', sortable: true, render: (d) => <StatusChip kind="deviceHealth" value={d.health} /> },
    { id: 'agentVersion', label: 'Agent', sortable: true, hideBelow: 'md', render: (d) => <span className="wp-mono">{d.agentVersion ?? '–'}</span> },
    { id: 'os', label: 'OS', hideBelow: 'lg', render: (d) => `${d.osName ?? ''} ${d.osVersion ?? ''}`.trim() || '–' },
    { id: 'lastSeenAt', label: 'Last seen', sortable: true, hideBelow: 'sm', render: (d) => formatRelative(d.lastSeenAt) },
  ];

  return (
    <>
      <PageHeader title="Devices" subtitle="Workstations running the WorkPulse agent. Approve new registrations, revoke access and keep agents healthy." />
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Registered" value={s?.total ?? 0} hint={s ? `${s.approved} approved` : undefined} loading={summary.isLoading} onClick={() => setParam('status')} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Connected" value={s?.connected ?? 0} hint={s ? `${s.disconnected} disconnected` : undefined} tone="positive" loading={summary.isLoading} onClick={() => setParam('health', 'HEALTHY')} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Degraded / offline" value={s ? s.degraded + s.offline : 0} tone="warning" loading={summary.isLoading} onClick={() => setParam('health', 'OFFLINE')} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Pending approval" value={s?.pending ?? 0} hint={s ? `${s.revoked} revoked` : undefined} tone={s?.pending ? 'critical' : 'neutral'} loading={summary.isLoading} onClick={() => setParam('status', 'PENDING')} />
        </Grid>
      </Grid>
      <Panel padded={false}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 2 }} alignItems={{ md: 'center' }}>
          <SearchField value={q} onChange={(v) => setParam('q', v || undefined)} placeholder="Search hostname, machine id, version…" />
          <TextField select label="Status" value={status ?? ''} onChange={(e) => setParam('status', e.target.value || undefined)} sx={{ minWidth: 150 }}>
            <MenuItem value="">All</MenuItem>
            {DEVICE_STATUSES.map((x) => (
              <MenuItem key={x} value={x}>
                {humanize(x)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Health" value={health ?? ''} onChange={(e) => setParam('health', e.target.value || undefined)} sx={{ minWidth: 150 }}>
            <MenuItem value="">All</MenuItem>
            {DEVICE_HEALTHS.map((x) => (
              <MenuItem key={x} value={x}>
                {humanize(x)}
              </MenuItem>
            ))}
          </TextField>
          <DepartmentTeamFilter departmentId={departmentId} onChange={(n) => setParam('departmentId', n.departmentId)} />
        </Stack>
        {devices.error ? <ErrorState error={devices.error} onRetry={() => devices.refetch()} /> : null}
        <DataTable
          columns={columns}
          rows={devices.data?.items ?? []}
          rowKey={(d) => d.id}
          loading={devices.isLoading}
          meta={devices.data?.meta}
          page={page}
          size={size}
          onPageChange={(p) => setParam('page', p ? String(p) : undefined)}
          onSizeChange={setSize}
          sort={sort}
          onSortChange={setSort}
          onRowClick={setSelected}
          emptyTitle="No devices match these filters"
          caption="Device inventory"
        />
      </Panel>
      <DeviceDrawer device={live} onClose={() => setSelected(null)} />
    </>
  );
}

function DeviceDrawer({ device, onClose }: { device: DeviceResponse | null; onClose: () => void }) {
  const [approve, approveState] = useApproveDeviceMutation();
  const [revoke, revokeState] = useRevokeDeviceMutation();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  return (
    <Drawer anchor="right" open={!!device} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 } } } }}>
      {device && (
        <Box sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <div>
              <Typography variant="h4" className="wp-mono">
                {device.hostname}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                <StatusChip kind="deviceStatus" value={device.status} />
                <StatusChip kind="deviceHealth" value={device.health} />
              </Stack>
            </div>
            <IconButton onClick={onClose} aria-label="Close device details">
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <KeyValueList
            items={[
              { label: 'Employee', value: device.employeeName ?? 'Unassigned' },
              { label: 'Department', value: device.departmentName },
              { label: 'Machine id', value: <span className="wp-mono">{device.machineId}</span> },
              { label: 'Operating system', value: `${device.osName ?? ''} ${device.osVersion ?? ''}`.trim() || '–' },
              { label: 'Agent version', value: <span className="wp-mono">{device.agentVersion ?? '–'}</span> },
              { label: 'Registered', value: formatDateTime(device.registeredAt) },
              { label: 'Approved', value: formatDateTime(device.approvedAt) },
              { label: 'Revoked', value: formatDateTime(device.revokedAt) },
              { label: 'Last seen', value: formatDateTime(device.lastSeenAt) },
              { label: 'Last sync', value: formatDateTime(device.lastSyncAt) },
            ]}
          />
          {device.metadata && Object.keys(device.metadata).length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Diagnostics
              </Typography>
              <KeyValueList items={Object.entries(device.metadata).map(([k, v]) => ({ label: humanize(k), value: typeof v === 'object' ? JSON.stringify(v) : String(v) }))} />
            </>
          )}
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {device.status === 'PENDING' && (
              <PermissionGate permission={P.DEVICE_APPROVE} write>
                <Button variant="contained" onClick={() => approve(device.id)} disabled={approveState.isLoading}>
                  Approve device
                </Button>
              </PermissionGate>
            )}
            {device.status !== 'REVOKED' && (
              <PermissionGate permission={P.DEVICE_DELETE} write>
                <Button variant="outlined" color="error" onClick={() => setRevokeOpen(true)}>
                  Revoke access
                </Button>
              </PermissionGate>
            )}
            <PermissionGate permission={P.DEVICE_UPDATE} write>
              <Button variant="outlined" onClick={() => setAssignOpen(true)}>
                Assign employee
              </Button>
            </PermissionGate>
          </Stack>
          {approveState.error ? <ErrorState error={approveState.error} title="Approval failed" /> : null}
          <ConfirmDialog
            open={revokeOpen}
            title={`Revoke ${device.hostname}?`}
            description="The agent on this device stops synchronising immediately and shows a revoked state. Buffered events stay on the device. Re-registration requires IT approval."
            confirmLabel="Revoke"
            destructive
            busy={revokeState.isLoading}
            error={revokeState.error}
            onClose={() => setRevokeOpen(false)}
            onConfirm={() => revoke(device.id).unwrap().then(() => setRevokeOpen(false)).catch(() => undefined)}
          />
          <AssignEmployeeDialog deviceId={device.id} open={assignOpen} onClose={() => setAssignOpen(false)} />
        </Box>
      )}
    </Drawer>
  );
}

function AssignEmployeeDialog({ deviceId, open, onClose }: { deviceId: string; open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const employees = useEmployeesQuery({ q: search || undefined, size: 20 }, { skip: !open });
  const [assign, state] = useAssignDeviceEmployeeMutation();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!employeeId) return;
    try {
      await assign({ id: deviceId, employeeId }).unwrap();
      onClose();
    } catch {
      // rendered
    }
  };
  return (
    <FormDialog open={open} title="Assign device to employee" submitLabel="Assign" submitting={state.isLoading} error={state.error} onClose={onClose} onSubmit={submit} maxWidth="xs">
      <TextField label="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      <TextField select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
        {(employees.data?.items ?? []).map((emp) => (
          <MenuItem key={emp.id} value={emp.id}>
            {emp.fullName} · {emp.employeeCode}
          </MenuItem>
        ))}
      </TextField>
    </FormDialog>
  );
}
