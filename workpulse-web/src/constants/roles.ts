import type { MeResponse } from '@/types/auth';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  IT_ADMIN: 'IT_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  DEPT_MANAGER: 'DEPT_MANAGER',
  TEAM_LEAD: 'TEAM_LEAD',
  EMPLOYEE: 'EMPLOYEE',
  AUDITOR: 'AUDITOR',
  GUEST_DEMO: 'GUEST_DEMO',
  GUEST_AUTHORIZED: 'GUEST_AUTHORIZED',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Organisation Admin',
  IT_ADMIN: 'IT Administrator',
  HR_ADMIN: 'HR Administrator',
  DEPT_MANAGER: 'Department Manager',
  TEAM_LEAD: 'Team Lead',
  EMPLOYEE: 'Employee',
  AUDITOR: 'Auditor',
  GUEST_DEMO: 'Demo Guest',
  GUEST_AUTHORIZED: 'Authorised Guest',
};

/** Which dashboard composition a principal gets. */
export type DashboardKind = 'superAdmin' | 'executive' | 'manager' | 'teamLead' | 'hr' | 'it' | 'employee' | 'auditor';

const ROLE_PRECEDENCE: RoleCode[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ORG_ADMIN,
  ROLES.DEPT_MANAGER,
  ROLES.TEAM_LEAD,
  ROLES.HR_ADMIN,
  ROLES.IT_ADMIN,
  ROLES.AUDITOR,
  ROLES.EMPLOYEE,
  ROLES.GUEST_AUTHORIZED,
  ROLES.GUEST_DEMO,
];

export function primaryRole(user: Pick<MeResponse, 'roles'> | null | undefined): RoleCode | null {
  if (!user) {
    return null;
  }
  for (const role of ROLE_PRECEDENCE) {
    if (user.roles.includes(role)) {
      return role;
    }
  }
  return null;
}

const PERSONA_TO_KIND: Record<string, DashboardKind> = {
  EXECUTIVE: 'executive',
  DEPARTMENT_MANAGER: 'manager',
  TEAM_LEAD: 'teamLead',
  HR_ADMIN: 'hr',
  IT_ADMIN: 'it',
  EMPLOYEE: 'employee',
  AUDITOR: 'auditor',
};

const ROLE_TO_KIND: Record<string, DashboardKind> = {
  SUPER_ADMIN: 'superAdmin',
  ORG_ADMIN: 'executive',
  DEPT_MANAGER: 'manager',
  TEAM_LEAD: 'teamLead',
  HR_ADMIN: 'hr',
  IT_ADMIN: 'it',
  AUDITOR: 'auditor',
  EMPLOYEE: 'employee',
  GUEST_AUTHORIZED: 'executive',
  GUEST_DEMO: 'executive',
};

/**
 * Picks the dashboard composition. Demo guests follow the persona they chose; a super admin who has
 * selected an organisation gets the executive view of that organisation.
 */
export function dashboardKindFor(user: MeResponse | null | undefined, organizationOverride?: string | null): DashboardKind {
  if (!user) {
    return 'employee';
  }
  if (user.guestType === 'DEMO' && user.guestPersona) {
    return PERSONA_TO_KIND[user.guestPersona] ?? 'executive';
  }
  const role = primaryRole(user);
  if (role === ROLES.SUPER_ADMIN) {
    return organizationOverride ? 'executive' : 'superAdmin';
  }
  return role ? ROLE_TO_KIND[role] : 'employee';
}

export function isSuperAdmin(user: MeResponse | null | undefined): boolean {
  return !!user && user.roles.includes(ROLES.SUPER_ADMIN);
}

export function isGuest(user: MeResponse | null | undefined): boolean {
  return !!user && !!user.guestType;
}

export function isDemoGuest(user: MeResponse | null | undefined): boolean {
  return !!user && user.guestType === 'DEMO';
}
