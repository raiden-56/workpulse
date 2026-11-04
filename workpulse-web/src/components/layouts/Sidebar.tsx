import { Box, Chip, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_ITEMS, NAV_SECTION_LABELS, type NavItem } from '@/constants/navigation';
import { usePermission } from '@/hooks/usePermission';
import { Brand } from './Brand';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

export function visibleNavItems(can: (p: string | readonly string[] | undefined) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => can(item.permission));
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const { can } = usePermission();
  const location = useLocation();
  const items = visibleNavItems(can);
  const sections = (['overview', 'workforce', 'governance', 'account'] as const).filter((s) => items.some((i) => i.section === s));

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--wp-nav)',
        color: 'var(--wp-nav-text)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: collapsed ? 1.5 : 2, height: 'var(--wp-topbar-height)', display: 'flex', alignItems: 'center' }}>
        <Brand compact={collapsed} light />
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {sections.map((section) => (
          <List
            key={section}
            dense
            subheader={
              !collapsed ? (
                <ListSubheader disableSticky sx={{ bgcolor: 'transparent', color: 'rgba(217,222,216,0.55)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '32px' }}>
                  {NAV_SECTION_LABELS[section]}
                </ListSubheader>
              ) : undefined
            }
            sx={{ px: 1 }}
          >
            {items
              .filter((i) => i.section === section)
              .map((item) => {
                const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                const Icon = item.icon;
                const button = (
                  <ListItemButton
                    component={NavLink}
                    to={item.path}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.25,
                      minHeight: 38,
                      px: collapsed ? 1.25 : 1.5,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      color: active ? '#fff' : 'inherit',
                      bgcolor: active ? 'var(--wp-nav-active)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: active ? 'var(--wp-primary)' : 'inherit', '& svg': { fontSize: 20 } }}>
                      <Icon />
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 500, noWrap: true }} />
                    )}
                    {!collapsed && item.planned && (
                      <Chip label="Soon" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.1)', color: 'inherit' }} />
                    )}
                  </ListItemButton>
                );
                return collapsed ? (
                  <Tooltip key={item.id} title={`${item.label}${item.planned ? ' (planned)' : ''}`} placement="right">
                    {button}
                  </Tooltip>
                ) : (
                  <Box key={item.id}>{button}</Box>
                );
              })}
          </List>
        ))}
      </Box>
      {onToggleCollapse && (
        <Box sx={{ p: 1, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <IconButton size="small" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} sx={{ color: 'inherit' }}>
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
