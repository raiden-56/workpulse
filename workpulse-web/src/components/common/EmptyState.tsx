import { Box, Stack, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, icon, action, compact }: EmptyStateProps) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: compact ? 3 : 6, px: 2, textAlign: 'center' }}>
      <Box sx={{ color: 'text.secondary', '& svg': { fontSize: compact ? 32 : 44 } }}>{icon ?? <InboxOutlinedIcon />}</Box>
      <Typography variant="h5">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}
