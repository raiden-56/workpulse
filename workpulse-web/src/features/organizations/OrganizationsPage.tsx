import { Alert, Button, Chip, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useState, type FormEvent } from 'react';
import { useCreateOrganizationMutation, useCurrentOrganizationQuery, useOrganizationsQuery } from '@/services/api/organizationApi';
import { CopyField } from '@/components/common/CopyField';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/dialogs/FormDialog';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { StatusChip } from '@/components/common/StatusChip';
import { P } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { usePermission } from '@/hooks/usePermission';
import { formatDate } from '@/utils/format';
import type { CreateOrganizationResponse } from '@/types/organization';

export function OrganizationsPage() {
  const { can } = usePermission();
  const { isSuperAdmin, selectOrganization } = useAuth();
  const orgs = useOrganizationsQuery(undefined, { skip: !can(P.ORGANIZATION_CREATE) });
  const current = useCurrentOrganizationQuery(undefined, { skip: isSuperAdmin });
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreateOrganizationResponse | null>(null);

  if (can(P.ORGANIZATION_CREATE)) {
    return (
      <>
        <PageHeader
          title="Organisations"
          subtitle="Tenants hosted on this deployment. Each organisation is isolated: users, employees, devices and activity never cross tenants."
          actions={
            <PermissionGate permission={P.ORGANIZATION_CREATE} write>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                New organisation
              </Button>
            </PermissionGate>
          }
        />
        {created && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setCreated(null)}>
            <Typography variant="subtitle2">{created.organization.name} created.</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Share the activation link with the organisation admin. Email delivery is wired in Phase 10; until then copy the token here.
            </Typography>
            <CopyField label="Activation link" value={`${window.location.origin}${ROUTES.activate}?token=${created.adminActivationToken}`} />
          </Alert>
        )}
        <Panel padded={false}>
          {orgs.isLoading && <LoadingSkeleton variant="table" rows={4} />}
          {orgs.error ? <ErrorState error={orgs.error} onRetry={() => orgs.refetch()} /> : null}
          {orgs.data && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Timezone</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {orgs.data.map((o) => (
                  <TableRow key={o.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{o.name}</span>
                        {o.demo && <Chip size="small" label="demo" color="warning" variant="outlined" />}
                      </Stack>
                    </TableCell>
                    <TableCell className="wp-mono">{o.slug}</TableCell>
                    <TableCell>{o.timezone}</TableCell>
                    <TableCell>
                      <StatusChip value={o.status} color={o.status === 'ACTIVE' ? '#4E8866' : '#C18B43'} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => selectOrganization(o.id)}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
        <CreateOrganizationDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(r) => {
            setCreated(r);
            setCreateOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Organisation" subtitle="Your organisation's profile and settings." />
      {current.isLoading && <LoadingSkeleton variant="page" />}
      {current.error ? <ErrorState error={current.error} onRetry={() => current.refetch()} /> : null}
      {current.data && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Panel title={current.data.name}>
              <KeyValueList
                items={[
                  { label: 'Slug', value: <span className="wp-mono">{current.data.slug}</span> },
                  { label: 'Timezone', value: current.data.timezone },
                  { label: 'Status', value: current.data.status },
                  { label: 'Created', value: formatDate(current.data.createdAt) },
                  { label: 'Employees', value: current.data.employeeCount },
                  { label: 'Departments', value: current.data.departmentCount },
                  { label: 'Devices', value: current.data.deviceCount },
                ]}
              />
            </Panel>
          </Grid>
        </Grid>
      )}
    </>
  );
}

function CreateOrganizationDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: CreateOrganizationResponse) => void }) {
  const [form, setForm] = useState({ name: '', slug: '', timezone: 'Asia/Kolkata', adminEmail: '', adminDisplayName: '' });
  const [create, state] = useCreateOrganizationMutation();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const r = await create(form).unwrap();
      setForm({ name: '', slug: '', timezone: 'Asia/Kolkata', adminEmail: '', adminDisplayName: '' });
      onCreated(r);
    } catch {
      // rendered
    }
  };
  return (
    <FormDialog open={open} title="New organisation" submitLabel="Create" submitting={state.isLoading} error={state.error} onClose={onClose} onSubmit={submit}>
      <TextField label="Name" value={form.name} onChange={set('name')} required autoFocus />
      <TextField label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} required helperText="Lower-case letters, digits and dashes" />
      <TextField label="Timezone" value={form.timezone} onChange={set('timezone')} helperText="IANA name, e.g. Asia/Kolkata" />
      <TextField label="Admin email" type="email" value={form.adminEmail} onChange={set('adminEmail')} required />
      <TextField label="Admin display name" value={form.adminDisplayName} onChange={set('adminDisplayName')} required />
    </FormDialog>
  );
}
