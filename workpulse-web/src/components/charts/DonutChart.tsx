import { Box, Stack, Typography } from '@mui/material';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatDuration } from '@/utils/format';
import { tooltipStyle } from './chartTheme';
import { EmptyState } from '../common/EmptyState';

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  ariaLabel: string;
  centerLabel?: string;
  centerValue?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}

export function DonutChart({ data, ariaLabel, centerLabel, centerValue, height = 220, valueFormatter = (v) => formatDuration(v) }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.filter((d) => d.value > 0);
  if (!total) {
    return <EmptyState compact title="Nothing to break down yet" description="Engagement categories appear once application usage is recorded." />;
  }
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
      <Box sx={{ width: '100%', maxWidth: 240, height, position: 'relative' }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={visible} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="90%" paddingAngle={1.5} stroke="none" isAnimationActive={false}>
              {visible.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(value) => [valueFormatter(Number(value)), '']} />
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue) && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Typography variant="h4" className="wp-tabular">
              {centerValue}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {centerLabel}
            </Typography>
          </Box>
        )}
      </Box>
      <Stack spacing={0.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0, flex: 1, width: '100%' }}>
        {visible.map((d) => (
          <Stack key={d.key} component="li" direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: 2, bgcolor: d.color }} />
              <Typography variant="body2">{d.label}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" className="wp-tabular">
              {valueFormatter(d.value)} · {Math.round((d.value / total) * 100)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
