import { Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export type StatTone = 'neutral' | 'positive' | 'warning' | 'critical' | 'info' | 'primary';

const TONE_COLORS: Record<StatTone, string> = {
  neutral: 'var(--wp-text-muted)',
  positive: 'var(--wp-positive)',
  warning: 'var(--wp-warning)',
  critical: 'var(--wp-critical)',
  info: 'var(--wp-info)',
  primary: 'var(--wp-primary)',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  loading?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}

export function StatCard({ label, value, hint, icon, tone = 'neutral', loading, onClick, ...rest }: StatCardProps) {
  return (
    <Card
      component={onClick ? 'button' : 'div'}
      onClick={onClick}
      aria-label={rest['aria-label'] ?? `${label}: ${typeof value === 'string' || typeof value === 'number' ? value : ''}`}
      sx={{
        height: '100%',
        textAlign: 'left',
        width: '100%',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        borderLeft: `3px solid ${TONE_COLORS[tone]}`,
        transition: 'border-color 120ms ease, background-color 120ms ease',
        '&:hover': onClick ? { backgroundColor: 'var(--wp-surface-muted)' } : undefined,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </Typography>
          {icon && <Box sx={{ color: TONE_COLORS[tone], display: 'flex', '& svg': { fontSize: 20 } }}>{icon}</Box>}
        </Stack>
        {loading ? (
          <Skeleton width={80} height={36} />
        ) : (
          <Typography variant="h3" component="div" className="wp-tabular" sx={{ mt: 0.5, fontSize: { xs: 22, md: 26 } }}>
            {value}
          </Typography>
        )}
        {hint && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
