import type { ApiResponse, MessageResponse, Paged } from '@/types/api';
import type { AuthTokensResponse, ForgotPasswordResponse, LoginHistoryResponse, LoginRequest, MeResponse } from '@/types/auth';
import { baseApi } from './baseApi';
import { unwrap, unwrapPage } from './axiosBaseQuery';

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthTokensResponse, LoginRequest>({
      query: (data) => ({ url: '/auth/login', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<AuthTokensResponse>(r),
    }),
    logout: build.mutation<MessageResponse, { refreshToken?: string | null }>({
      query: (data) => ({ url: '/auth/logout', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<MessageResponse>(r),
    }),
    me: build.query<MeResponse, void>({
      query: () => ({ url: '/auth/me' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<MeResponse>(r),
      providesTags: ['Me'],
    }),
    forgotPassword: build.mutation<ForgotPasswordResponse, { email: string }>({
      query: (data) => ({ url: '/auth/forgot-password', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<ForgotPasswordResponse>(r),
    }),
    resetPassword: build.mutation<MessageResponse, { token: string; password: string }>({
      query: (data) => ({ url: '/auth/reset-password', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<MessageResponse>(r),
    }),
    changePassword: build.mutation<MessageResponse, { currentPassword: string; newPassword: string }>({
      query: (data) => ({ url: '/auth/change-password', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<MessageResponse>(r),
    }),
    activateAccount: build.mutation<unknown, { token: string; password: string }>({
      query: (data) => ({ url: '/users/activate', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<unknown>(r),
    }),
    loginHistory: build.query<Paged<LoginHistoryResponse>, { userId?: string; page?: number; size?: number }>({
      query: (params) => ({ url: '/auth/login-history', params }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<LoginHistoryResponse>(r),
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useLazyMeQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useActivateAccountMutation,
  useLoginHistoryQuery,
} = authApi;
