import type { ApiResponse, Paged } from '@/types/api';
import type { NotificationResponse, UnreadCount } from '@/types/notifications';
import { baseApi } from './baseApi';
import { unwrap, unwrapPage } from './axiosBaseQuery';

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    notifications: build.query<Paged<NotificationResponse>, { unreadOnly?: boolean; page?: number; size?: number }>({
      query: (params) => ({ url: '/notifications', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<NotificationResponse>(r),
      providesTags: ['Notification'],
    }),
    unreadCount: build.query<UnreadCount, void>({
      query: () => ({ url: '/notifications/unread-count' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<UnreadCount>(r),
      providesTags: ['Notification'],
    }),
    markNotificationRead: build.mutation<NotificationResponse, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PUT' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<NotificationResponse>(r),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: build.mutation<{ updated: number }, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<{ updated: number }>(r),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const { useNotificationsQuery, useUnreadCountQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } =
  notificationsApi;
