import { createTheme, type Theme } from '@mui/material/styles';

/** Design tokens from docs/architecture/DESIGN_SYSTEM.md. */
export const tokens = {
  light: {
    bg: '#F6F6F2',
    surface: '#FFFFFF',
    surfaceMuted: '#EFF0EB',
    text: '#252A27',
    textMuted: '#747C75',
    border: '#E4E7E1',
    primary: '#547B62',
    primaryHover: '#476A54',
    primarySoft: '#E6EEE8',
    positive: '#4E8866',
    warning: '#C18B43',
    critical: '#B75E56',
    info: '#5B7A8C',
    nav: '#252B27',
    navText: '#D9DED8',
  },
  dark: {
    bg: '#1A1D1B',
    surface: '#232724',
    surfaceMuted: '#2B302C',
    text: '#ECEEEA',
    textMuted: '#9AA39C',
    border: '#343A35',
    primary: '#7AA98A',
    primaryHover: '#8FBA9E',
    primarySoft: '#2D3A31',
    positive: '#6FA885',
    warning: '#D2A15F',
    critical: '#CC7A72',
    info: '#7D9AAB',
    nav: '#141715',
    navText: '#D9DED8',
  },
} as const;

export const statusColors = {
  ACTIVE: 'positive',
  PAUSED_OUTSIDE_WINDOW: 'warning',
  STOPPED: 'critical',
  REVOKED: 'critical',
  PENDING_APPROVAL: 'info',
  NOT_REGISTERED: 'textMuted',
} as const;

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const t = tokens[mode];
  return createTheme({
    palette: {
      mode,
      primary: { main: t.primary, dark: t.primaryHover, contrastText: '#FFFFFF' },
      success: { main: t.positive },
      warning: { main: t.warning },
      error: { main: t.critical },
      info: { main: t.info },
      background: { default: t.bg, paper: t.surface },
      text: { primary: t.text, secondary: t.textMuted },
      divider: t.border,
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
      fontSize: 14,
      h5: { fontWeight: 600, fontSize: 22, lineHeight: 1.25 },
      h6: { fontWeight: 600, fontSize: 16, lineHeight: 1.25 },
      subtitle2: { fontWeight: 600 },
      body2: { fontSize: 13 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${t.border}`, boxShadow: 'none' } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 600 } } },
      MuiTableCell: { styleOverrides: { head: { backgroundColor: t.surfaceMuted, fontWeight: 600, color: t.textMuted } } },
    },
  });
}
