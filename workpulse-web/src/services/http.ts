import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types/api';
import type { AuthTokensResponse } from '@/types/auth';
import { authBridge } from './authBridge';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password', '/users/activate', '/guest/sessions', '/guest/config'];

function isAuthPath(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  return AUTH_PATHS.some((p) => url.endsWith(p));
}

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

http.interceptors.request.use((config) => {
  const bridge = authBridge();
  const token = bridge.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const org = bridge.getOrganizationOverride();
  if (org) {
    config.headers['X-Organization-Id'] = org;
  }
  return config;
});

let inflightRefresh: Promise<AuthTokensResponse> | null = null;

/** Rotates the refresh token exactly once even if many requests fail at the same time. */
export function refreshTokens(refreshToken: string): Promise<AuthTokensResponse> {
  if (!inflightRefresh) {
    inflightRefresh = axios
      .post<ApiResponse<AuthTokensResponse>>(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15_000 })
      .then((response) => {
        const tokens = response.data.data;
        if (!tokens) {
          throw new Error('Refresh response did not include tokens');
        }
        authBridge().onTokensRefreshed(tokens);
        return tokens;
      })
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const bridge = authBridge();

    if (status === 401 && original && !original._retry && !isAuthPath(original.url) && bridge.getAccessToken()) {
      if (code === 'TOKEN_EXPIRED') {
        const refreshToken = bridge.getRefreshToken();
        if (!refreshToken) {
          bridge.onSessionExpired(bridge.isGuest() ? 'guest-expired' : 'expired');
          return Promise.reject(error);
        }
        try {
          const tokens = await refreshTokens(refreshToken);
          original._retry = true;
          original.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return http.request(original);
        } catch {
          bridge.onSessionExpired('expired');
          return Promise.reject(error);
        }
      }
      if (code === 'TOKEN_REUSED' || code === 'UNAUTHORIZED' || code === 'GUEST_EXPIRED') {
        bridge.onSessionExpired(code === 'TOKEN_REUSED' ? 'revoked' : bridge.isGuest() ? 'guest-expired' : 'expired');
      }
    }
    return Promise.reject(error);
  },
);
