import type { ApiResponse, MessageResponse } from '@/types/api';
import type { AuthTokensResponse } from '@/types/auth';
import type { GuestConfigResponse, GuestResetResponse } from '@/types/guest';
import { baseApi } from './baseApi';
import { unwrap } from './axiosBaseQuery';

export const guestApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    guestConfig: build.query<GuestConfigResponse, void>({
      query: () => ({ url: '/guest/config' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<GuestConfigResponse>(r),
      providesTags: ['Guest'],
    }),
    startGuestSession: build.mutation<AuthTokensResponse, { persona?: string }>({
      query: (data) => ({ url: '/guest/sessions', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<AuthTokensResponse>(r),
    }),
    endGuestSession: build.mutation<MessageResponse, void>({
      query: () => ({ url: '/guest/sessions/current', method: 'DELETE' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<MessageResponse>(r),
    }),
    resetDemoData: build.mutation<GuestResetResponse, void>({
      query: () => ({ url: '/guest/demo/reset', method: 'POST' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<GuestResetResponse>(r),
      invalidatesTags: ['Dashboard', 'Employee', 'Device', 'Live', 'Department', 'Team', 'Audit', 'Notification'],
    }),
  }),
});

export const { useGuestConfigQuery, useStartGuestSessionMutation, useEndGuestSessionMutation, useResetDemoDataMutation } = guestApi;
