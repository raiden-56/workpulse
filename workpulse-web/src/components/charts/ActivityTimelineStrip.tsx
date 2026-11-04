import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { ACTIVITY_STATUS_META } from '@/constants/status';
import type { TimelineInterval } from '@/types/activity';
import { dayjs, formatDuration, formatTime } from '@/utils/format';

interface ActivityTimelineStripProps {
  intervals: TimelineInterval[];
  timezone: string;
  date: string;
  height?: number;
}

/** Proportional strip of a day's classified intervals, coloured by state with a reason tooltip. */
export function ActivityTimelineStrip({ intervals, timezone, date, height = 28 }: ActivityTimelineStripProps) {
  const { start, end, ticks } = useMemo(() => {
    const dayStart = dayjs.tz(date, timezone).startOf('day');
    let s = dayStart.add(8, 'hour');
    let e = dayStart.add(19, 'hour');
    for (const i of intervals) {
      if (i.state === 'OFFLINE') {
        continue;
      }
      const a = dayjs(i.startedAt);
      const b = dayjs(i.endedAt);
      if (a.isBefore(s)) s = a.startOf('hour');
      if (b.isAfter(e)) e = b.endOf('hour');
    }
    const tickList: dayjs.Dayjs[] = [];
    for (let t = s; !t.isAfter(e); t = t.add(2, 'hour')) {
      tickList.push(t);
    }
    return { start: s, end: e, ticks: tickList };
  }, [intervals, timezone, date]);

  const total = Math.max(1, end.diff(start, 'second'));
  const visible = intervals.filter((i) => i.state !== 'OFFLINE' && i.durationSeconds > 0);

  if (!visible.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No activity recorded for this day.
      </Typography>
    );
  }

  return (
    <Box>
      <Box
        role="img"
        aria-label={`Activity timeline with ${visible.length} intervals between ${formatTime(start.toISOString(), timezone)} and ${formatTime(end.toISOString(), timezone)}`}
        sx={{ position: 'relative', height, bgcolor: 'var(--wp-surface-muted)', borderRadius: 1, overflow: 'hidden' }}
      >
        {visible.map((i, idx) => {
          const left = Math.max(0, (dayjs(i.startedAt).diff(start, 'second') / total) * 100);
          const width = Math.max(0.3, (i.durationSeconds / total) * 100);
          const meta = ACTIVITY_STATUS_META[i.state];
          return (
            <Tooltip
              key={`${i.startedAt}-${idx}`}
              title={
                <Box>
                  <strong>{meta.label}</strong> · {formatTime(i.startedAt, timezone)}–{formatTime(i.endedAt, timezone)} ({formatDuration(i.durationSeconds)})
                  {i.appName && <div>{i.appName}</div>}
                  {i.reason && <div style={{ opacity: 0.85 }}>{i.reason}</div>}
                </Box>
              }
            >
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, bgcolor: meta.color, '&:hover': { filter: 'brightness(1.1)' } }} />
            </Tooltip>
          );
        })}
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        {ticks.map((t) => (
          <Typography key={t.valueOf()} variant="caption" color="text.secondary" className="wp-tabular">
            {t.format('HH:mm')}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

export function TimelineLegend() {
  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {(Object.keys(ACTIVITY_STATUS_META) as (keyof typeof ACTIVITY_STATUS_META)[])
        .filter((k) => k !== 'OFFLINE')
        .map((k) => (
          <Stack key={k} component="li" direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: ACTIVITY_STATUS_META[k].color }} />
            <Typography variant="caption">{ACTIVITY_STATUS_META[k].label}</Typography>
          </Stack>
        ))}
    </Stack>
  );
}
