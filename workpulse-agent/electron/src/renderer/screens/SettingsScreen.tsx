import { useEffect, useState } from 'react';
import { Alert, Button, FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';
import type { AgentSettings, AppInfo } from '@shared/bridge';
import { KeyValue, PageTitle, Section } from '../components/common';

export function SettingsScreen({ settings, onSave, appInfo }: { settings: AgentSettings | null; onSave: (s: Partial<AgentSettings>) => Promise<AgentSettings>; appInfo: AppInfo | null }) {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [theme, setTheme] = useState<AgentSettings['theme']>('system');
  const [startAtLogin, setStartAtLogin] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setApiBaseUrl(settings.apiBaseUrl);
      setTheme(settings.theme);
      setStartAtLogin(settings.startAtLogin);
      setMinimizeToTray(settings.minimizeToTray);
    }
  }, [settings]);

  async function save() {
    try {
      await onSave({ apiBaseUrl, theme, startAtLogin, minimizeToTray });
      setMessage({ severity: 'success', text: 'Settings saved.' });
    } catch (e) {
      setMessage({ severity: 'error', text: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') });
    }
  }

  return (
    <>
      <PageTitle title="Settings" subtitle="Preferences for this window. Monitoring behaviour itself comes from your organisation's policy and cannot be changed here." />
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        <Section title="Server">
          <TextField label="WorkPulse API base URL" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} fullWidth helperText="Example: https://workpulse.example.com — used for sign-in and device registration." />
        </Section>
        <Section title="Appearance & start-up">
          <Stack spacing={1.5}>
            <TextField select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as AgentSettings['theme'])} sx={{ maxWidth: 240 }}>
              <MenuItem value="system">Follow Windows</MenuItem>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </TextField>
            <FormControlLabel control={<Switch checked={startAtLogin} onChange={(e) => setStartAtLogin(e.target.checked)} />} label="Open WorkPulse Agent when I sign in to Windows (recommended – keeps the status visible)" />
            <FormControlLabel control={<Switch checked={minimizeToTray} onChange={(e) => setMinimizeToTray(e.target.checked)} />} label="Keep running in the tray when the window is closed" />
          </Stack>
        </Section>
        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        <Button variant="contained" onClick={save} sx={{ alignSelf: 'flex-start' }}>
          Save settings
        </Button>
        <Section title="About">
          <KeyValue
            items={[
              ['Agent UI version', appInfo?.version ?? '—'],
              ['Electron', appInfo?.electron ?? '—'],
              ['Service link', appInfo ? (appInfo.serviceLink === 'mock' ? 'Mock service (development)' : 'Named pipe to WorkPulse.Service') : '—'],
              ['Build', appInfo ? (appInfo.packaged ? 'Packaged' : 'Development') : '—'],
            ]}
          />
        </Section>
      </Stack>
    </>
  );
}
