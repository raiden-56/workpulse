import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { PropsWithChildren, ReactNode } from 'react';

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
  minHeight?: number;
}

/** Card with a consistent header row; the workhorse container of every dashboard. */
export function Panel({ title, subtitle, actions, padded = true, minHeight, children }: PropsWithChildren<PanelProps>) {
  return (
    <Card sx={{ height: '100%', minHeight, display: 'flex', flexDirection: 'column' }}>
      {(title || actions) && (
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ px: 2, pt: 2, pb: padded ? 0 : 1.5 }}>
          <Box>
            {title && (
              <Typography variant="h5" component="h2">
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary" component="div">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions}
        </Stack>
      )}
      {padded ? <CardContent sx={{ flex: 1, pt: title ? 1.5 : 2, '&:last-child': { pb: 2 } }}>{children}</CardContent> : <Box sx={{ flex: 1 }}>{children}</Box>}
    </Card>
  );
}

export function KeyValueList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 40%) 1fr', rowGap: 1, columnGap: 2, m: 0 }}>
      {items.map((item) => (
        <Box key={item.label} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {item.label}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, wordBreak: 'break-word' }}>
            {item.value ?? '–'}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
