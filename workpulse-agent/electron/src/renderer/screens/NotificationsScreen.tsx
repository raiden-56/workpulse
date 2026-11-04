import { Button, Chip, List, ListItem, ListItemText, Typography } from '@mui/material';
import { PageTitle, Section } from '../components/common';
import { formatDateTime, type UiNotification } from '../hooks/useAgent';

export function NotificationsScreen({ notifications, onMarkAllRead }: { notifications: UiNotification[]; onMarkAllRead: () => void }) {
  return (
    <>
      <PageTitle title="Notifications" subtitle="Messages from the background service: approvals, policy changes, update availability and sync problems." />
      <Section title={`${notifications.length} notifications`} action={<Button size="small" onClick={onMarkAllRead} disabled={!notifications.some((n) => !n.read)}>Mark all read</Button>}>
        {notifications.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing yet.
          </Typography>
        ) : (
          <List dense disablePadding>
            {notifications.map((n) => (
              <ListItem key={n.id} disableGutters sx={{ opacity: n.read ? 0.7 : 1 }}>
                <ListItemText
                  primary={
                    <>
                      <Chip size="small" sx={{ mr: 1 }} color={n.level === 'error' ? 'error' : n.level === 'warning' ? 'warning' : 'info'} label={n.level} />
                      {n.title}
                    </>
                  }
                  secondary={`${n.message} · ${formatDateTime(n.at)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Section>
    </>
  );
}
