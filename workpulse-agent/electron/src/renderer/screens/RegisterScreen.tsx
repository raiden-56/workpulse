import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { AgentStatus, RegisterResultBody } from '@shared/ipc';
import type { LoginUser } from '@shared/bridge';
import { KeyValue, PageTitle } from '../components/common';

export function RegisterScreen({ user, status, connected, onBack, onRegistered }: { user: LoginUser | null; status: AgentStatus; connected: boolean; onBack: () => void; onRegistered: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RegisterResultBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const r = await window.workpulse.register();
      setResult(r);
      if (r.ok) {
        onRegistered();
      } else {
        setError(r.error ?? 'Registration failed');
      }
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <PageTitle title="Register this device" subtitle="Links this workstation to your employee record so that your organisation's monitoring policy can be applied." />
      <Stack spacing={2}>
        <Paper sx={{ p: 3 }}>
          <KeyValue
            items={[
              ['Signed in as', user ? `${user.displayName} (${user.email})` : 'Not signed in'],
              ['Organisation', user?.organizationName ?? '—'],
              ['Employee record', user?.employeeId ? 'Linked' : 'Not linked – ask HR to link your account to an employee record'],
              ['Background service', connected ? `Connected (v${status.serviceVersion})` : 'Not reachable'],
            ]}
          />
          {user?.demoOrganization && <Alert severity="info" sx={{ mt: 2 }}>This is a demo organisation. Registering a real device against it is for evaluation only.</Alert>}
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            What registration sends
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Computer name, a hashed machine identifier, Windows version and the agent version. The sign-in token is handed to the background service for this one call and then discarded; the service keeps only a device token.
          </Typography>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {result?.ok && (
            <Alert severity={result.status === 'APPROVED' ? 'success' : 'info'} sx={{ mt: 2 }}>
              Device registered ({result.status}). {result.status === 'PENDING' ? 'An administrator must approve it before events are sent.' : 'Monitoring will start according to your policy.'}
            </Alert>
          )}
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
            <Button variant="contained" onClick={register} disabled={busy || !user || !connected || !user.employeeId}>
              {busy ? 'Registering…' : 'Register device'}
            </Button>
            <Button onClick={onBack} disabled={busy}>
              Back
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
