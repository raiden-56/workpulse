import { render, type RenderOptions } from '@testing-library/react';
import type { PropsWithChildren, ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { makeStore, type AppStore } from '@/app/store/store';
import { initialAuthState } from '@/app/store/slices/authSlice';
import { initialUiState } from '@/app/store/slices/uiSlice';
import { theme } from '@/styles/theme';
import type { MeResponse } from '@/types/auth';

export function makeUser(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    userId: 'u-1',
    email: 'user@example.com',
    displayName: 'Test User',
    organizationId: 'org-1',
    organizationName: 'Test Org',
    organizationTimezone: 'UTC',
    demoOrganization: false,
    employeeId: null,
    roles: ['EMPLOYEE'],
    permissions: ['DASHBOARD_VIEW', 'SELF_VIEW'],
    scope: { level: 'SELF', departmentIds: [], teamIds: [], employeeId: null },
    guestType: null,
    guestPersona: null,
    guestExpiresAt: null,
    ...overrides,
  };
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  user?: MeResponse | null;
  route?: string;
  organizationOverride?: string | null;
  store?: AppStore;
}

export function renderWithProviders(ui: ReactElement, { user = makeUser(), route = '/', organizationOverride = null, store, ...options }: Options = {}) {
  const testStore =
    store ??
    makeStore({
      auth: {
        ...initialAuthState,
        status: user ? 'authenticated' : 'anonymous',
        user,
        accessToken: user ? 'test-token' : null,
        refreshToken: user ? 'test-refresh' : null,
        organizationOverride,
      },
      ui: initialUiState,
    });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme} defaultMode="light" noSsr>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ThemeProvider>
      </Provider>
    );
  }
  return { store: testStore, ...render(ui, { wrapper: Wrapper, ...options }) };
}
