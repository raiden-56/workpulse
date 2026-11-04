import type { ApiResponse, Paged } from '@/types/api';
import type { InviteUserRequest, InviteUserResponse, PermissionResponse, RoleGrant, RoleResponse, UserResponse } from '@/types/users';
import { baseApi } from './baseApi';
import { unwrap, unwrapPage } from './axiosBaseQuery';

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    users: build.query<Paged<UserResponse>, { page?: number; size?: number }>({
      query: (params) => ({ url: '/users', params: { ...params } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrapPage<UserResponse>(r),
      providesTags: ['User'],
    }),
    inviteUser: build.mutation<InviteUserResponse, InviteUserRequest>({
      query: (data) => ({ url: '/users/invite', method: 'POST', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<InviteUserResponse>(r),
      invalidatesTags: ['User', { type: 'Employee', id: 'LIST' }],
    }),
    updateUser: build.mutation<UserResponse, { id: string; displayName: string; employeeId?: string | null }>({
      query: ({ id, ...data }) => ({ url: `/users/${id}`, method: 'PUT', data }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<UserResponse>(r),
      invalidatesTags: ['User'],
    }),
    changeUserStatus: build.mutation<UserResponse, { id: string; action: 'suspend' | 'reactivate' | 'revoke' }>({
      query: ({ id, action }) => ({ url: `/users/${id}/${action}`, method: 'POST' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<UserResponse>(r),
      invalidatesTags: ['User'],
    }),
    assignRoles: build.mutation<UserResponse, { id: string; roles: RoleGrant[] }>({
      query: ({ id, roles }) => ({ url: `/users/${id}/roles`, method: 'PUT', data: { roles } }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<UserResponse>(r),
      invalidatesTags: ['User'],
    }),
    roles: build.query<RoleResponse[], void>({
      query: () => ({ url: '/roles' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<RoleResponse[]>(r),
      providesTags: ['Role'],
    }),
    permissions: build.query<PermissionResponse[], void>({
      query: () => ({ url: '/permissions' }),
      transformResponse: (r: ApiResponse<unknown>) => unwrap<PermissionResponse[]>(r),
      providesTags: ['Role'],
    }),
  }),
});

export const {
  useUsersQuery,
  useInviteUserMutation,
  useUpdateUserMutation,
  useChangeUserStatusMutation,
  useAssignRolesMutation,
  useRolesQuery,
  usePermissionsQuery,
} = usersApi;
