import { Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEmployeesQuery } from '@/services/api/employeesApi';
import { DataTable, type Column, type SortState } from '@/components/tables/DataTable';
import { SearchField } from '@/components/filters/SearchField';
import { DepartmentTeamFilter } from '@/components/filters/DepartmentTeamFilter';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { StatusChip } from '@/components/common/StatusChip';
import { P } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { EMPLOYMENT_STATUSES, type EmployeeResponse, type EmploymentStatus } from '@/types/employees';
import { humanize } from '@/utils/format';
import { EmployeeFormDialog } from './EmployeeFormDialog';

export function EmployeesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const departmentId = params.get('departmentId') ?? undefined;
  const teamId = params.get('teamId') ?? undefined;
  const status = (params.get('status') as EmploymentStatus | null) ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState<SortState>({ field: 'lastName', direction: 'asc' });
  const createOpen = params.get('new') === '1';

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const employees = useEmployeesQuery({ q: q || undefined, departmentId, teamId, status, page, size, sort: `${sort.field},${sort.direction}` });

  const columns: Column<EmployeeResponse>[] = [
    {
      id: 'lastName',
      label: 'Employee',
      sortable: true,
      render: (e) => (
        <div>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {e.fullName}
          </Typography>
          <Typography variant="caption" color="text.secondary" className="wp-mono">
            {e.employeeCode}
          </Typography>
        </div>
      ),
    },
    { id: 'workEmail', label: 'Email', sortable: true, hideBelow: 'md', render: (e) => e.workEmail },
    { id: 'designation', label: 'Designation', sortable: true, hideBelow: 'lg', render: (e) => e.designation ?? '–' },
    { id: 'department', label: 'Department / team', hideBelow: 'sm', render: (e) => `${e.departmentName ?? '–'}${e.teamName ? ` · ${e.teamName}` : ''}` },
    { id: 'employmentStatus', label: 'Employment', sortable: true, hideBelow: 'md', render: (e) => <Chip size="small" label={humanize(e.employmentStatus)} variant="outlined" /> },
    { id: 'liveStatus', label: 'Now', render: (e) => <StatusChip kind="activity" value={e.liveStatus} /> },
    { id: 'deviceCount', label: 'Devices', align: 'right', hideBelow: 'lg', render: (e) => e.deviceCount },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Directory of employees in your scope with their current status."
        actions={
          <PermissionGate permission={P.EMPLOYEE_CREATE} write>
            <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => setParam('new', '1')}>
              Add employee
            </Button>
          </PermissionGate>
        }
      />
      <Panel padded={false}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 2 }} alignItems={{ md: 'center' }}>
          <SearchField value={q} onChange={(v) => setParam('q', v || undefined)} placeholder="Search name, email, code…" />
          <DepartmentTeamFilter departmentId={departmentId} teamId={teamId} onChange={(n) => { setParam('departmentId', n.departmentId); setParam('teamId', n.teamId); }} />
          <TextField select label="Employment" value={status ?? ''} onChange={(e) => setParam('status', e.target.value || undefined)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem>
            {EMPLOYMENT_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {humanize(s)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {employees.error ? <ErrorState error={employees.error} onRetry={() => employees.refetch()} /> : null}
        <DataTable
          columns={columns}
          rows={employees.data?.items ?? []}
          rowKey={(e) => e.id}
          loading={employees.isLoading}
          meta={employees.data?.meta}
          page={page}
          size={size}
          onPageChange={(p) => setParam('page', p ? String(p) : undefined)}
          onSizeChange={setSize}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(e) => navigate(ROUTES.employee(e.id))}
          emptyTitle="No employees found"
          emptyDescription="Adjust the filters, or add employees to the directory."
          caption="Employee directory"
        />
      </Panel>
      <EmployeeFormDialog open={createOpen} onClose={() => setParam('new')} onSaved={(e) => navigate(ROUTES.employee(e.id))} />
    </>
  );
}
