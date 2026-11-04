import { Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { initials } from '@/utils/format';

export function ProfileMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { user, primaryRole, isGuest, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) {
    return null;
  }
  const go = (path: string) => {
    setAnchor(null);
    navigate(path);
  };
  return (
    <>
      <Tooltip title={user.displayName}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small" aria-label="Account menu" aria-haspopup="menu">
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'var(--wp-primary)', fontSize: 13, fontWeight: 700 }}>{initials(user.displayName)}</Avatar>
        </IconButton>
      </Tooltip>
      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ px: 2, py: 1.25, minWidth: 220 }}>
          <Typography variant="subtitle2">{user.displayName}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {user.email}
          </Typography>
          <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
            {isGuest ? 'Guest · read-only' : primaryRole ? ROLE_LABELS[primaryRole] : ''}
            {user.organizationName ? ` · ${user.organizationName}` : ''}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => go(ROUTES.settings)}>
          <ListItemIcon>
            <SettingsOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={() => go(ROUTES.privacy)}>
          <ListItemIcon>
            <ShieldOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Privacy &amp; data
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void signOut();
          }}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {isGuest ? 'Exit Guest Mode' : 'Sign out'}
        </MenuItem>
      </Menu>
    </>
  );
}
