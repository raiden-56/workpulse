import { useState } from 'react';
import { Alert, Button, Chip, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import type { AgentStatus } from '@shared/ipc';
import { KeyValue, PageTitle, Section, Stat } from '../components/common';
import { describeMonitoring } from '../components/StatusBanner';
import { formatDuration, formatTime } from '../hooks/useAgent';
import type { Screen } from '../components/NavRail';

export function HomeScreen({ status, connected, onRefresh, onNavigate }: { status: AgentStatus; connected: boolean; onRefresh: () => Promise<void>; onNavigate: (s: Screen) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = describeMonitoring(status, connected);
  const summary = status.todaySummary;
  const sessionSeconds = status.sessionStartedAt ? Math.max(0, (Date.now() - new Date(status.sessionStartedAt).getTime()) / 1000) : 0;

  async function toggleBreak() {
    setBusy(true);
    setError(null);
    try {
      const r = status.onBreak ? await window.workpulse.endBreak() : await window.workpulse.startBreak(note || undefined);
      if (!r.ok) {
        setError(r.error ?? 'Could not update break');
      }
      setNote('');
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const top = status.todayUsage.slice(0, 5);
  const topTotal = top.reduce((s, u) => s + u.seconds, 0) || 1;

  return (
    <>
      <PageTitle title="Agent home" subtitle={state.detail} />
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Stat label="Session today" value={formatDuration(summary.sessionSeconds || sessionSeconds)} hint={status.sessionStartedAt ? `Signed in ${formatTime(status.sessionStartedAt)}` : 'No session'} />
        <Stat label="Active in applications" value={formatDuration(summary.activeSeconds)} hint="Foreground application with input" />
        <Stat label="Idle" value={formatDuration(summary.idleSeconds)} hint="No keyboard or mouse input" />
        <Stat label="Breaks & locked" value={formatDuration(summary.breakSeconds + summary.lockedSeconds)} hint="Declared breaks and lock screen" />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Stack spacing={2} sx={{ flex: 1 }}>
          <Section title="Current work session">
            <KeyValue
              items={[
                ['Monitoring', <Chip size="small" color={state.color === 'default' ? undefined : state.color} label={state.label} />],
                ['Current application', status.currentApp ? `${status.currentApp.appName} (${status.currentApp.processName}) since ${formatTime(status.currentApp.since)}` : 'None sampled'],
                ['Employee', status.employee?.name ?? '—'],
                ['Device', status.deviceId ? `Registered · ${status.deviceId.slice(0, 8)}…` : 'Not registered'],
                ['Policy', status.policyName ? `${status.policyName} (v${status.policyVersion})` : '—'],
                ['Collector', status.collectorConnected ? 'Running in your session' : 'Not running'],
              ]}
            />
          </Section>
          <Section title="Declare a break">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Breaks you declare are recorded as break time, not idle time, and pause application sampling.
            </Typography>
            <Stack direction="row" spacing={1.5}>
              {!status.onBreak && <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: 1 }} inputProps={{ maxLength: 120 }} />}
              <Button variant={status.onBreak ? 'outlined' : 'contained'} onClick={toggleBreak} disabled={busy || !connected || status.monitoring !== 'ACTIVE'}>
                {status.onBreak ? 'End break' : 'Start break'}
              </Button>
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
          </Section>
        </Stack>
        <Stack spacing={2} sx={{ flex: 1 }}>
          <Section title="Top applications today" action={<Button size="small" onClick={() => onNavigate('usage')}>All usage</Button>}>
            {top.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No application samples yet today.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {top.map((u) => (
                  <div key={u.processName}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">{u.appName}</Typography>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatDuration(u.seconds)}
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={Math.min(100, (100 * u.seconds) / topTotal)} sx={{ height: 6, borderRadius: 3 }} />
                  </div>
                ))}
              </Stack>
            )}
          </Section>
          <Section title="Sync" action={<Button size="small" onClick={() => onNavigate('sync')}>Details</Button>}>
            <KeyValue
              items={[
                ['Connection', status.connection],
                ['Queued events', status.queueDepth],
                ['Last sync', formatTime(status.lastSyncAt)],
              ]}
            />
          </Section>
        </Stack>
      </Stack>
    </>
  );
}
