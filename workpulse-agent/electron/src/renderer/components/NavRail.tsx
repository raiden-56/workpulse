import type { ReactElement } from 'react';
import { Badge, Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { tokens } from '../theme';

export type Screen = 'home' | 'usage' | 'sync' | 'privacy' | 'settings' | 'help' | 'notifications' | 'diagnostics' | 'login' | 'register';

const ITEMS: Array<{ id: Screen; label: string; icon: ReactElement; requiresRegistration?: boolean }> = [
  { id: 'home', label: 'Home', icon: <HomeOutlinedIcon fontSize="small" /> },
  { id: 'usage', label: 'Application usage', icon: <AppsOutlinedIcon fontSize="small" />, requiresRegistration: true },
  { id: 'sync', label: 'Sync & connection', icon: <SyncOutlinedIcon fontSize="small" /> },
  { id: 'privacy', label: 'Privacy', icon: <ShieldOutlinedIcon fontSize="small" /> },
  { id: 'notifications', label: 'Notifications', icon: <NotificationsNoneIcon fontSize="small" /> },
  { id: 'settings', label: 'Settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
  { id: 'diagnostics', label: 'Diagnostics', icon: <BugReportOutlinedIcon fontSize="small" /> },
  { id: 'help', label: 'Help centre', icon: <HelpOutlineIcon fontSize="small" /> },
];

export function NavRail({ screen, onSelect, registered, unread, employeeName }: { screen: Screen; onSelect: (s: Screen) => void; registered: boolean; unread: number; employeeName: string | null }) {
  const t = tokens.light;
  return (
    <Box sx={{ width: 232, bgcolor: t.nav, color: t.navText, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#FFFFFF', letterSpacing: 0.2 }}>
          WorkPulse Agent
        </Typography>
        <Typography variant="caption" sx={{ color: t.navText, opacity: 0.8 }}>
          {employeeName ?? 'Not signed in'}
        </Typography>
      </Box>
      <List dense sx={{ px: 1, flex: 1 }}>
        {!registered && (
          <NavItem active={screen === 'login' || screen === 'register'} icon={<LoginOutlinedIcon fontSize="small" />} label="Sign in & register" onClick={() => onSelect('login')} />
        )}
        {ITEMS.filter((item) => registered || !item.requiresRegistration).map((item) => (
          <NavItem
            key={item.id}
            active={screen === item.id}
            icon={item.id === 'notifications' && unread > 0 ? <Badge color="warning" badgeContent={unread}>{item.icon}</Badge> : item.icon}
            label={item.label}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </List>
      <Typography variant="caption" sx={{ px: 2.5, py: 2, opacity: 0.6 }}>
        Transparent by design: this window always shows what is collected.
      </Typography>
    </Box>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactElement; label: string; onClick: () => void }) {
  return (
    <ListItemButton
      selected={active}
      onClick={onClick}
      sx={{
        borderRadius: 1.5,
        mb: 0.5,
        color: 'inherit',
        '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.10)', color: '#FFFFFF' },
        '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
      }}
    >
      <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2', fontWeight: active ? 600 : 500 }} />
    </ListItemButton>
  );
}
