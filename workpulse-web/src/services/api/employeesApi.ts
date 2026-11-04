import type { ApiResponse, Paged } from '@/types/api';
import type { CreateEmployeeRequest, EmployeeQuery, EmployeeResponse, UpdateEmployeeRequest } from '@/types/employees';
import { baseApi } from './baseApi';
import { unwrap, unwrapPage } from './axiosBaseQuery';

export const employeesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    employees: build.query<Paged<EmployeeResponse>, EmployeeQuery>({
      query: (params) => ({ url: '/employees', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<EmployeeResponse>(r),
      providesTags: (result) =>
        result
          ? [...result.items.map((e) => ({ type: 'Employee' as const, id: e.id })), { type: 'Employee' as const, id: 'LIST' }]
          : [{ type: 'Employee' as const, id: 'LIST' }],
    }),
    employee: build.query<EmployeeResponse, string>({
      query: (id) => ({ url: `/employees/${id}` }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      providesTags: (_r, _e, id) => [{ type: 'Employee', id }],
    }),
    myEmployee: build.query<EmployeeResponse, void>({
      query: () => ({ url: '/employees/me' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      providesTags: ['Me'],
    }),
    createEmployee: build.mutation<EmployeeResponse, CreateEmployeeRequest>({
      query: (data) => ({ url: '/employees', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      invalidatesTags: [{ type: 'Employee', id: 'LIST' }, 'Department', 'Team', 'Dashboard'],
    }),
    updateEmployee: build.mutation<EmployeeResponse, { id: string; data: UpdateEmployeeRequest }>({
      query: ({ id, data }) => ({ url: `/employees/${id}`, method: 'PUT', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Employee', id }, { type: 'Employee', id: 'LIST' }, 'Department', 'Team'],
    }),
    deactivateEmployee: build.mutation<EmployeeResponse, string>({
      query: (id) => ({ url: `/employees/${id}/deactivate`, method: 'POST' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      invalidatesTags: (_r, _e, id) => [{ type: 'Employee', id }, { type: 'Employee', id: 'LIST' }, 'Dashboard', 'Live'],
    }),
    assignManager: build.mutation<EmployeeResponse, { id: string; managerEmployeeId: string }>({
      query: ({ id, managerEmployeeId }) => ({ url: `/employees/${id}/manager`, method: 'PUT', data: { managerEmployeeId } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Employee', id }, { type: 'Employee', id: 'LIST' }],
    }),
    assignDepartment: build.mutation<EmployeeResponse, { id: string; departmentId: string }>({
      query: ({ id, departmentId }) => ({ url: `/employees/${id}/department`, method: 'PUT', data: { departmentId } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Employee', id }, { type: 'Employee', id: 'LIST' }, 'Department', 'Team'],
    }),
    assignTeam: build.mutation<EmployeeResponse, { id: string; teamId: string }>({
      query: ({ id, teamId }) => ({ url: `/employees/${id}/team`, method: 'PUT', data: { teamId } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<EmployeeResponse>(r),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Employee', id }, { type: 'Employee', id: 'LIST' }, 'Department', 'Team'],
    }),
  }),
});

export const {
  useEmployeesQuery,
  useLazyEmployeesQuery,
  useEmployeeQuery,
  useMyEmployeeQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeactivateEmployeeMutation,
  useAssignManagerMutation,
  useAssignDepartmentMutation,
  useAssignTeamMutation,
} = employeesApi;
