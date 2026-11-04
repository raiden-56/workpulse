import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';

export const TAGS = [
  'Me',
  'Employee',
  'Department',
  'Team',
  'Device',
  'User',
  'Role',
  'Organization',
  'Policy',
  'Notification',
  'Audit',
  'Live',
  'Dashboard',
  'Guest',
] as const;

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: [...TAGS],
  refetchOnReconnect: true,
  endpoints: () => ({}),
});
