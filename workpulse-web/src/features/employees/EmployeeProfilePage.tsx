import { Alert, Box, Button, Chip, Grid, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAssignDepartmentMutation, useAssignManagerMutation, useAssignTeamMutation, useDeactivateEmployeeMutation, useEmployeeQuery, useEmployeesQuery } from '@/services/api/employeesApi';
import { useDevicesQuery } from '@/services/api/devicesApi';
import { useDepartmentsQuery, useTeamsQuery } from '@/services/api/organizationApi';
import { useEffectivePolicyQuery } from '@/services/api/policiesApi';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/dialogs/FormDialog';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { StatusChip } from '@/components/common/StatusChip';
import { P } from '@/constants/permissions';
import { formatDate, formatDuration, formatRelative, humanize, todayIso } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { TimelineView } from '../activity/TimelineView';
import { EmployeeFormDialog } from './EmployeeFormDialog';

type AssignKind = 'manager' | 'department' | 'team';

export function EmployeeProfilePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const employee = useEmployeeQuery(id);
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [assign, setAssign] = useState<AssignKind | null>(null);
  const [date, setDate] = useState(() => todayIso(user?.organizationTimezone));
  const [deactivate, deactivateState] = useDeactivateEmployeeMutation();

  if (employee.isLoading) {
    return <LoadingSkeleton variant="page" />;
  }
  if (employee.error || !employee.data) {
    return <ErrorState error={employee.error ?? new Error('Employee not found')} onRetry={() => employee.refetch()} title="Employee not available" />;
  }
  const e = employee.data;

  return (
    <>
      <PageHeader
        title={e.fullName}
        eyebrow={e.employeeCode}
        subtitle={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <span>{e.designation ?? 'No designation'}</span>
            <Chip size="small" label={humanize(e.employmentStatus)} variant="outlined" />
            <StatusChip kind="activity" value={e.liveStatus} />
          </Stack>
        }
        actions={
          <Stack direction="row" spacing={1}>
            <PermissionGate permission={P.EMPLOYEE_UPDATE} write>
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate permission={P.EMPLOYEE_DELETE} write>
              <Button color="error" variant="outlined" startIcon={<PersonOffOutlinedIcon />} onClick={() => setDeactivateOpen(true)} disabled={e.employmentStatus === 'INACTIVE'}>
                Deactivate
              </Button>
            </PermissionGate>
          </Stack>
        }
      />
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid var(--wp-border)' }} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="Overview" />
        <Tab label="Activity" />
        <Tab label="Devices" />
        <Tab label="Policy" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Panel title="Profile">
              <KeyValueList
                items={[
                  { label: 'Work email', value: e.workEmail },
                  { label: 'Designation', value: e.designation },
                  { label: 'Role profile', value: humanize(e.roleProfile) },
                  { label: 'Joining date', value: formatDate(e.joiningDate) },
                  { label: 'Shift', value: e.shiftName },
                  { label: 'Portal account', value: e.hasPortalUser ? 'Linked' : 'None' },
                ]}
              />
            </Panel>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Panel
              title="Organisation"
              actions={
                <PermissionGate permission={P.EMPLOYEE_UPDATE} write>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => setAssign('department')}>Department</Button>
                    <Button size="small" onClick={() => setAssign('team')}>Team</Button>
                    <Button size="small" onClick={() => setAssign('manager')}>Manager</Button>
                  </Stack>
                </PermissionGate>
              }
            >
              <KeyValueList
                items={[
                  { label: 'Department', value: e.departmentName },
                  { label: 'Team', value: e.teamName },
                  { label: 'Manager', value: e.managerName },
                  { label: 'Devices', value: e.deviceCount },
                ]}
              />
            </Panel>
          </Grid>
        </Grid>
      )}
      {tab === 1 && (
        <PermissionGate permission={[P.ACTIVITY_VIEW, P.SELF_VIEW]} fallback={<Alert severity="info">You do not have permission to view activity timelines.</Alert>}>
          <Panel title="Activity timeline" subtitle="Classified intervals with the reason for each classification">
            <TimelineView employeeId={e.id} date={date} onDateChange={setDate} />
          </Panel>
        </PermissionGate>
      )}
      {tab === 2 && <EmployeeDevices employeeId={e.id} />}
      {tab === 3 && <EmployeePolicy employeeId={e.id} />}

      <EmployeeFormDialog open={editOpen} employee={e} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deactivateOpen}
        title={`Deactivate ${e.fullName}?`}
        description="The employee is marked inactive, their live status becomes offline and their devices stop being attributed. Records are retained according to the monitoring policy."
        confirmLabel="Deactivate"
        destructive
        busy={deactivateState.isLoading}
        error={deactivateState.error}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={() => deactivate(e.id).unwrap().then(() => setDeactivateOpen(false)).catch(() => undefined)}
      />
      <AssignDialog kind={assign} employeeId={e.id} currentDepartmentId={e.departmentId ?? undefined} onClose={() => setAssign(null)} />
    </>
  );
}

