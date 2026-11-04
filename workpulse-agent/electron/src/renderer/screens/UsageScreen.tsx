import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { AgentStatus } from '@shared/ipc';
import { PageTitle, Section } from '../components/common';
import { formatDuration } from '../hooks/useAgent';

export function UsageScreen({ status }: { status: AgentStatus }) {
  const total = status.todayUsage.reduce((s, u) => s + u.seconds, 0);
  return (
    <>
      <PageTitle title="Application usage today" subtitle="Foreground time per application as counted on this device. The server classifies applications by your role; this list is not a productivity score." />
      <Section title={`${status.todayUsage.length} applications · ${formatDuration(total)} in the foreground`}>
        {status.todayUsage.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No samples yet. Usage appears here while monitoring is active and you are inside the collection window.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Application</TableCell>
                <TableCell>Process</TableCell>
                <TableCell align="right">Time</TableCell>
                <TableCell align="right">Share</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status.todayUsage.map((u) => (
                <TableRow key={u.processName}>
                  <TableCell>{u.appName}</TableCell>
                  <TableCell sx={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 12 }}>{u.processName}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDuration(u.seconds)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {total ? Math.round((100 * u.seconds) / total) : 0}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
