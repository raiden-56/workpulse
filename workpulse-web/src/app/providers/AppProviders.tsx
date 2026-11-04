import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import type { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import type { AppStore } from '@/app/store/store';
import { theme } from '@/styles/theme';

interface AppProvidersProps {
  store: AppStore;
}

export function AppProviders({ store, children }: PropsWithChildren<AppProvidersProps>) {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme} defaultMode="light" noSsr>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </Provider>
  );
}
