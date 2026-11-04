import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { Diagnostics } from '@shared/ipc';
import type { AppInfo } from '@shared/bridge';
import { KeyValue, PageTitle, Section } from '../components/common';
import { formatDateTime } from '../hooks/useAgent';

export function DiagnosticsScreen({ connected, appInfo }: { connected: boolean; appInfo: AppInfo | null }) {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDiag(await window.workpulse.getDiagnostics());
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  }, []);

  useEffect(() => {
    if (connected) {
      void load();
    }
  }, [connected, load]);

  return (
    <>
      <PageTitle title="Diagnostics" subtitle="Technical details for IT support. Share this screen when reporting a problem; it contains no activity content." />
      <Stack spacing={2}>
        {!connected && <Alert severity="error">The background service is not reachable. Check that the "WorkPulse Agent" Windows service is running (services.msc).</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {diag?.mock && <Alert severity="warning">Mock service (development): these numbers are simulated.</Alert>}
        <Section title="Versions" action={<Button size="small" onClick={load} disabled={!connected}>Refresh</Button>}>
          <KeyValue
            items={[
              ['UI', appInfo?.version ?? '—'],
              ['Service', diag?.versions.service ?? '—'],
              ['Collector', diag?.versions.collector ?? '—'],
              ['IPC protocol', diag ? `v${diag.versions.protocol}` : '—'],
              ['Electron / Chromium / Node', appInfo ? `${appInfo.electron} / ${appInfo.chrome} / ${appInfo.node}` : '—'],
            ]}
          />
        </Section>
        <Section title="Local queue">
          <KeyValue
            items={[
              ['Pending events', diag?.queue.depth ?? '—'],
              ['Files / bytes', diag ? `${diag.queue.files} / ${diag.queue.bytes.toLocaleString()}` : '—'],
              ['Oldest pending event', formatDateTime(diag?.queue.oldestEventAt)],
              ['Sequence counter', diag?.queue.sequence ?? '—'],
              ['Last batch', diag?.lastBatch ? `${formatDateTime(diag.lastBatch.at)} · ${diag.lastBatch.accepted} accepted, ${diag.lastBatch.duplicates} duplicates, ${diag.lastBatch.rejected} rejected` : '—'],
              ...Object.entries(diag?.paths ?? {}).map(([k, v]) => [`Path: ${k}`, v] as [string, string]),
            ]}
          />
        </Section>
        <Section title={`Dead-letter events (${diag?.deadLetters.length ?? 0})`}>
          {!diag || diag.deadLetters.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              None. Events rejected by the server would be listed here with the reason, never discarded silently.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Event id</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {diag.deadLetters.map((d) => (
                  <TableRow key={d.eventId}>
                    <TableCell>{formatDateTime(d.at)}</TableCell>
                    <TableCell>{d.type}</TableCell>
                    <TableCell sx={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>{d.eventId}</TableCell>
                    <TableCell>{d.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
        <Section title={`Recent errors (${diag?.recentErrors.length ?? 0})`}>
          {!diag || diag.recentErrors.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No recent errors.
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {diag.recentErrors.map((e, i) => (
                <Typography key={i} variant="body2" sx={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>
                  {formatDateTime(e.at)} — {e.message}
                </Typography>
              ))}
            </Stack>
          )}
        </Section>
      </Stack>
    </>
  );
}
