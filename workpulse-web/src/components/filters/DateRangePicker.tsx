import { MenuItem, Stack, TextField } from '@mui/material';
import { useMemo } from 'react';
import { dayjs } from '@/utils/format';

export interface DateRange {
  from: string;
  to: string;
}

type Preset = 'today' | '7d' | '14d' | '30d' | 'thisMonth' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

export function presetRange(preset: Exclude<Preset, 'custom'>, tz?: string | null): DateRange {
  const now = tz ? dayjs().tz(tz) : dayjs();
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
  switch (preset) {
    case 'today':
      return { from: fmt(now), to: fmt(now) };
    case '7d':
      return { from: fmt(now.subtract(6, 'day')), to: fmt(now) };
    case '14d':
      return { from: fmt(now.subtract(13, 'day')), to: fmt(now) };
    case '30d':
      return { from: fmt(now.subtract(29, 'day')), to: fmt(now) };
    case 'thisMonth':
      return { from: fmt(now.startOf('month')), to: fmt(now) };
  }
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  timezone?: string | null;
}

export function DateRangePicker({ value, onChange, timezone }: DateRangePickerProps) {
  const preset = useMemo<Preset>(() => {
    for (const p of PRESETS) {
      if (p.value === 'custom') continue;
      const r = presetRange(p.value, timezone);
      if (r.from === value.from && r.to === value.to) {
        return p.value;
      }
    }
    return 'custom';
  }, [value, timezone]);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField
        select
        label="Range"
        value={preset}
        onChange={(e) => {
          const next = e.target.value as Preset;
          if (next !== 'custom') {
            onChange(presetRange(next, timezone));
          }
        }}
        sx={{ minWidth: 150 }}
      >
        {PRESETS.map((p) => (
          <MenuItem key={p.value} value={p.value}>
            {p.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        type="date"
        label="From"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: value.to } }}
      />
      <TextField
        type="date"
        label="To"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: value.from } }}
      />
    </Stack>
  );
}
