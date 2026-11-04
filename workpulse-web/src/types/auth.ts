export type ScopeLevel = 'GLOBAL' | 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'SELF';

export type GuestType = 'DEMO' | 'AUTHORIZED';

export interface ScopeResponse {
  level: ScopeLevel;
  departmentIds?: string[];
  teamIds?: string[];
  employeeId?: string | null;
}

export interface MeResponse {
  userId: string;
  email: string;
  displayName: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationTimezone?: string;
  demoOrganization: boolean;
  employeeId?: string | null;
  roles: string[];
  permissions: string[];
  scope?: ScopeResponse | null;
  guestType?: GuestType | null;
  guestPersona?: string | null;
  guestExpiresAt?: string | null;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken?: string | null;
  tokenType: string;
  expiresIn: number;
  user: MeResponse;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordResponse {
  message: string;
  developmentResetToken?: string | null;
}

export interface LoginHistoryResponse {
  id: string;
  outcome: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  occurredAt: string;
}
