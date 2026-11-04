import { Box, Button, Chip, FormControlLabel, List, ListItem, ListItemText, Stack, Switch, Typography } from '@mui/material';
import { useState } from 'react';
import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from '@/services/api/notificationsApi';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { SEVERITY_COLORS } from '@/constants/status';
import { formatDateTime, humanize } from '@/utils/format';

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const list = useNotificationsQuery({ unreadOnly, page, size: 20 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, markAllState] = useMarkAllNotificationsReadMutation();

  return (
    <>
      <PageHeader
        title="Notification centre"
        subtitle="Agent, device, policy, attendance and security events addressed to you."
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel control={<Switch checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(0); }} />} label="Unread only" />
            <Button variant="outlined" size="small" onClick={() => markAll()} disabled={markAllState.isLoading}>
              Mark all read
            </Button>
          </Stack>
        }
      />
      <Panel padded={false}>
        {list.isLoading && <LoadingSkeleton variant="list" rows={6} />}
        {list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : null}
        {list.data && list.data.items.length === 0 && <EmptyState title="No notifications" description={unreadOnly ? 'Everything is read.' : 'Alerts appear here as agents, devices and policies generate them.'} />}
        <List disablePadding>
          {(list.data?.items ?? []).map((n) => (
            <ListItem key={n.id} divider sx={{ bgcolor: n.read ? 'transparent' : 'var(--wp-primary-soft)', alignItems: 'flex-start' }}
              secondaryAction={!n.read ? <Button size="small" onClick={() => markRead(n.id)}>Mark read</Button> : undefined}>
              <Box sx={{ mt: 1.1, mr: 1.5, width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: SEVERITY_COLORS[n.severity] ?? SEVERITY_COLORS.LOW }} aria-hidden />
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle2">{n.title}</Typography>
                    <Chip size="small" label={humanize(n.type)} variant="outlined" />
                    <Chip size="small" label={n.severity.toLowerCase()} sx={{ bgcolor: `${SEVERITY_COLORS[n.severity] ?? SEVERITY_COLORS.LOW}22` }} />
                  </Stack>
                }
                secondary={
                  <>
                    {n.body}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {formatDateTime(n.createdAt)} · {n.resolutionStatus.toLowerCase()}
                    </Typography>
                  </>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItem>
          ))}
        </List>
        {list.data && list.data.meta.totalPages > 1 && (
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ p: 1.5 }}>
            <Button size="small" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="small" disabled={page >= list.data.meta.totalPages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </Stack>
        )}
      </Panel>
    </>
  );
}
