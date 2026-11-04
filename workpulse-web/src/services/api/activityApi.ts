import type { ApiResponse, Paged } from '@/types/api';
import type { LiveQuery, LiveStatusResponse, LiveSummary, TimelineResponse } from '@/types/activity';
import { baseApi } from './baseApi';
import { unwrap, unwrapPage } from './axiosBaseQuery';

export const activityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    liveStatus: build.query<Paged<LiveStatusResponse>, LiveQuery>({
      query: (params) => ({ url: '/activity/live', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<LiveStatusResponse>(r),
      providesTags: ['Live'],
    }),
    liveSummary: build.query<LiveSummary, void>({
      query: () => ({ url: '/activity/live/summary' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<LiveSummary>(r),
      providesTags: ['Live'],
    }),
    timeline: build.query<TimelineResponse, { employeeId?: string; date?: string }>({
      query: (params) => ({ url: '/activity/timeline', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<TimelineResponse>(r),
      providesTags: ['Live'],
    }),
  }),
});

export const { useLiveStatusQuery, useLiveSummaryQuery, useTimelineQuery } = activityApi;
