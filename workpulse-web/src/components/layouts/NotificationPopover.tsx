import { Badge, Box, Button, Divider, IconButton, List, ListItemButton, ListItemText, Popover, Stack, Tooltip, Typography } from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery, useUnreadCountQuery } from '@/services/api/notificationsApi';
import { SEVERITY_COLORS } from '@/constants/status';
import { ROUTES } from '@/constants/routes';
import { formatRelative } from '@/utils/format';
import { usePermission } from '@/hooks/usePermission';
import { P } from '@/constants/permissions';

export function NotificationPopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { can } = usePermission();
  const enabled = can(P.NOTIFICATION_VIEW);
  const unread = useUnreadCountQuery(undefined, { skip: !enabled, pollingInterval: 60_000 });
  const list = useNotificationsQuery({ page: 0, size: 8 }, { skip: !enabled || !anchor });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, markAllState] = useMarkAllNotificationsReadMutation();

  if (!enabled) {
    return null;
  }
  const count = unread.data?.unread ?? 0;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Notifications, ${count} unread`} aria-haspopup="dialog">
          <Badge badgeContent={count} color="error" max={99}>
            <NotificationsOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 24px)' } } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="h6">Notifications</Typography>
          <Button size="small" onClick={() => markAll()} disabled={count === 0 || markAllState.isLoading}>
            Mark all read
          </Button>
        </Stack>
        <Divider />
        <List dense disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {(list.data?.items ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {list.isLoading ? 'Loading…' : 'You are all caught up.'}
            </Typography>
          )}
          {(list.data?.items ?? []).map((n) => (
            <ListItemButton
              key={n.id}
              onClick={() => {
                if (!n.read) {
                  markRead(n.id);
                }
              }}
              sx={{ alignItems: 'flex-start', gap: 1.5, bgcolor: n.read ? 'transparent' : 'var(--wp-primary-soft)' }}
            >
              <Box sx={{ mt: 0.9, width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: SEVERITY_COLORS[n.severity] ?? SEVERITY_COLORS.LOW }} aria-hidden />
              <ListItemText
                primary={n.title}
                secondary={
                  <>
                    {n.body}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      {formatRelative(n.createdAt)}
                    </Typography>
                  </>
                }
                primaryTypographyProps={{ fontWeight: n.read ? 500 : 700, fontSize: 13.5 }}
                secondaryTypographyProps={{ component: 'div', fontSize: 12.5 }}
              />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              setAnchor(null);
              navigate(ROUTES.notifications);
            }}
          >
            Open notification centre
          </Button>
        </Box>
      </Popover>
    </>
  );
}
