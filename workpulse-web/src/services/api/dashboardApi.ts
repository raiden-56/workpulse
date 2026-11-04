import type { ApiResponse } from '@/types/api';
import type { DashboardOverviewResponse, DashboardQuery, MyDashboardResponse } from '@/types/dashboard';
import { baseApi } from './baseApi';
import { unwrap } from './axiosBaseQuery';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    dashboardOverview: build.query<DashboardOverviewResponse, DashboardQuery>({
      query: (params) => ({ url: '/dashboard/overview', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DashboardOverviewResponse>(r),
      providesTags: ['Dashboard'],
    }),
    myDashboard: build.query<MyDashboardResponse, void>({
      query: () => ({ url: '/dashboard/me' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<MyDashboardResponse>(r),
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useDashboardOverviewQuery, useMyDashboardQuery } = dashboardApi;
