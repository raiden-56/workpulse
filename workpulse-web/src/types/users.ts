import type { ScopeLevel } from './auth';

export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface RoleGrant {
  roleCode: string;
  departmentId?: string | null;
  teamId?: string | null;
}

export interface RoleGrantResponse {
  roleCode: string;
  roleName: string;
  scopeLevel: ScopeLevel;
  departmentId?: string | null;
  teamId?: string | null;
}

export interface UserResponse {
  id: string;
  organizationId?: string | null;
  email: string;
  displayName: string;
  status: UserStatus;
  mfaEnabled: boolean;
  employeeId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  roles: RoleGrantResponse[];
}

export interface InviteUserRequest {
  email: string;
  displayName: string;
  employeeId?: string | null;
  roles: RoleGrant[];
}

export interface InviteUserResponse {
  user: UserResponse;
  activationToken: string;
}

export interface RoleResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  scopeLevel: ScopeLevel;
  permissions: string[];
}

export interface PermissionResponse {
  id: string;
  code: string;
  resource: string;
  action: string;
  description?: string | null;
}
