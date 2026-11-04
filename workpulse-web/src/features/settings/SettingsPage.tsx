import { Alert, Button, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useChangePasswordMutation, useLoginHistoryQuery } from '@/services/api/authApi';
import { useCurrentOrganizationQuery, useUpdateOrganizationMutation } from '@/services/api/organizationApi';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { PermissionGate } from '@/components/common/PermissionGate';
import { P } from '@/constants/permissions';
import { ROLE_LABELS } from '@/constants/roles';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, humanize } from '@/utils/format';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(10, 'Use at least 10 characters').max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type PasswordForm = z.infer<typeof passwordSchema>;

export function SettingsPage() {
  const { user, isGuest, isSuperAdmin } = useAuth();
  const { mode, setMode } = useColorScheme();
  const history = useLoginHistoryQuery({ size: 8 }, { skip: isGuest });

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, security and appearance. Organisation administrators also manage organisation settings here." />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Profile">
            {user && (
              <KeyValueList
                items={[
                  { label: 'Name', value: user.displayName },
                  { label: 'Email', value: user.email },
                  { label: 'Organisation', value: user.organizationName ?? (isSuperAdmin ? 'Platform (all organisations)' : '–') },
                  { label: 'Roles', value: <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>{user.roles.map((r) => <Chip key={r} size="small" label={ROLE_LABELS[r] ?? humanize(r)} />)}</Stack> },
                  { label: 'Data scope', value: user.scope ? humanize(user.scope.level) : '–' },
                  { label: 'Employee record', value: user.employeeId ? 'Linked' : 'Not linked' },
                ]}
              />
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Appearance">
            <TextField select label="Theme" value={mode ?? 'light'} onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')} sx={{ minWidth: 200 }}>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">Follow system</MenuItem>
            </TextField>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Animations follow your operating system's reduced-motion preference.
            </Typography>
          </Panel>
        </Grid>
        {!isGuest && (
          <Grid size={{ xs: 12, md: 6 }}>
            <ChangePasswordPanel />
          </Grid>
        )}
        {!isGuest && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Panel title="Recent sign-ins" subtitle="Your login history, including failed attempts">
              {history.error ? <ErrorState error={history.error} /> : null}
              <Stack spacing={0.75}>
                {(history.data?.items ?? []).map((h) => (
                  <Stack key={h.id} direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2">{humanize(h.outcome)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(h.occurredAt)} · {h.ipAddress ?? ''}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Panel>
          </Grid>
        )}
        <PermissionGate permission={P.ORGANIZATION_UPDATE}>
          {!isSuperAdmin && (
            <Grid size={{ xs: 12 }}>
              <OrganizationSettingsPanel />
            </Grid>
          )}
        </PermissionGate>
      </Grid>
    </>
  );
}

function ChangePasswordPanel() {
  const [change, state] = useChangePasswordMutation();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const onSubmit = handleSubmit((v) => change({ currentPassword: v.currentPassword, newPassword: v.newPassword }).unwrap().then(() => reset()).catch(() => undefined));
  return (
    <Panel title="Change password" subtitle="Other sessions are signed out after a change">
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {state.isSuccess && <Alert severity="success">Password changed.</Alert>}
          {state.error ? <ErrorState error={state.error} title="Could not change password" /> : null}
          <TextField label="Current password" type="password" autoComplete="current-password" error={!!errors.currentPassword} helperText={errors.currentPassword?.message} {...register('currentPassword')} />
          <TextField label="New password" type="password" autoComplete="new-password" error={!!errors.newPassword} helperText={errors.newPassword?.message} {...register('newPassword')} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" error={!!errors.confirm} helperText={errors.confirm?.message} {...register('confirm')} />
          <Button type="submit" variant="contained" disabled={state.isLoading} sx={{ alignSelf: 'flex-start' }}>
            Update password
          </Button>
        </Stack>
      </form>
    </Panel>
  );
}

function OrganizationSettingsPanel() {
  const current = useCurrentOrganizationQuery();
  const [update, state] = useUpdateOrganizationMutation();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => {
    if (current.data) {
      setName(current.data.name);
      setTimezone(current.data.timezone);
      setCode(current.data.code ?? '');
    }
  }, [current.data]);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current.data) return;
    update({ id: current.data.id, data: { name, timezone, code: code || undefined } }).unwrap().catch(() => undefined);
  };
  return (
    <Panel title="Organisation settings" subtitle="Name, code and the timezone used for daily boundaries and dashboards">
      {current.error ? <ErrorState error={current.error} /> : null}
      <form onSubmit={submit}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required sx={{ minWidth: 240 }} />
          <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} sx={{ width: 140 }} />
          <TextField label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} required helperText="IANA timezone, e.g. Asia/Kolkata" sx={{ minWidth: 240 }} />
          <Button type="submit" variant="contained" disabled={state.isLoading || !current.data}>
            Save
          </Button>
        </Stack>
        {state.isSuccess && <Alert severity="success" sx={{ mt: 2 }}>Organisation updated.</Alert>}
        {state.error ? <ErrorState error={state.error} title="Could not update organisation" /> : null}
      </form>
    </Panel>
  );
}
