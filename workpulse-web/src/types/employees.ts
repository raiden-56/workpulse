import type { ActivityState } from './activity';
import type { PageQuery } from './api';

export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE' | 'TERMINATED';

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED'];

export const ROLE_PROFILES = ['GENERAL', 'DEVELOPER', 'ANALYST', 'DESIGNER', 'PRODUCT', 'SUPPORT', 'FINANCE', 'HR', 'SALES', 'MANAGER'];

export interface EmployeeResponse {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  workEmail: string;
  designation?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  managerEmployeeId?: string | null;
  managerName?: string | null;
  shiftId?: string | null;
  shiftName?: string | null;
  joiningDate?: string | null;
  employmentStatus: EmploymentStatus;
  roleProfile: string;
  deviceCount: number;
  liveStatus: ActivityState;
  hasPortalUser: boolean;
}

export interface EmployeeQuery extends PageQuery {
  q?: string;
  departmentId?: string;
  teamId?: string;
  status?: EmploymentStatus;
  roleProfile?: string;
}

export interface CreateEmployeeRequest {
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  designation?: string;
  departmentId?: string | null;
  teamId?: string | null;
  shiftId?: string | null;
  managerEmployeeId?: string | null;
  joiningDate?: string | null;
  roleProfile?: string;
}

export interface UpdateEmployeeRequest {
  firstName: string;
  lastName: string;
  workEmail: string;
  designation?: string;
  departmentId?: string | null;
  teamId?: string | null;
  shiftId?: string | null;
  joiningDate?: string | null;
  employmentStatus?: EmploymentStatus;
  roleProfile?: string;
}
