import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Stack } from '@mui/material';
import type { AgentStatus, SyncResultBody } from '@shared/ipc';
import { KeyValue, PageTitle, Section } from '../components/common';
import { formatDateTime } from '../hooks/useAgent';

export function SyncScreen({ status, connected, onRefresh }: { status: AgentStatus; connected: boolean; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResultBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    void window.workpulse.checkBackend().then(setReachable);
  }, [status.lastSyncAt]);

  async function syncNow() {
    setBusy(true);
    setError(null);
    try {
      const r = await window.workpulse.syncNow();
      setResult(r);
      if (!r.ok) {
        setError(r.error ?? 'Synchronisation failed');
      }
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const connectionChip = (
    <Chip size="small" color={status.connection === 'ONLINE' ? 'success' : status.connection === 'REVOKED' ? 'error' : 'warning'} label={status.connection} />
  );

  return (
    <>
      <PageTitle title="Sync & connection" subtitle="Events are stored encrypted on this device and sent in batches. Nothing is lost when the network is down: the queue is drained when connectivity returns." />
      <Stack spacing={2}>
        <Section title="Status" action={<Button variant="contained" size="small" onClick={syncNow} disabled={busy || !connected || !status.registered}>{busy ? 'Syncing…' : 'Sync now'}</Button>}>
          <KeyValue
            items={[
              ['Background service', connected ? 'Connected' : 'Not reachable'],
              ['Backend', status.connection === 'REVOKED' ? connectionChip : reachable == null ? connectionChip : <Stack direction="row" spacing={1}>{connectionChip}<Chip size="small" variant="outlined" label={reachable ? 'Reachable from this PC' : 'Not reachable from this PC'} /></Stack>],
              ['Server', status.apiBaseUrl || '—'],
              ['Queued events', status.queueDepth],
              ['Dead-letter events', status.deadLetterCount],
              ['Last successful sync', formatDateTime(status.lastSyncAt)],
              ['Last error', status.lastSyncError ?? 'None'],
              ['Policy version applied', status.policyVersion ?? '—'],
            ]}
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {result?.ok && <Alert severity="success" sx={{ mt: 2 }}>Sent {result.accepted} events ({result.duplicates} duplicates skipped, {result.rejected} rejected).</Alert>}
        </Section>
        <Section title="How synchronisation works">
          <KeyValue
            items={[
              ['Batch size', 'Up to 500 events or 1 MB per request'],
              ['Interval', 'Every 30 seconds, or sooner when 200 events are pending'],
              ['Retries', 'Exponential back-off from 2 s to 5 min with jitter; events stay queued'],
              ['Duplicates', 'Every event has a unique id; resending after a failure is safe'],
              ['Rejected events', 'Moved to a dead-letter file and listed under Diagnostics – never silently discarded'],
            ]}
          />
        </Section>
      </Stack>
    </>
  );
}
