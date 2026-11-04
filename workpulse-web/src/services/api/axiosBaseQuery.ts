import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import type { ApiResponse, PageMeta, Paged } from '@/types/api';
import type { ApiQueryError } from '@/utils/errors';
import { http } from '../http';

export interface AxiosArgs {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** The base query returns the full envelope; endpoints unwrap `data` (and `meta` for pages). */
export const axiosBaseQuery =
  (): BaseQueryFn<AxiosArgs, ApiResponse<unknown>, ApiQueryError> =>
  async ({ url, method = 'GET', data, params, headers }) => {
    try {
      const cleanParams = params
        ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
        : undefined;
      const response = await http.request<ApiResponse<unknown>>({ url, method, data, params: cleanParams, headers });
      return { data: response.data };
    } catch (raw) {
      const err = raw as AxiosError<ApiResponse<unknown>>;
      return {
        error: {
          status: err.response?.status ?? 0,
          data: err.response?.data?.error ?? (err.response ? undefined : { code: 'NETWORK_ERROR', message: err.message }),
        },
      };
    }
  };

export function unwrap<T>(response: ApiResponse<unknown>): T {
  return response.data as T;
}

export function unwrapPage<T>(response: ApiResponse<unknown>): Paged<T> {
  const meta: PageMeta = response.meta ?? { page: 0, size: 0, totalElements: 0, totalPages: 0 };
  return { items: (response.data as T[]) ?? [], meta };
}
