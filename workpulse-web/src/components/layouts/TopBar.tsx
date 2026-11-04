import { AppBar, Box, Button, Chip, IconButton, Stack, Toolbar, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useResetDemoDataMutation } from '@/services/api/guestApi';
import { dayjs } from '@/utils/format';
import { DemoBadge } from '../common/DemoBadge';
import { ThemeToggle } from '../common/ThemeToggle';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GlobalSearch } from './GlobalSearch';
import { NotificationPopover } from './NotificationPopover';
import { OrgSwitcher } from './OrgSwitcher';
import { ProfileMenu } from './ProfileMenu';

interface TopBarProps {
  onOpenMobileNav: () => void;
}

export function TopBar({ onOpenMobileNav }: TopBarProps) {
  const { user, isDemoGuest, isGuest, signOut } = useAuth();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetDemo, resetState] = useResetDemoDataMutation();

  const expiresIn = user?.guestExpiresAt ? dayjs(user.guestExpiresAt).fromNow(true) : null;

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid var(--wp-border)', bgcolor: 'background.paper', zIndex: (t) => t.zIndex.drawer - 1 }}>
      <Toolbar sx={{ minHeight: 'var(--wp-topbar-height) !important', gap: 1, px: { xs: 1.5, md: 3 } }}>
        <IconButton edge="start" onClick={onOpenMobileNav} aria-label="Open navigation" sx={{ display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>
        <GlobalSearch />
        <Box sx={{ flex: 1 }} />
        {isDemoGuest && (
          <Stack direction="row" spacing={1} alignItems="center">
            <DemoBadge compact />
            {expiresIn && (
              <Tooltip title="Demo sessions expire automatically; start a new one from the login page at any time.">
                <Chip size="small" variant="outlined" label={`ends in ${expiresIn}`} sx={{ display: { xs: 'none', sm: 'flex' } }} />
              </Tooltip>
            )}
            <Tooltip title="Regenerate the simulated organisation (rate-limited)">
              <span>
                <Button size="small" startIcon={<RestartAltOutlinedIcon />} onClick={() => setResetOpen(true)} sx={{ display: { xs: 'none', lg: 'inline-flex' } }}>
                  Reset demo data
                </Button>
              </span>
            </Tooltip>
            <Button size="small" variant="outlined" startIcon={<LogoutOutlinedIcon />} onClick={() => void signOut()} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              Exit Guest Mode
            </Button>
          </Stack>
        )}
        {isGuest && !isDemoGuest && <Chip size="small" color="info" variant="outlined" label="Guest · read-only" />}
        <OrgSwitcher />
        <NotificationPopover />
        <ThemeToggle />
        <ProfileMenu />
      </Toolbar>
      <ConfirmDialog
        open={resetOpen}
        title="Reset demo data?"
        description="The simulated organisation will be regenerated: employees, devices, policies and the last two weeks of activity. This only affects the demo tenant."
        confirmLabel="Regenerate"
        busy={resetState.isLoading}
        error={resetState.error}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          void resetDemo()
            .unwrap()
            .then(() => setResetOpen(false))
            .catch(() => undefined);
        }}
      />
    </AppBar>
  );
}
