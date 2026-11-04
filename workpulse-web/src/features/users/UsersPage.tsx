import { Alert, Button, Checkbox, Chip, FormControlLabel, IconButton, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useEffect, useState, type FormEvent } from 'react';
import { useAssignRolesMutation, useChangeUserStatusMutation, useInviteUserMutation, useRolesQuery, useUsersQuery } from '@/services/api/usersApi';
import { useDepartmentsQuery, useTeamsQuery } from '@/services/api/organizationApi';
import { useEmployeesQuery } from '@/services/api/employeesApi';
import { CopyField } from '@/components/common/CopyField';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/dialogs/FormDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { StatusChip } from '@/components/common/StatusChip';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { P } from '@/constants/permissions';
import { ROLE_LABELS } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import type { InviteUserResponse, RoleGrant, RoleResponse, UserResponse } from '@/types/users';
import { formatRelative, humanize } from '@/utils/format';
import { usePermission } from '@/hooks/usePermission';

const STATUS_COLORS: Record<string, string> = { ACTIVE: '#4E8866', INVITED: '#C18B43', SUSPENDED: '#8A8F8B', REVOKED: '#B75E56' };

export function UsersPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const users = useUsersQuery({ page, size });
  const { canWrite } = usePermission();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invited, setInvited] = useState<InviteUserResponse | null>(null);
  const [rolesFor, setRolesFor] = useState<UserResponse | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; user: UserResponse } | null>(null);
  const [changeStatus] = useChangeUserStatusMutation();

  const columns: Column<UserResponse>[] = [
    {
      id: 'displayName',
      label: 'User',
      render: (u) => (
        <div>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {u.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {u.email}
          </Typography>
        </div>
      ),
    },
    {
      id: 'roles',
      label: 'Roles',
      render: (u) => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {u.roles.map((r, i) => (
            <Chip key={`${r.roleCode}-${i}`} size="small" label={ROLE_LABELS[r.roleCode] ?? r.roleName} variant="outlined" />
          ))}
        </Stack>
      ),
    },
    { id: 'status', label: 'Status', render: (u) => <StatusChip value={u.status} color={STATUS_COLORS[u.status]} /> },
    { id: 'employee', label: 'Employee link', hideBelow: 'md', render: (u) => (u.employeeId ? <Chip size="small" label="Linked" color="success" variant="outlined" /> : <Typography variant="caption" color="text.secondary">None</Typography>) },
    { id: 'lastLoginAt', label: 'Last sign-in', hideBelow: 'md', render: (u) => formatRelative(u.lastLoginAt) },
    {
      id: 'actions',
      label: '',
      align: 'right',
      render: (u) =>
        canWrite(P.USER_MANAGE) ? (
          <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, user: u })} aria-label={`Actions for ${u.displayName}`}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle="Portal accounts and the roles that scope what each person can see and do. Permissions are enforced by the backend."
        actions={
          <PermissionGate permission={P.USER_CREATE} write>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}>
              Invite user
            </Button>
          </PermissionGate>
        }
      />
      {invited && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInvited(null)}>
          <Typography variant="subtitle2">{invited.user.email} invited.</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Share this activation link with them. Until email delivery is configured (Phase 10) the token is only shown here, once.
          </Typography>
          <CopyField label="Activation link" value={`${window.location.origin}${ROUTES.activate}?token=${invited.activationToken}`} />
        </Alert>
      )}
      <Panel padded={false}>
        {users.error ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : null}
        <DataTable columns={columns} rows={users.data?.items ?? []} rowKey={(u) => u.id} loading={users.isLoading} meta={users.data?.meta} page={page} size={size} onPageChange={setPage} onSizeChange={setSize} emptyTitle="No users yet" caption="Portal users" />
      </Panel>
      <Menu open={!!menu} anchorEl={menu?.anchor} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setRolesFor(menu!.user); setMenu(null); }}>Change roles</MenuItem>
        {menu?.user.status !== 'SUSPENDED' && menu?.user.status !== 'REVOKED' && (
          <MenuItem onClick={() => { changeStatus({ id: menu!.user.id, action: 'suspend' }); setMenu(null); }}>Suspend</MenuItem>
        )}
        {menu?.user.status === 'SUSPENDED' && (
          <MenuItem onClick={() => { changeStatus({ id: menu!.user.id, action: 'reactivate' }); setMenu(null); }}>Reactivate</MenuItem>
        )}
        {menu?.user.status !== 'REVOKED' && (
          <MenuItem sx={{ color: 'error.main' }} onClick={() => { changeStatus({ id: menu!.user.id, action: 'revoke' }); setMenu(null); }}>
            Revoke access
          </MenuItem>
        )}
      </Menu>
      <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={(r) => { setInvited(r); setInviteOpen(false); }} />
      <RolesDialog user={rolesFor} onClose={() => setRolesFor(null)} />
    </>
  );
}

