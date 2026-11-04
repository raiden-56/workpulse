-- Roles and permission catalogue (see docs/architecture/RBAC.md)

INSERT INTO roles (code, name, description, scope_level) VALUES
  ('SUPER_ADMIN',      'Super Admin',           'Full platform administration across organisations', 'GLOBAL'),
  ('ORG_ADMIN',        'Organization Admin',    'Administers one organisation',                        'ORGANIZATION'),
  ('IT_ADMIN',         'IT Administrator',      'Devices, agents and technical configuration',         'ORGANIZATION'),
  ('HR_ADMIN',         'HR Administrator',      'Employee directory, attendance and shifts',           'ORGANIZATION'),
  ('DEPT_MANAGER',     'Department Manager',    'Department-scoped analytics and reviews',             'DEPARTMENT'),
  ('TEAM_LEAD',        'Team Lead',             'Team-scoped activity and attendance',                 'TEAM'),
  ('EMPLOYEE',         'Employee',              'Personal self-service',                               'SELF'),
  ('AUDITOR',          'Auditor',               'Read-only audit and compliance access',               'ORGANIZATION'),
  ('GUEST_DEMO',       'Public Demo Guest',     'Read-only access to the simulated demo organisation', 'ORGANIZATION'),
  ('GUEST_AUTHORIZED', 'Authorized Guest',      'Invited external stakeholder with configured scope',  'ORGANIZATION');

INSERT INTO permissions (code, resource, action, description)
SELECT resource || '_' || action, resource, action, resource || ' ' || lower(action)
FROM (VALUES
  ('DASHBOARD', ARRAY['VIEW']),
  ('LIVE_MONITORING', ARRAY['VIEW']),
  ('EMPLOYEE', ARRAY['VIEW','CREATE','UPDATE','DELETE','EXPORT']),
  ('DEPARTMENT', ARRAY['VIEW','CREATE','UPDATE','DELETE']),
  ('TEAM', ARRAY['VIEW','CREATE','UPDATE','DELETE']),
  ('USER', ARRAY['VIEW','CREATE','UPDATE','DELETE','MANAGE']),
  ('ROLE', ARRAY['VIEW','MANAGE']),
  ('ORGANIZATION', ARRAY['VIEW','CREATE','UPDATE','DELETE','CONFIGURE']),
  ('DEVICE', ARRAY['VIEW','CREATE','UPDATE','DELETE','APPROVE','MANAGE']),
  ('AGENT', ARRAY['MANAGE']),
  ('ACTIVITY', ARRAY['VIEW','EXPORT']),
  ('APPLICATION_USAGE', ARRAY['VIEW','EXPORT']),
  ('APPLICATION_CLASSIFICATION', ARRAY['VIEW','CONFIGURE']),
  ('ATTENDANCE', ARRAY['VIEW','UPDATE','APPROVE','EXPORT','CONFIGURE']),
  ('SHIFT', ARRAY['VIEW','MANAGE']),
  ('ANALYTICS', ARRAY['VIEW','EXPORT']),
  ('ANOMALY', ARRAY['VIEW','UPDATE','CONFIGURE','EXPORT']),
  ('NOTIFICATION', ARRAY['VIEW','MANAGE']),
  ('REPORT', ARRAY['VIEW','EXPORT']),
  ('POLICY', ARRAY['VIEW','CONFIGURE']),
  ('PRIVACY', ARRAY['VIEW','MANAGE']),
  ('CORRECTION_REQUEST', ARRAY['CREATE','VIEW','APPROVE']),
  ('AUDIT_LOG', ARRAY['VIEW','EXPORT']),
  ('GUEST', ARRAY['VIEW','CREATE','UPDATE','DELETE','APPROVE']),
  ('SYSTEM', ARRAY['VIEW','CONFIGURE']),
  ('SELF', ARRAY['VIEW','UPDATE'])
) AS t(resource, actions), unnest(t.actions) AS action;

-- Helper: grant a list of permission codes to a role
CREATE OR REPLACE FUNCTION wp_grant(role_code text, perm_codes text[]) RETURNS void AS $$
BEGIN
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.code = role_code AND p.code = ANY(perm_codes)
  ON CONFLICT DO NOTHING;
END $$ LANGUAGE plpgsql;

-- Super admin: everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'SUPER_ADMIN';

-- Org admin: everything except platform-level operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ORG_ADMIN'
  AND p.code NOT IN ('ORGANIZATION_CREATE','ORGANIZATION_DELETE','SYSTEM_CONFIGURE','CORRECTION_REQUEST_CREATE');

