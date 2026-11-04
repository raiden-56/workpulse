import { combineReducers, configureStore, type PreloadedStateShapeFromReducersMapObject } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from '@/services/api/baseApi';
import { configureAuthBridge } from '@/services/authBridge';
import { loadSession, saveSession } from '@/services/session';
import { authReducer, loggedOut, sessionRestored, tokensRefreshed } from './slices/authSlice';
import { uiReducer } from './slices/uiSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type PreloadedRootState = PreloadedStateShapeFromReducersMapObject<typeof rootReducer>;

export function makeStore(preloadedState?: Partial<PreloadedRootState>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as PreloadedRootState | undefined,
    middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(baseApi.middleware),
  });

  configureAuthBridge({
    getAccessToken: () => store.getState().auth.accessToken,
    getRefreshToken: () => store.getState().auth.refreshToken,
    getOrganizationOverride: () => store.getState().auth.organizationOverride,
    isGuest: () => !!store.getState().auth.user?.guestType,
    onTokensRefreshed: (tokens) => store.dispatch(tokensRefreshed(tokens)),
    onSessionExpired: (reason) => {
      store.dispatch(loggedOut({ reason }));
      store.dispatch(baseApi.util.resetApiState());
    },
  });

  // Persist the session whenever it changes.
  let lastSerialized = '';
  store.subscribe(() => {
    const { auth } = store.getState();
    if (auth.status === 'restoring') {
      return;
    }
    const session =
      auth.status === 'authenticated' && auth.user && auth.accessToken
        ? {
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
            user: auth.user,
            organizationOverride: auth.organizationOverride,
          }
        : null;
    const serialized = JSON.stringify(session);
    if (serialized !== lastSerialized) {
      lastSerialized = serialized;
      saveSession(session);
    }
  });

  setupListeners(store.dispatch);
  return store;
}

export const store = makeStore();
store.dispatch(sessionRestored(loadSession()));

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