function useRoleGrantEditor(initial: RoleGrant[]) {
  const [grants, setGrants] = useState<RoleGrant[]>(initial);
  const toggle = (role: RoleResponse, checked: boolean) => {
    setGrants((g) => (checked ? [...g, { roleCode: role.code }] : g.filter((x) => x.roleCode !== role.code)));
  };
  const setScope = (roleCode: string, key: 'departmentId' | 'teamId', value: string) => {
    setGrants((g) => g.map((x) => (x.roleCode === roleCode ? { ...x, [key]: value || null } : x)));
  };
  return { grants, setGrants, toggle, setScope };
}

function RoleGrantFields({ grants, roles, toggle, setScope }: { grants: RoleGrant[]; roles: RoleResponse[]; toggle: (r: RoleResponse, c: boolean) => void; setScope: (code: string, key: 'departmentId' | 'teamId', v: string) => void }) {
  const departments = useDepartmentsQuery();
  const teams = useTeamsQuery();
  const assignable = roles.filter((r) => !r.code.startsWith('GUEST_'));
  return (
    <Stack spacing={1}>
      {assignable.map((role) => {
        const grant = grants.find((g) => g.roleCode === role.code);
        return (
          <Stack key={role.code} spacing={0.5}>
            <FormControlLabel
              control={<Checkbox checked={!!grant} onChange={(e) => toggle(role, e.target.checked)} />}
              label={
                <span>
                  {ROLE_LABELS[role.code] ?? role.name}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    · {role.scopeLevel.toLowerCase()} scope
                  </Typography>
                </span>
              }
            />
            {grant && role.scopeLevel === 'DEPARTMENT' && (
              <TextField select label="Department" size="small" value={grant.departmentId ?? ''} onChange={(e) => setScope(role.code, 'departmentId', e.target.value)} required sx={{ ml: 4 }}>
                {(departments.data ?? []).map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {grant && role.scopeLevel === 'TEAM' && (
              <TextField select label="Team" size="small" value={grant.teamId ?? ''} onChange={(e) => setScope(role.code, 'teamId', e.target.value)} required sx={{ ml: 4 }}>
                {(teams.data ?? []).map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name} · {t.departmentName}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

function InviteUserDialog({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: (r: InviteUserResponse) => void }) {
  const roles = useRolesQuery(undefined, { skip: !open });
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const employees = useEmployeesQuery({ q: employeeSearch || undefined, size: 20 }, { skip: !open });
  const editor = useRoleGrantEditor([{ roleCode: 'EMPLOYEE' }]);
  const [invite, state] = useInviteUserMutation();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const r = await invite({ email, displayName, employeeId: employeeId || null, roles: editor.grants }).unwrap();
      setEmail('');
      setDisplayName('');
      setEmployeeId('');
      editor.setGrants([{ roleCode: 'EMPLOYEE' }]);
      onInvited(r);
    } catch {
      // rendered
    }
  };

  return (
    <FormDialog open={open} title="Invite a user" submitLabel="Send invitation" submitting={state.isLoading} error={state.error} onClose={onClose} onSubmit={submit}>
      <TextField label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      <TextField label="Search employee to link (optional)" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} helperText="Linking lets the person see their own activity and register a device." />
      <TextField select label="Employee record" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        <MenuItem value="">Not linked</MenuItem>
        {(employees.data?.items ?? []).map((emp) => (
          <MenuItem key={emp.id} value={emp.id}>
            {emp.fullName} · {emp.employeeCode}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="subtitle2">Roles</Typography>
      <RoleGrantFields grants={editor.grants} roles={roles.data ?? []} toggle={editor.toggle} setScope={editor.setScope} />
    </FormDialog>
  );
}

function RolesDialog({ user, onClose }: { user: UserResponse | null; onClose: () => void }) {
  const roles = useRolesQuery(undefined, { skip: !user });
  const editor = useRoleGrantEditor([]);
  const [assign, state] = useAssignRolesMutation();
  const { setGrants } = editor;
  useEffect(() => {
    if (user) {
      setGrants(user.roles.map((r) => ({ roleCode: r.roleCode, departmentId: r.departmentId ?? null, teamId: r.teamId ?? null })));
    }
  }, [user, setGrants]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    try {
      await assign({ id: user.id, roles: editor.grants }).unwrap();
      onClose();
    } catch {
      // rendered
    }
  };
  return (
    <FormDialog open={!!user} title={`Roles for ${user?.displayName ?? ''}`} submitLabel="Save roles" submitting={state.isLoading} error={state.error} onClose={onClose} onSubmit={submit}>
      <Typography variant="body2" color="text.secondary">
        Department managers and team leads must be bound to a department or team. Changes take effect at the user's next sign-in or token refresh.
      </Typography>
      <RoleGrantFields grants={editor.grants} roles={roles.data ?? []} toggle={editor.toggle} setScope={editor.setScope} />
      {editor.grants.length === 0 && <Alert severity="warning">Select at least one role.</Alert>}
      <Typography variant="caption" color="text.secondary">
        {editor.grants.map((g) => humanize(g.roleCode)).join(', ')}
      </Typography>
    </FormDialog>
  );
}
