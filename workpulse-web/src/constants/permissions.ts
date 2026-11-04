/** Permission codes, mirroring the backend catalogue (docs/architecture/RBAC.md). */
export const P = {
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  LIVE_MONITORING_VIEW: 'LIVE_MONITORING_VIEW',
  EMPLOYEE_VIEW: 'EMPLOYEE_VIEW',
  EMPLOYEE_CREATE: 'EMPLOYEE_CREATE',
  EMPLOYEE_UPDATE: 'EMPLOYEE_UPDATE',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE',
  EMPLOYEE_EXPORT: 'EMPLOYEE_EXPORT',
  DEPARTMENT_VIEW: 'DEPARTMENT_VIEW',
  DEPARTMENT_CREATE: 'DEPARTMENT_CREATE',
  DEPARTMENT_UPDATE: 'DEPARTMENT_UPDATE',
  DEPARTMENT_DELETE: 'DEPARTMENT_DELETE',
  TEAM_VIEW: 'TEAM_VIEW',
  TEAM_CREATE: 'TEAM_CREATE',
  TEAM_UPDATE: 'TEAM_UPDATE',
  TEAM_DELETE: 'TEAM_DELETE',
  USER_VIEW: 'USER_VIEW',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_MANAGE: 'USER_MANAGE',
  ROLE_VIEW: 'ROLE_VIEW',
  ORGANIZATION_VIEW: 'ORGANIZATION_VIEW',
  ORGANIZATION_CREATE: 'ORGANIZATION_CREATE',
  ORGANIZATION_UPDATE: 'ORGANIZATION_UPDATE',
  ORGANIZATION_CONFIGURE: 'ORGANIZATION_CONFIGURE',
  DEVICE_VIEW: 'DEVICE_VIEW',
  DEVICE_UPDATE: 'DEVICE_UPDATE',
  DEVICE_DELETE: 'DEVICE_DELETE',
  DEVICE_APPROVE: 'DEVICE_APPROVE',
  DEVICE_MANAGE: 'DEVICE_MANAGE',
  AGENT_MANAGE: 'AGENT_MANAGE',
  ACTIVITY_VIEW: 'ACTIVITY_VIEW',
  APPLICATION_USAGE_VIEW: 'APPLICATION_USAGE_VIEW',
  ATTENDANCE_VIEW: 'ATTENDANCE_VIEW',
  ANALYTICS_VIEW: 'ANALYTICS_VIEW',
  ANOMALY_VIEW: 'ANOMALY_VIEW',
  NOTIFICATION_VIEW: 'NOTIFICATION_VIEW',
  REPORT_VIEW: 'REPORT_VIEW',
  POLICY_VIEW: 'POLICY_VIEW',
  POLICY_CONFIGURE: 'POLICY_CONFIGURE',
  PRIVACY_VIEW: 'PRIVACY_VIEW',
  CORRECTION_REQUEST_CREATE: 'CORRECTION_REQUEST_CREATE',
  AUDIT_LOG_VIEW: 'AUDIT_LOG_VIEW',
  GUEST_VIEW: 'GUEST_VIEW',
  SYSTEM_VIEW: 'SYSTEM_VIEW',
  SELF_VIEW: 'SELF_VIEW',
  SELF_UPDATE: 'SELF_UPDATE',
} as const;

export type Permission = (typeof P)[keyof typeof P];

export function hasAny(granted: readonly string[] | undefined, required: string | readonly string[] | undefined): boolean {
  if (!required || (Array.isArray(required) && required.length === 0)) {
    return true;
  }
  if (!granted) {
    return false;
  }
  const list = Array.isArray(required) ? required : [required as string];
  return list.some((p) => granted.includes(p));
}

export function hasAll(granted: readonly string[] | undefined, required: readonly string[]): boolean {
  if (!granted) {
    return required.length === 0;
  }
  return required.every((p) => granted.includes(p));
}