function EmployeeDevices({ employeeId }: { employeeId: string }) {
  const devices = useDevicesQuery({ employeeId, size: 50 });
  if (devices.isLoading) return <LoadingSkeleton variant="list" rows={3} />;
  if (devices.error) return <ErrorState error={devices.error} onRetry={() => devices.refetch()} />;
  const items = devices.data?.items ?? [];
  return (
    <Panel title="Assigned devices" subtitle={`${items.length} device(s)`}>
      {items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No device is registered for this employee.
        </Typography>
      )}
      <Stack spacing={1.5}>
        {items.map((d) => (
          <Stack key={d.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
            <div>
              <Typography variant="body2" className="wp-mono">
                {d.hostname}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {d.osName} {d.osVersion} · agent {d.agentVersion ?? '–'} · last seen {formatRelative(d.lastSeenAt)}
              </Typography>
            </div>
            <Stack direction="row" spacing={0.5}>
              <StatusChip kind="deviceStatus" value={d.status} />
              <StatusChip kind="deviceHealth" value={d.health} />
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Panel>
  );
}

function EmployeePolicy({ employeeId }: { employeeId: string }) {
  const policy = useEffectivePolicyQuery({ employeeId });
  if (policy.isLoading) return <LoadingSkeleton variant="list" rows={4} />;
  if (policy.error) return <ErrorState error={policy.error} onRetry={() => policy.refetch()} />;
  const p = policy.data!;
  return (
    <Panel title={p.name} subtitle={`Version ${p.version} · resolved from ${p.resolvedFrom.toLowerCase()} level`}>
      <Stack spacing={2}>
        <Alert severity="info" variant="outlined" icon={false}>
          {p.employeeNotice}
        </Alert>
        <KeyValueList
          items={[
            { label: 'Sampling interval', value: `${p.samplingIntervalSeconds} s` },
            { label: 'Idle threshold', value: formatDuration(p.idleThresholdSeconds, { compact: true }) },
            { label: 'Collection windows', value: p.collectionWindows.map((w) => `${w.from}–${w.to} (${(w.days ?? []).join(',')}) ${w.tz ?? ''}`).join('; ') || 'Always' },
            { label: 'Window titles', value: p.collectWindowTitles ? 'Hashed only' : 'Not collected' },
            { label: 'Input summary', value: p.collectInputSummary ? 'Aggregate counts' : 'Not collected' },
            { label: 'Excluded apps', value: p.sensitiveAppExclusions.join(', ') || 'None' },
            { label: 'Data categories', value: p.dataCategories.map((c) => humanize(c)).join(', ') },
            { label: 'Retention', value: `${p.retentionDays} days` },
          ]}
        />
      </Stack>
    </Panel>
  );
}

function AssignDialog({ kind, employeeId, currentDepartmentId, onClose }: { kind: AssignKind | null; employeeId: string; currentDepartmentId?: string; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');
  const departments = useDepartmentsQuery(undefined, { skip: kind !== 'department' });
  const teams = useTeamsQuery(undefined, { skip: kind !== 'team' });
  const managers = useEmployeesQuery({ q: search || undefined, size: 20, status: 'ACTIVE' }, { skip: kind !== 'manager' });
  const [assignManager, m] = useAssignManagerMutation();
  const [assignDepartment, d] = useAssignDepartmentMutation();
  const [assignTeam, t] = useAssignTeamMutation();
  const busy = m.isLoading || d.isLoading || t.isLoading;
  const error = m.error ?? d.error ?? t.error;

  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!value) return;
    try {
      if (kind === 'manager') await assignManager({ id: employeeId, managerEmployeeId: value }).unwrap();
      if (kind === 'department') await assignDepartment({ id: employeeId, departmentId: value }).unwrap();
      if (kind === 'team') await assignTeam({ id: employeeId, teamId: value }).unwrap();
      setValue('');
      onClose();
    } catch {
      // rendered
    }
  };

  const titles: Record<AssignKind, string> = { manager: 'Assign manager', department: 'Assign department', team: 'Assign team' };

  return (
    <FormDialog open={!!kind} title={kind ? titles[kind] : ''} submitLabel="Assign" submitting={busy} error={error} onClose={onClose} onSubmit={submit} maxWidth="xs">
      {kind === 'manager' && (
        <>
          <TextField label="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          <TextField select label="Manager" value={value} onChange={(e) => setValue(e.target.value)} required>
            {(managers.data?.items ?? []).filter((e) => e.id !== employeeId).map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.fullName} · {e.designation ?? e.employeeCode}
              </MenuItem>
            ))}
          </TextField>
        </>
      )}
      {kind === 'department' && (
        <TextField select label="Department" value={value} onChange={(e) => setValue(e.target.value)} required autoFocus>
          {(departments.data ?? []).map((dep) => (
            <MenuItem key={dep.id} value={dep.id}>
              {dep.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {kind === 'team' && (
        <TextField select label="Team" value={value} onChange={(e) => setValue(e.target.value)} required autoFocus helperText="Assigning a team also sets the department.">
          {(teams.data ?? []).map((team) => (
            <MenuItem key={team.id} value={team.id}>
              {team.name} · {team.departmentName}
              {team.departmentId === currentDepartmentId ? '' : ''}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Box />
    </FormDialog>
  );
}