SELECT wp_grant('IT_ADMIN', ARRAY[
  'DASHBOARD_VIEW','LIVE_MONITORING_VIEW','EMPLOYEE_VIEW','DEPARTMENT_VIEW','TEAM_VIEW',
  'DEVICE_VIEW','DEVICE_CREATE','DEVICE_UPDATE','DEVICE_DELETE','DEVICE_APPROVE','DEVICE_MANAGE','AGENT_MANAGE',
  'POLICY_VIEW','POLICY_CONFIGURE','NOTIFICATION_VIEW','REPORT_VIEW','AUDIT_LOG_VIEW','SYSTEM_VIEW','SELF_VIEW','SELF_UPDATE']);

SELECT wp_grant('HR_ADMIN', ARRAY[
  'DASHBOARD_VIEW','EMPLOYEE_VIEW','EMPLOYEE_CREATE','EMPLOYEE_UPDATE','EMPLOYEE_DELETE','EMPLOYEE_EXPORT',
  'DEPARTMENT_VIEW','TEAM_VIEW','ATTENDANCE_VIEW','ATTENDANCE_UPDATE','ATTENDANCE_APPROVE','ATTENDANCE_EXPORT','ATTENDANCE_CONFIGURE',
  'SHIFT_VIEW','SHIFT_MANAGE','ANALYTICS_VIEW','NOTIFICATION_VIEW','REPORT_VIEW','REPORT_EXPORT','POLICY_VIEW',
  'PRIVACY_VIEW','PRIVACY_MANAGE','CORRECTION_REQUEST_VIEW','CORRECTION_REQUEST_APPROVE','SELF_VIEW','SELF_UPDATE']);

SELECT wp_grant('DEPT_MANAGER', ARRAY[
  'DASHBOARD_VIEW','LIVE_MONITORING_VIEW','EMPLOYEE_VIEW','EMPLOYEE_EXPORT','DEPARTMENT_VIEW','TEAM_VIEW','DEVICE_VIEW',
  'ACTIVITY_VIEW','APPLICATION_USAGE_VIEW','ATTENDANCE_VIEW','ATTENDANCE_APPROVE','ANALYTICS_VIEW',
  'ANOMALY_VIEW','ANOMALY_UPDATE','NOTIFICATION_VIEW','REPORT_VIEW','REPORT_EXPORT','POLICY_VIEW',
  'CORRECTION_REQUEST_VIEW','CORRECTION_REQUEST_APPROVE','SELF_VIEW','SELF_UPDATE']);

SELECT wp_grant('TEAM_LEAD', ARRAY[
  'DASHBOARD_VIEW','LIVE_MONITORING_VIEW','EMPLOYEE_VIEW','EMPLOYEE_EXPORT','DEPARTMENT_VIEW','TEAM_VIEW','DEVICE_VIEW',
  'ACTIVITY_VIEW','APPLICATION_USAGE_VIEW','ATTENDANCE_VIEW','ATTENDANCE_APPROVE','ANALYTICS_VIEW',
  'ANOMALY_VIEW','NOTIFICATION_VIEW','REPORT_VIEW','REPORT_EXPORT','POLICY_VIEW',
  'CORRECTION_REQUEST_VIEW','CORRECTION_REQUEST_APPROVE','SELF_VIEW','SELF_UPDATE']);

SELECT wp_grant('EMPLOYEE', ARRAY[
  'DASHBOARD_VIEW','NOTIFICATION_VIEW','POLICY_VIEW','PRIVACY_VIEW','CORRECTION_REQUEST_CREATE','CORRECTION_REQUEST_VIEW',
  'REPORT_VIEW','SELF_VIEW','SELF_UPDATE']);

SELECT wp_grant('AUDITOR', ARRAY[
  'DASHBOARD_VIEW','EMPLOYEE_VIEW','DEPARTMENT_VIEW','TEAM_VIEW','USER_VIEW','ROLE_VIEW','DEVICE_VIEW',
  'ANOMALY_VIEW','NOTIFICATION_VIEW','REPORT_VIEW','POLICY_VIEW','PRIVACY_VIEW','AUDIT_LOG_VIEW','AUDIT_LOG_EXPORT',
  'GUEST_VIEW','SELF_VIEW','SELF_UPDATE']);

-- Demo guest: every *_VIEW permission plus sample report export, bound to the demo organisation
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'GUEST_DEMO'
  AND (p.action = 'VIEW' AND p.code NOT IN ('SELF_VIEW','USER_VIEW','ROLE_VIEW','SYSTEM_VIEW'))
UNION
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'GUEST_DEMO' AND p.code = 'REPORT_EXPORT';

-- Authorised guest: baseline read-only; additional permissions are granted per account in guest_permissions
SELECT wp_grant('GUEST_AUTHORIZED', ARRAY['DASHBOARD_VIEW','NOTIFICATION_VIEW']);

DROP FUNCTION wp_grant(text, text[]);
