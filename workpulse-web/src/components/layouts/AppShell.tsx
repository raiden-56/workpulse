import { Alert, Box, Container, Drawer, useMediaQuery, useTheme } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation, useOutlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { mobileNavSet, sidebarToggled } from '@/app/store/slices/uiSlice';
import { useAuth } from '@/hooks/useAuth';
import { Breadcrumbs } from './Breadcrumbs';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MotionPage } from '../common/MotionPage';

const EXPANDED = 240;
const COLLAPSED = 72;

/** Application frame: collapsible sidebar, top bar, breadcrumb row and animated page outlet. */
export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const mobileOpen = useAppSelector((s) => s.ui.mobileNavOpen);
  const { isDemoGuest, user, isSuperAdmin, organizationOverride } = useAuth();
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();
  const width = collapsed ? COLLAPSED : EXPANDED;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isDesktop ? (
        <motion.aside
          animate={{ width }}
          initial={false}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, duration: 0.22 }}
          style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0, overflow: 'hidden' }}
        >
          <Sidebar collapsed={collapsed} onToggleCollapse={() => dispatch(sidebarToggled())} />
        </motion.aside>
      ) : (
        <Drawer open={mobileOpen} onClose={() => dispatch(mobileNavSet(false))} ModalProps={{ keepMounted: true }} slotProps={{ paper: { sx: { width: EXPANDED, border: 'none' } } }}>
          <Sidebar collapsed={false} onNavigate={() => dispatch(mobileNavSet(false))} />
        </Drawer>
      )}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar onOpenMobileNav={() => dispatch(mobileNavSet(true))} />
        <Box component="main" className={isDemoGuest ? 'wp-demo-watermark' : undefined} sx={{ flex: 1, position: 'relative', zIndex: 0 }}>
          <Container maxWidth={false} sx={{ maxWidth: 1600, py: { xs: 2, md: 3 }, px: { xs: 2, md: 3 }, position: 'relative', zIndex: 2 }}>
            {isDemoGuest && (
              <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
                You are exploring <strong>{user?.organizationName ?? 'the demo organisation'}</strong>, a simulated organisation. Every employee, device and activity record is generated; nothing here is real monitoring data.
              </Alert>
            )}
            {isSuperAdmin && !organizationOverride && location.pathname !== '/' && location.pathname !== '/organizations' && (
              <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
                Select an organisation in the top bar to view tenant data as a super admin.
              </Alert>
            )}
            <Breadcrumbs />
            <AnimatePresence mode="wait" initial={false}>
              <MotionPage key={location.pathname}>{outlet}</MotionPage>
            </AnimatePresence>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
