import { Box } from '@mui/material';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORY_COLORS } from '@/constants/status';
import { formatDuration } from '@/utils/format';
import { chartColors, tooltipStyle } from './chartTheme';
import { EmptyState } from '../common/EmptyState';

export interface BarDatum {
  key: string;
  label: string;
  seconds: number;
  category?: string | null;
}

interface HorizontalBarChartProps {
  data: BarDatum[];
  height?: number;
  ariaLabel: string;
}

export function HorizontalBarChart({ data, height, ariaLabel }: HorizontalBarChartProps) {
  if (!data.length) {
    return <EmptyState compact title="No application usage" description="Foreground application samples will appear here once agents synchronise." />;
  }
  const h = height ?? Math.max(160, data.length * 34 + 24);
  return (
    <Box sx={{ width: '100%', height: h }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={140} tick={{ fill: chartColors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(value) => [formatDuration(Number(value)), 'Foreground time']} cursor={{ fill: 'rgba(116,124,117,0.08)' }} />
          <Bar dataKey="seconds" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={CATEGORY_COLORS[d.category ?? 'UNCLASSIFIED'] ?? chartColors.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
