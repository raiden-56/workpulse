import type { ApiResponse, Paged } from '@/types/api';
import type { AuditLogQuery, AuditLogResponse, DataAccessLogQuery, DataAccessLogResponse } from '@/types/audit';
import { baseApi } from './baseApi';
import { unwrapPage } from './axiosBaseQuery';

export const auditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    auditLogs: build.query<Paged<AuditLogResponse>, AuditLogQuery>({
      query: (params) => ({ url: '/audit-logs', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<AuditLogResponse>(r),
      providesTags: ['Audit'],
    }),
    dataAccessLogs: build.query<Paged<DataAccessLogResponse>, DataAccessLogQuery>({
      query: (params) => ({ url: '/data-access-logs', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<DataAccessLogResponse>(r),
      providesTags: ['Audit'],
    }),
  }),
});

export const { useAuditLogsQuery, useDataAccessLogsQuery } = auditApi;
