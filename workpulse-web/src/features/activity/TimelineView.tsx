import { Box, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useTimelineQuery } from '@/services/api/activityApi';
import { ActivityTimelineStrip, TimelineLegend } from '@/components/charts/ActivityTimelineStrip';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { Panel } from '@/components/common/Panel';
import { StatusChip } from '@/components/common/StatusChip';
import { formatDuration, formatTime } from '@/utils/format';
import type { TimelineSummary } from '@/types/activity';

interface TimelineViewProps {
  employeeId?: string;
  date: string;
  onDateChange?: (date: string) => void;
  showIntervals?: boolean;
  compact?: boolean;
}

export function summaryTiles(summary: TimelineSummary) {
  return [
    { label: 'Session', value: summary.sessionSeconds, color: 'var(--wp-text)' },
    { label: 'Active', value: summary.activeSeconds, color: '#4E8866' },
    { label: 'Focus', value: summary.focusSeconds, color: '#3F7A5A' },
    { label: 'Meetings', value: summary.meetingSeconds, color: '#5B7A8C' },
    { label: 'Idle', value: summary.idleSeconds, color: '#C18B43' },
    { label: 'Breaks', value: summary.breakSeconds, color: '#A89A6B' },
    { label: 'Locked', value: summary.lockedSeconds, color: '#8A8F8B' },
  ];
}

/** A day's classified activity for one employee: strip, summary, top apps and explained intervals. */
export function TimelineView({ employeeId, date, onDateChange, showIntervals = true, compact }: TimelineViewProps) {
  const timeline = useTimelineQuery({ employeeId, date });

  return (
    <Stack spacing={2}>
      {onDateChange && (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField type="date" label="Day" value={date} onChange={(e) => onDateChange(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          {timeline.data && (
            <Typography variant="caption" color="text.secondary">
              Times shown in {timeline.data.timezone}
            </Typography>
          )}
        </Stack>
      )}
      {timeline.isLoading && <LoadingSkeleton variant="list" rows={4} />}
      {timeline.error ? <ErrorState error={timeline.error} onRetry={() => timeline.refetch()} /> : null}
      {timeline.data && (
        <>
          <Box>
            <ActivityTimelineStrip intervals={timeline.data.intervals} timezone={timeline.data.timezone} date={timeline.data.date} height={compact ? 20 : 28} />
            <Box sx={{ mt: 1 }}>
              <TimelineLegend />
            </Box>
          </Box>
          <Grid container spacing={1}>
            {summaryTiles(timeline.data.summary).map((t) => (
              <Grid key={t.label} size={{ xs: 6, sm: 4, md: compact ? 4 : 'grow' }}>
                <Box sx={{ p: 1.25, border: '1px solid var(--wp-border)', borderRadius: 1.5, borderLeft: `3px solid ${t.color}` }}>
                  <Typography variant="caption" color="text.secondary">
                    {t.label}
                  </Typography>
                  <Typography variant="subtitle1" className="wp-tabular">
                    {formatDuration(t.value, { compact: true })}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Typography variant="caption" color="text.secondary">
            First event {formatTime(timeline.data.summary.firstEventAt, timeline.data.timezone)} · last event {formatTime(timeline.data.summary.lastEventAt, timeline.data.timezone)} ·{' '}
            {timeline.data.summary.applicationSwitches} application switches · {timeline.data.summary.unknownSeconds > 0 ? `${formatDuration(timeline.data.summary.unknownSeconds, { compact: true })} without agent data` : 'continuous agent data'}
          </Typography>
          {timeline.data.topApplications.length > 0 && (
            <Panel title="Top applications" subtitle="Foreground time on this day">
              <HorizontalBarChart
                ariaLabel="Foreground time per application for this day"
                data={timeline.data.topApplications.map((a) => ({ key: a.processName, label: a.appName ?? a.processName, seconds: a.durationSeconds, category: a.category }))}
              />
            </Panel>
          )}
          {showIntervals && (
            <Panel title="Intervals" subtitle="Every classification carries the reason it was made" padded={false}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Application</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timeline.data.intervals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography variant="body2" color="text.secondary">
                            No intervals for this day.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {timeline.data.intervals.map((i, idx) => (
                      <TableRow key={`${i.startedAt}-${idx}`}>
                        <TableCell className="wp-tabular">{formatTime(i.startedAt, timeline.data!.timezone)}</TableCell>
                        <TableCell className="wp-tabular">{formatTime(i.endedAt, timeline.data!.timezone)}</TableCell>
                        <TableCell className="wp-tabular">{formatDuration(i.durationSeconds, { compact: true })}</TableCell>
                        <TableCell>
                          <StatusChip kind="activity" value={i.state} />
                        </TableCell>
                        <TableCell>{i.appName ?? i.processName ?? '–'}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{i.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Panel>
          )}
        </>
      )}
    </Stack>
  );
}
