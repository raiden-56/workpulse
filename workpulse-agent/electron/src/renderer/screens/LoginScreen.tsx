import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import type { AgentSettings, LoginUser } from '@shared/bridge';
import { PageTitle } from '../components/common';

export function LoginScreen({ settings, onSignedIn, onOpenSettings }: { settings: AgentSettings | null; onSignedIn: (user: LoginUser) => void; onOpenSettings: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await window.workpulse.login(email.trim(), password);
      setPassword('');
      onSignedIn(result.user);
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 520 }}>
      <PageTitle title="Sign in to WorkPulse" subtitle="Use your WorkPulse employee account. Your password is sent only to the WorkPulse server and is never stored on this device." />
      <Paper sx={{ p: 3 }}>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Server: <strong>{settings?.apiBaseUrl ?? '…'}</strong> ·{' '}
              <Link component="button" type="button" onClick={onOpenSettings}>
                change
              </Link>
            </Typography>
          </Stack>
        </form>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        After sign-in you will register this workstation. Nothing is collected before registration, and the monitoring status is always visible in this window and in the system tray.
      </Typography>
    </Box>
  );
}
