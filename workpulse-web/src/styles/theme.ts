import { createTheme, type ThemeOptions } from '@mui/material/styles';

/** Design tokens (docs/architecture/DESIGN_SYSTEM.md). */
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
    primaryHover: '#8FBB9E',
    primarySoft: '#2D3A31',
    positive: '#6FA985',
    warning: '#D4A364',
    critical: '#D0847C',
    info: '#8AA7B8',
    nav: '#141715',
    navText: '#C9CFCA',
  },
} as const;

const fontFamily = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const monoFontFamily = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const shared: ThemeOptions = {
  shape: { borderRadius: 10 },
  typography: {
    fontFamily,
    fontSize: 14,
    h1: { fontSize: 36, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
    h2: { fontSize: 28, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.015em' },
    h3: { fontSize: 22, fontWeight: 600, lineHeight: 1.25 },
    h4: { fontSize: 18, fontWeight: 600, lineHeight: 1.3 },
    h5: { fontSize: 16, fontWeight: 600, lineHeight: 1.35 },
    h6: { fontSize: 14, fontWeight: 600, lineHeight: 1.4 },
    subtitle1: { fontSize: 14, fontWeight: 500 },
    subtitle2: { fontSize: 13, fontWeight: 500 },
    body1: { fontSize: 14 },
    body2: { fontSize: 13 },
    caption: { fontSize: 12 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
};

export const theme = createTheme({
  ...shared,
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: tokens.light.primary, dark: tokens.light.primaryHover, light: tokens.light.primarySoft, contrastText: '#FFFFFF' },
        secondary: { main: tokens.light.info },
        success: { main: tokens.light.positive },
        warning: { main: tokens.light.warning },
        error: { main: tokens.light.critical },
        info: { main: tokens.light.info },
        background: { default: tokens.light.bg, paper: tokens.light.surface },
        text: { primary: tokens.light.text, secondary: tokens.light.textMuted },
        divider: tokens.light.border,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: tokens.dark.primary, dark: tokens.dark.primaryHover, light: tokens.dark.primarySoft, contrastText: '#141715' },
        secondary: { main: tokens.dark.info },
        success: { main: tokens.dark.positive },
        warning: { main: tokens.dark.warning },
        error: { main: tokens.dark.critical },
        info: { main: tokens.dark.info },
        background: { default: tokens.dark.bg, paper: tokens.dark.surface },
        text: { primary: tokens.dark.text, secondary: tokens.dark.textMuted },
        divider: tokens.dark.border,
      },
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme: t }) => ({
          backgroundImage: 'none',
          border: `1px solid ${t.vars?.palette.divider ?? t.palette.divider}`,
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 6, paddingInline: 14, minHeight: 36 },
        sizeSmall: { minHeight: 30 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 500 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          '& .MuiTableCell-head': {
            background: t.vars?.palette.background.default ?? t.palette.background.default,
            color: t.vars?.palette.text.secondary ?? t.palette.text.secondary,
            fontWeight: 600,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { paddingBlock: 10, borderBottomColor: 'var(--wp-border)' },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: { fontSize: 12.5, borderRadius: 6, padding: '8px 10px', maxWidth: 360 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 14, boxShadow: 'var(--wp-shadow-popover)' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 10, boxShadow: 'var(--wp-shadow-popover)' },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { borderRadius: 10, boxShadow: 'var(--wp-shadow-popover)' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRadius: 0, boxShadow: 'var(--wp-shadow-popover)' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, minHeight: 44 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
});

export type AppTheme = typeof theme;
