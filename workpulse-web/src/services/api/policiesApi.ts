import type { ApiResponse } from '@/types/api';
import type { EffectivePolicyResponse, PolicyResponse } from '@/types/policies';
import { baseApi } from './baseApi';
import { unwrap } from './axiosBaseQuery';

export const policiesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    policies: build.query<PolicyResponse[], void>({
      query: () => ({ url: '/policies' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<PolicyResponse[]>(r),
      providesTags: ['Policy'],
    }),
    policy: build.query<PolicyResponse, string>({
      query: (id) => ({ url: `/policies/${id}` }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<PolicyResponse>(r),
      providesTags: ['Policy'],
    }),
    effectivePolicy: build.query<EffectivePolicyResponse, { employeeId?: string } | void>({
      query: (params) => ({ url: '/policies/effective', params: params ? { ...params } : undefined }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EffectivePolicyResponse>(r),
      providesTags: ['Policy'],
    }),
  }),
});

export const { usePoliciesQuery, usePolicyQuery, useEffectivePolicyQuery } = policiesApi;
