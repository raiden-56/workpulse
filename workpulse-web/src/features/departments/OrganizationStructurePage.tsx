import { Button, Chip, Grid, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import { useState, type FormEvent } from 'react';
import { useArchiveDepartmentMutation, useArchiveTeamMutation, useCreateDepartmentMutation, useCreateTeamMutation, useDepartmentsQuery, useTeamsQuery, useUpdateDepartmentMutation, useUpdateTeamMutation } from '@/services/api/organizationApi';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/dialogs/FormDialog';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { P } from '@/constants/permissions';
import type { DepartmentResponse, TeamResponse } from '@/types/organization';
import { usePermission } from '@/hooks/usePermission';

type DeptDialog = { mode: 'create' } | { mode: 'edit'; department: DepartmentResponse } | null;
type TeamDialog = { mode: 'create'; departmentId?: string } | { mode: 'edit'; team: TeamResponse } | null;

export function OrganizationStructurePage() {
  const departments = useDepartmentsQuery();
  const teams = useTeamsQuery();
  const { canWrite } = usePermission();
  const [deptDialog, setDeptDialog] = useState<DeptDialog>(null);
  const [teamDialog, setTeamDialog] = useState<TeamDialog>(null);
  const [archiveDept, setArchiveDept] = useState<DepartmentResponse | null>(null);
  const [archiveTeam, setArchiveTeam] = useState<TeamResponse | null>(null);
  const [doArchiveDept, archiveDeptState] = useArchiveDepartmentMutation();
  const [doArchiveTeam, archiveTeamState] = useArchiveTeamMutation();

  return (
    <>
      <PageHeader
        title="Departments & teams"
        subtitle="Organisation structure used for scoping managers and team leads, filters and analytics."
        actions={
          <Stack direction="row" spacing={1}>
            <PermissionGate permission={P.TEAM_CREATE} write>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setTeamDialog({ mode: 'create' })}>
                New team
              </Button>
            </PermissionGate>
            <PermissionGate permission={P.DEPARTMENT_CREATE} write>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDeptDialog({ mode: 'create' })}>
                New department
              </Button>
            </PermissionGate>
          </Stack>
        }
      />
      {departments.error ? <ErrorState error={departments.error} onRetry={() => departments.refetch()} /> : null}
      {departments.isLoading && <LoadingSkeleton variant="cards" rows={4} />}
      {departments.data && departments.data.length === 0 && <EmptyState title="No departments yet" description="Create a department to start organising employees into teams." />}
      <Grid container spacing={2}>
        {(departments.data ?? []).map((d) => {
          const deptTeams = (teams.data ?? []).filter((t) => t.departmentId === d.id);
          return (
            <Grid key={d.id} size={{ xs: 12, md: 6, xl: 4 }}>
              <Panel
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{d.name}</span>
                    {d.code && <Chip size="small" label={d.code} className="wp-mono" />}
                    {d.status !== 'ACTIVE' && <Chip size="small" label={d.status.toLowerCase()} color="default" />}
                  </Stack>
                }
                subtitle={`${d.employeeCount} employees · ${d.teamCount} teams`}
                actions={
                  canWrite(P.DEPARTMENT_UPDATE) ? (
                    <Stack direction="row">
                      <Tooltip title="Edit department">
                        <IconButton size="small" onClick={() => setDeptDialog({ mode: 'edit', department: d })} aria-label={`Edit ${d.name}`}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canWrite(P.DEPARTMENT_DELETE) && (
                        <Tooltip title="Archive department">
                          <IconButton size="small" onClick={() => setArchiveDept(d)} aria-label={`Archive ${d.name}`}>
                            <ArchiveOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  ) : undefined
                }
                padded={false}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Team</TableCell>
                      <TableCell align="right">Employees</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deptTeams.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="caption" color="text.secondary">
                            No teams yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {deptTeams.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          {t.name} {t.status !== 'ACTIVE' && <Chip size="small" label={t.status.toLowerCase()} sx={{ ml: 0.5 }} />}
                        </TableCell>
                        <TableCell align="right" className="wp-tabular">{t.employeeCount}</TableCell>
                        <TableCell align="right">
                          {canWrite(P.TEAM_UPDATE) && (
                            <IconButton size="small" onClick={() => setTeamDialog({ mode: 'edit', team: t })} aria-label={`Edit ${t.name}`}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          )}
                          {canWrite(P.TEAM_DELETE) && (
                            <IconButton size="small" onClick={() => setArchiveTeam(t)} aria-label={`Archive ${t.name}`}>
                              <ArchiveOutlinedIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {canWrite(P.TEAM_CREATE) && (
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setTeamDialog({ mode: 'create', departmentId: d.id })} sx={{ m: 1 }}>
                    Add team
                  </Button>
                )}
              </Panel>
            </Grid>
          );
        })}
      </Grid>

      <DepartmentDialog state={deptDialog} onClose={() => setDeptDialog(null)} />
      <TeamDialog state={teamDialog} onClose={() => setTeamDialog(null)} />
      <ConfirmDialog
        open={!!archiveDept}
        title={`Archive ${archiveDept?.name}?`}
        description="Archived departments are hidden from filters. Employees must be reassigned first."
        confirmLabel="Archive"
        destructive
        busy={archiveDeptState.isLoading}
        error={archiveDeptState.error}
        onClose={() => setArchiveDept(null)}
        onConfirm={() => archiveDept && doArchiveDept(archiveDept.id).unwrap().then(() => setArchiveDept(null)).catch(() => undefined)}
      />
      <ConfirmDialog
        open={!!archiveTeam}
        title={`Archive ${archiveTeam?.name}?`}
        description="Archived teams are hidden from filters. Employees must be reassigned first."
        confirmLabel="Archive"
        destructive
        busy={archiveTeamState.isLoading}
        error={archiveTeamState.error}
        onClose={() => setArchiveTeam(null)}
        onConfirm={() => archiveTeam && doArchiveTeam(archiveTeam.id).unwrap().then(() => setArchiveTeam(null)).catch(() => undefined)}
      />
    </>
  );
}

function DepartmentDialog({ state, onClose }: { state: DeptDialog; onClose: () => void }) {
  const editing = state?.mode === 'edit' ? state.department : null;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [create, c] = useCreateDepartmentMutation();
  const [update, u] = useUpdateDepartmentMutation();
  const currentKey = state ? (editing ? editing.id : 'create') : null;
  if (currentKey !== key) {
    setKey(currentKey);
    setName(editing?.name ?? '');
    setCode(editing?.code ?? '');
  }
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (editing) await update({ id: editing.id, data: { name, code: code || undefined, parentId: editing.parentId, headEmployeeId: editing.headEmployeeId } }).unwrap();
      else await create({ name, code: code || undefined }).unwrap();
      onClose();
    } catch {
      // rendered
    }
  };
  return (
    <FormDialog open={!!state} title={editing ? `Edit ${editing.name}` : 'New department'} submitting={c.isLoading || u.isLoading} error={c.error ?? u.error} onClose={onClose} onSubmit={submit} maxWidth="xs">
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus inputProps={{ maxLength: 120 }} />
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} inputProps={{ maxLength: 32 }} helperText="Optional short code, e.g. ENG" />
    </FormDialog>
  );
}

