import type { ApiResponse, Paged } from '@/types/api';
import type { DeviceQuery, DeviceResponse, DeviceSummary } from '@/types/devices';
import { baseApi } from './baseApi';
import { unwrap, unwrapPage } from './axiosBaseQuery';

export const devicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    devices: build.query<Paged<DeviceResponse>, DeviceQuery>({
      query: (params) => ({ url: '/devices', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<DeviceResponse>(r),
      providesTags: (result) =>
        result
          ? [...result.items.map((d) => ({ type: 'Device' as const, id: d.id })), { type: 'Device' as const, id: 'LIST' }]
          : [{ type: 'Device' as const, id: 'LIST' }],
    }),
    deviceSummary: build.query<DeviceSummary, void>({
      query: () => ({ url: '/devices/summary' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DeviceSummary>(r),
      providesTags: [{ type: 'Device', id: 'SUMMARY' }],
    }),
    device: build.query<DeviceResponse, string>({
      query: (id) => ({ url: `/devices/${id}` }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DeviceResponse>(r),
      providesTags: (_r, _e, id) => [{ type: 'Device', id }],
    }),
    updateDevice: build.mutation<DeviceResponse, { id: string; hostname?: string; metadata?: Record<string, unknown> }>({
      query: ({ id, ...data }) => ({ url: `/devices/${id}`, method: 'PUT', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DeviceResponse>(r),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Device', id }, { type: 'Device', id: 'LIST' }],
    }),
    approveDevice: build.mutation<DeviceResponse, string>({
      query: (id) => ({ url: `/devices/${id}/approve`, method: 'POST' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DeviceResponse>(r),
      invalidatesTags: (_r, _e, id) => [{ type: 'Device', id }, { type: 'Device', id: 'LIST' }, { type: 'Device', id: 'SUMMARY' }, 'Dashboard'],
    }),
    revokeDevice: build.mutation<DeviceResponse, string>({
      query: (id) => ({ url: `/devices/${id}/revoke`, method: 'POST' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DeviceResponse>(r),
      invalidatesTags: (_r, _e, id) => [{ type: 'Device', id }, { type: 'Device', id: 'LIST' }, { type: 'Device', id: 'SUMMARY' }, 'Dashboard'],
    }),
    assignDeviceEmployee: build.mutation<DeviceResponse, { id: string; employeeId: string }>({
      query: ({ id, employeeId }) => ({ url: `/devices/${id}/employee`, method: 'PUT', data: { employeeId } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DeviceResponse>(r),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Device', id }, { type: 'Device', id: 'LIST' }, { type: 'Employee', id: 'LIST' }],
    }),
  }),
});

export const {
  useDevicesQuery,
  useDeviceSummaryQuery,
  useDeviceQuery,
  useUpdateDeviceMutation,
  useApproveDeviceMutation,
  useRevokeDeviceMutation,
  useAssignDeviceEmployeeMutation,
} = devicesApi;
