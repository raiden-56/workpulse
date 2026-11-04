import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Box, CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import type { LoginUser } from '@shared/bridge';
import { NavRail, type Screen } from './components/NavRail';
import { StatusBanner } from './components/StatusBanner';
import { useAgent } from './hooks/useAgent';
import { buildTheme } from './theme';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { HomeScreen } from './screens/HomeScreen';
import { UsageScreen } from './screens/UsageScreen';
import { SyncScreen } from './screens/SyncScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpScreen } from './screens/HelpScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen';

export function App() {
  const agent = useAgent();
  const { status, connected, settings, appInfo, notifications } = agent;
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode = settings?.theme === 'dark' || (settings?.theme === 'system' && prefersDark) ? 'dark' : 'light';
  const theme = useMemo(() => buildTheme(mode), [mode]);
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<LoginUser | null>(null);

  // Until the device is registered the home screen is the sign-in / registration flow.
  useEffect(() => {
    if (!status.registered && screen === 'home') {
      setScreen(user ? 'register' : 'login');
    }
    if (status.registered && (screen === 'login' || screen === 'register')) {
      setScreen('home');
    }
  }, [status.registered, screen, user]);

  const unread = notifications.filter((n) => !n.read).length;

  let content: ReactElement;
  switch (screen) {
    case 'login':
      content = (
        <LoginScreen
          settings={settings}
          onSignedIn={(u) => {
            setUser(u);
            setScreen('register');
          }}
          onOpenSettings={() => setScreen('settings')}
        />
      );
      break;
    case 'register':
      content = <RegisterScreen user={user} status={status} connected={connected} onBack={() => setScreen('login')} onRegistered={() => agent.refresh()} />;
      break;
    case 'usage':
      content = <UsageScreen status={status} />;
      break;
    case 'sync':
      content = <SyncScreen status={status} connected={connected} onRefresh={agent.refresh} />;
      break;
    case 'privacy':
      content = <PrivacyScreen status={status} />;
      break;
    case 'settings':
      content = <SettingsScreen settings={settings} onSave={agent.saveSettings} appInfo={appInfo} />;
      break;
    case 'help':
      content = <HelpScreen />;
      break;
    case 'notifications':
      content = <NotificationsScreen notifications={notifications} onMarkAllRead={agent.markAllRead} />;
      break;
    case 'diagnostics':
      content = <DiagnosticsScreen connected={connected} appInfo={appInfo} />;
      break;
    default:
      content = <HomeScreen status={status} connected={connected} onRefresh={agent.refresh} onNavigate={setScreen} />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <NavRail screen={screen} onSelect={setScreen} registered={status.registered} unread={unread} employeeName={status.employee?.name ?? user?.displayName ?? null} />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: 'background.default' }}>
          <StatusBanner status={status} connected={connected} serviceLink={appInfo?.serviceLink ?? null} />
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>{content}</Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