function TeamDialog({ state, onClose }: { state: TeamDialog; onClose: () => void }) {
  const editing = state?.mode === 'edit' ? state.team : null;
  const departments = useDepartmentsQuery();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [create, c] = useCreateTeamMutation();
  const [update, u] = useUpdateTeamMutation();
  const presetDepartmentId = state && state.mode === 'create' ? (state.departmentId ?? '') : '';
  const currentKey = state ? (editing ? editing.id : `create-${presetDepartmentId}`) : null;
  if (currentKey !== key) {
    setKey(currentKey);
    setName(editing?.name ?? '');
    setCode(editing?.code ?? '');
    setDepartmentId(editing?.departmentId ?? presetDepartmentId);
  }
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const data = { name, code: code || undefined, departmentId, leadEmployeeId: editing?.leadEmployeeId ?? null };
      if (editing) await update({ id: editing.id, data }).unwrap();
      else await create(data).unwrap();
      onClose();
    } catch {
      // rendered
    }
  };
  return (
    <FormDialog open={!!state} title={editing ? `Edit ${editing.name}` : 'New team'} submitting={c.isLoading || u.isLoading} error={c.error ?? u.error} onClose={onClose} onSubmit={submit} maxWidth="xs">
      <TextField select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
        {(departments.data ?? []).map((d) => (
          <MenuItem key={d.id} value={d.id}>
            {d.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus inputProps={{ maxLength: 120 }} />
      <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} inputProps={{ maxLength: 32 }} />
    </FormDialog>
  );
}
