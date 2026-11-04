import type { ApiResponse } from '@/types/api';
import type {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  DepartmentRequest,
  DepartmentResponse,
  OrganizationResponse,
  OrganizationSummary,
  SystemHealth,
  TeamRequest,
  TeamResponse,
  UpdateOrganizationRequest,
} from '@/types/organization';
import { baseApi } from './baseApi';
import { unwrap } from './axiosBaseQuery';

export const organizationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    organizations: build.query<OrganizationSummary[], void>({
      query: () => ({ url: '/organizations' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<OrganizationSummary[]>(r),
      providesTags: ['Organization'],
    }),
    currentOrganization: build.query<OrganizationResponse, void>({
      query: () => ({ url: '/organizations/current' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<OrganizationResponse>(r),
      providesTags: ['Organization'],
    }),
    organization: build.query<OrganizationResponse, string>({
      query: (id) => ({ url: `/organizations/${id}` }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<OrganizationResponse>(r),
      providesTags: ['Organization'],
    }),
    createOrganization: build.mutation<CreateOrganizationResponse, CreateOrganizationRequest>({
      query: (data) => ({ url: '/organizations', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<CreateOrganizationResponse>(r),
      invalidatesTags: ['Organization'],
    }),
    updateOrganization: build.mutation<OrganizationResponse, { id: string; data: UpdateOrganizationRequest }>({
      query: ({ id, data }) => ({ url: `/organizations/${id}`, method: 'PUT', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<OrganizationResponse>(r),
      invalidatesTags: ['Organization'],
    }),
    updateOrganizationSettings: build.mutation<OrganizationResponse, Record<string, unknown>>({
      query: (settings) => ({ url: '/organizations/current/settings', method: 'PUT', data: { settings } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<OrganizationResponse>(r),
      invalidatesTags: ['Organization'],
    }),
    departments: build.query<DepartmentResponse[], void>({
      query: () => ({ url: '/departments' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DepartmentResponse[]>(r),
      providesTags: ['Department'],
    }),
    createDepartment: build.mutation<DepartmentResponse, DepartmentRequest>({
      query: (data) => ({ url: '/departments', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DepartmentResponse>(r),
      invalidatesTags: ['Department'],
    }),
    updateDepartment: build.mutation<DepartmentResponse, { id: string; data: DepartmentRequest }>({
      query: ({ id, data }) => ({ url: `/departments/${id}`, method: 'PUT', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DepartmentResponse>(r),
      invalidatesTags: ['Department', 'Team', { type: 'Employee', id: 'LIST' }],
    }),
    archiveDepartment: build.mutation<DepartmentResponse, string>({
      query: (id) => ({ url: `/departments/${id}`, method: 'DELETE' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<DepartmentResponse>(r),
      invalidatesTags: ['Department'],
    }),
    teams: build.query<TeamResponse[], { departmentId?: string } | void>({
      query: (params) => ({ url: '/teams', params: params ? { ...params } : undefined }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<TeamResponse[]>(r),
      providesTags: ['Team'],
    }),
    createTeam: build.mutation<TeamResponse, TeamRequest>({
      query: (data) => ({ url: '/teams', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<TeamResponse>(r),
      invalidatesTags: ['Team', 'Department'],
    }),
    updateTeam: build.mutation<TeamResponse, { id: string; data: TeamRequest }>({
      query: ({ id, data }) => ({ url: `/teams/${id}`, method: 'PUT', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<TeamResponse>(r),
      invalidatesTags: ['Team', 'Department', { type: 'Employee', id: 'LIST' }],
    }),
    archiveTeam: build.mutation<TeamResponse, string>({
      query: (id) => ({ url: `/teams/${id}`, method: 'DELETE' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<TeamResponse>(r),
      invalidatesTags: ['Team', 'Department'],
    }),
    systemHealth: build.query<SystemHealth, void>({
      query: () => ({ url: '/system/health' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<SystemHealth>(r),
    }),
  }),
});

export const {
  useOrganizationsQuery,
  useCurrentOrganizationQuery,
  useOrganizationQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useUpdateOrganizationSettingsMutation,
  useDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useArchiveDepartmentMutation,
  useTeamsQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useArchiveTeamMutation,
  useSystemHealthQuery,
} = organizationApi;
