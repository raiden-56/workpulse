export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  demo: boolean;
  status: string;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  code?: string | null;
  timezone: string;
  status: string;
  demo: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  employeeCount: number;
  departmentCount: number;
  deviceCount: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  code?: string;
  timezone?: string;
  adminEmail: string;
  adminDisplayName: string;
}

export interface CreateOrganizationResponse {
  organization: OrganizationResponse;
  adminActivationToken: string;
}

export interface UpdateOrganizationRequest {
  name: string;
  code?: string;
  timezone?: string;
  status?: string;
}

export interface DepartmentResponse {
  id: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  headEmployeeId?: string | null;
  status: string;
  teamCount: number;
  employeeCount: number;
}

export interface DepartmentRequest {
  name: string;
  code?: string;
  parentId?: string | null;
  headEmployeeId?: string | null;
}

export interface TeamResponse {
  id: string;
  name: string;
  code?: string | null;
  departmentId: string;
  departmentName?: string | null;
  leadEmployeeId?: string | null;
  status: string;
  employeeCount: number;
}

export interface TeamRequest {
  name: string;
  code?: string;
  departmentId: string;
  leadEmployeeId?: string | null;
}

export interface SystemHealth {
  database: string;
  redis: string;
  rabbitmq: string;
  uptimeSeconds: number;
  version: string;
  serverTime: string;
}
