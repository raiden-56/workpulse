import { Box } from '@mui/material';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyTrend } from '@/types/dashboard';
import { dayjs } from '@/utils/format';
import { chartColors, tooltipStyle } from './chartTheme';
import { EmptyState } from '../common/EmptyState';

interface TrendLineChartProps {
  data: DailyTrend[];
  height?: number;
  showEmployees?: boolean;
}

export function TrendLineChart({ data, height = 260, showEmployees = true }: TrendLineChartProps) {
  if (!data.length) {
    return <EmptyState compact title="No activity in this range" description="Trends appear once agents report activity for the selected days." />;
  }
  const rows = data.map((d) => ({ ...d, label: dayjs(d.day).format('DD MMM') }));
  return (
    <Box sx={{ width: '100%', height }} role="img" aria-label={`Daily trend of foreground hours${showEmployees ? ' and active employees' : ''} over ${data.length} days`}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: chartColors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="hours" tick={{ fill: chartColors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          {showEmployees && <YAxis yAxisId="employees" orientation="right" tick={{ fill: chartColors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />}
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="hours" type="monotone" dataKey="foregroundHours" name="Foreground hours" stroke={chartColors.primary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          {showEmployees && (
            <Line yAxisId="employees" type="monotone" dataKey="activeEmployees" name="Active employees" stroke={chartColors.secondary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
