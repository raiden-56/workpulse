# WorkPulse – Roles and Permission Matrix

Authorisation is enforced by the backend on every request. The frontend only uses the
same permission codes to decide what to render.

## Permission model

A permission is `RESOURCE_ACTION`. Actions: `VIEW`, `CREATE`, `UPDATE`, `DELETE`,
`EXPORT`, `APPROVE`, `CONFIGURE`, `MANAGE`.

A role grants a set of permissions at a **scope level**:

| Scope | Meaning |
|---|---|
| `GLOBAL` | All organisations (Super Admin only) |
| `ORGANIZATION` | Everything inside the caller's organisation |
| `DEPARTMENT` | Only the department(s) bound in `user_roles.department_id` |
| `TEAM` | Only the team(s) bound in `user_roles.team_id` |
| `SELF` | Only the caller's own employee record |

Scope is applied in the service layer by `AccessScopeService.resolve(principal)` which
returns the set of employee ids the principal may see, or a wildcard for ORGANIZATION/GLOBAL.

## Permission catalogue

| Resource | Permissions |
|---|---|
| DASHBOARD | `DASHBOARD_VIEW` |
| LIVE_MONITORING | `LIVE_MONITORING_VIEW` |
| EMPLOYEE | `EMPLOYEE_VIEW` `EMPLOYEE_CREATE` `EMPLOYEE_UPDATE` `EMPLOYEE_DELETE` `EMPLOYEE_EXPORT` |
| DEPARTMENT | `DEPARTMENT_VIEW` `DEPARTMENT_CREATE` `DEPARTMENT_UPDATE` `DEPARTMENT_DELETE` |
| TEAM | `TEAM_VIEW` `TEAM_CREATE` `TEAM_UPDATE` `TEAM_DELETE` |
| USER | `USER_VIEW` `USER_CREATE` `USER_UPDATE` `USER_DELETE` `USER_MANAGE` (roles) |
| ROLE | `ROLE_VIEW` `ROLE_MANAGE` |
| ORGANIZATION | `ORGANIZATION_VIEW` `ORGANIZATION_CREATE` `ORGANIZATION_UPDATE` `ORGANIZATION_DELETE` `ORGANIZATION_CONFIGURE` |
| DEVICE | `DEVICE_VIEW` `DEVICE_CREATE` `DEVICE_UPDATE` `DEVICE_DELETE` `DEVICE_APPROVE` `DEVICE_MANAGE` |
| AGENT | `AGENT_MANAGE` (versions, updates, diagnostics) |
| ACTIVITY | `ACTIVITY_VIEW` `ACTIVITY_EXPORT` |
| APPLICATION_USAGE | `APPLICATION_USAGE_VIEW` `APPLICATION_USAGE_EXPORT` |
| APPLICATION_CLASSIFICATION | `APPLICATION_CLASSIFICATION_VIEW` `APPLICATION_CLASSIFICATION_CONFIGURE` |
| ATTENDANCE | `ATTENDANCE_VIEW` `ATTENDANCE_UPDATE` `ATTENDANCE_APPROVE` `ATTENDANCE_EXPORT` `ATTENDANCE_CONFIGURE` |
| SHIFT | `SHIFT_VIEW` `SHIFT_MANAGE` |
| ANALYTICS | `ANALYTICS_VIEW` `ANALYTICS_EXPORT` |
| ANOMALY | `ANOMALY_VIEW` `ANOMALY_UPDATE` (review) `ANOMALY_CONFIGURE` `ANOMALY_EXPORT` |
| NOTIFICATION | `NOTIFICATION_VIEW` `NOTIFICATION_MANAGE` |
| REPORT | `REPORT_VIEW` `REPORT_EXPORT` |
| POLICY | `POLICY_VIEW` `POLICY_CONFIGURE` |
| PRIVACY | `PRIVACY_VIEW` `PRIVACY_MANAGE` |
| CORRECTION_REQUEST | `CORRECTION_REQUEST_CREATE` `CORRECTION_REQUEST_VIEW` `CORRECTION_REQUEST_APPROVE` |
| AUDIT_LOG | `AUDIT_LOG_VIEW` `AUDIT_LOG_EXPORT` |
| GUEST | `GUEST_VIEW` `GUEST_CREATE` `GUEST_UPDATE` `GUEST_DELETE` `GUEST_APPROVE` |
| SYSTEM | `SYSTEM_VIEW` `SYSTEM_CONFIGURE` |
| SELF | `SELF_VIEW` `SELF_UPDATE` (profile, privacy settings) |

## Role matrix

Legend: ● full · ◐ partial (see note) · – none. Scope in the header.

| Permission | Super Admin<br/>GLOBAL | Org Admin<br/>ORG | IT Admin<br/>ORG | HR Admin<br/>ORG | Dept Manager<br/>DEPT | Team Lead<br/>TEAM | Employee<br/>SELF | Auditor<br/>ORG (read-only) | Demo Guest<br/>demo ORG | Authorised Guest<br/>configured |
|---|---|---|---|---|---|---|---|---|---|---|
| DASHBOARD_VIEW | ● | ● | ● | ● | ● | ● | ● | ● | ● | ◐ |
| LIVE_MONITORING_VIEW | ● | ● | ● | – | ● | ● | – | – | ● | ◐ |
| EMPLOYEE_VIEW | ● | ● | ● | ● | ● | ● | – | ● | ● | ◐ |
| EMPLOYEE_CREATE / UPDATE | ● | ● | – | ● | – | – | – | – | – | – |
| EMPLOYEE_DELETE | ● | ● | – | ◐ deactivate | – | – | – | – | – | – |
| EMPLOYEE_EXPORT | ● | ● | – | ● | ● | ● | – | – | ◐ sample | ◐ |
| DEPARTMENT_* / TEAM_* | ● | ● | VIEW | VIEW | VIEW | VIEW | – | VIEW | VIEW | ◐ |
| USER_* / ROLE_* | ● | ● (org) | – | – | – | – | – | VIEW | – | – |
| ORGANIZATION_CREATE / DELETE | ● | – | – | – | – | – | – | – | – | – |
| ORGANIZATION_CONFIGURE | ● | ● | – | – | – | – | – | – | – | – |
| DEVICE_VIEW | ● | ● | ● | – | ◐ own dept | ◐ own team | ◐ own | ● | ● | ◐ |
| DEVICE_CREATE / UPDATE / DELETE / APPROVE / MANAGE | ● | ● | ● | – | – | – | – | – | – | – |
| AGENT_MANAGE | ● | ● | ● | – | – | – | – | – | – | – |
| ACTIVITY_VIEW | ● | ● | – | – | ● | ● | ◐ own | – | ● | ◐ |
| APPLICATION_USAGE_VIEW | ● | ● | – | – | ● | ● | ◐ own | – | ● | ◐ |
| APPLICATION_CLASSIFICATION_CONFIGURE | ● | ● | – | – | – | – | – | – | – | – |
| ATTENDANCE_VIEW | ● | ● | – | ● | ● | ● | ◐ own | – | ● | ◐ |
| ATTENDANCE_UPDATE / APPROVE / CONFIGURE | ● | ● | – | ● | APPROVE | APPROVE | – | – | – | – |
| SHIFT_MANAGE | ● | ● | – | ● | – | – | – | – | – | – |
| ANALYTICS_VIEW | ● | ● | – | ● | ● | ● | – | – | ● | ◐ |
| ANOMALY_VIEW | ● | ● | – | – | ● | ● | – | ● | ● | ◐ |
| ANOMALY_UPDATE (review) | ● | ● | – | – | ● | – | – | – | – | – |
| ANOMALY_CONFIGURE | ● | ● | – | – | – | – | – | – | – | – |
| NOTIFICATION_VIEW | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| REPORT_VIEW / EXPORT | ● | ● | VIEW | ● | ● | ● | ◐ own | ◐ audit reports | ◐ sample | ◐ |
| POLICY_VIEW | ● | ● | ● | ● | ● | ● | ◐ own | ● | ● | ◐ |
| POLICY_CONFIGURE | ● | ● | ◐ deploy | – | – | – | – | – | – | – |
| PRIVACY_VIEW | ● | ● | – | ● | – | – | ◐ own | ● | ● | – |
| PRIVACY_MANAGE | ● | ● | – | ● | – | – | – | – | – | – |
| CORRECTION_REQUEST_CREATE | – | – | – | – | – | – | ● | – | – | – |
| CORRECTION_REQUEST_VIEW / APPROVE | ● | ● | – | ● | ● | ● | ◐ own | – | – | – |
| AUDIT_LOG_VIEW / EXPORT | ● | ● | ◐ technical | – | – | – | – | ● | ◐ demo | – |
| GUEST_* | ● | ● | – | – | – | – | – | VIEW | – | – |
| SYSTEM_VIEW | ● | ◐ org health | ● | – | – | – | – | – | – | – |
| SYSTEM_CONFIGURE | ● | – | – | – | – | – | – | – | – | – |
| SELF_VIEW / SELF_UPDATE | ● | ● | ● | ● | ● | ● | ● | ● | – | – |

Notes

* **Demo Guest** receives only `*_VIEW` permissions plus `REPORT_EXPORT` (sample reports),
  bound to the demo organisation. Every write endpoint rejects the `GUEST_DEMO` role.
* **Authorised Guest** permissions are chosen at invitation time from the `*_VIEW` and
  `*_EXPORT` catalogue, limited by the inviter's own permissions, and bound to a scope
  (organisation / department / team) plus an expiry date. Administrative permissions
  (`*_CREATE`, `*_UPDATE`, `*_DELETE`, `*_CONFIGURE`, `*_MANAGE`, `*_APPROVE`) can never
  be granted to a guest.
* **Auditor** is read-only: the role has no `CREATE/UPDATE/DELETE/APPROVE/CONFIGURE/MANAGE`
  permission, and every read of employee data is written to `data_access_logs`.
* Role codes in the database: `SUPER_ADMIN`, `ORG_ADMIN`, `IT_ADMIN`, `HR_ADMIN`,
  `DEPT_MANAGER`, `TEAM_LEAD`, `EMPLOYEE`, `AUDITOR`, `GUEST_DEMO`, `GUEST_AUTHORIZED`.

## Enforcement checklist (tested in `workpulse-backend`)

1. Unauthenticated request → `401`.
2. Authenticated without permission → `403` with `error.code = FORBIDDEN`.
3. Resource in another organisation → `404` (no existence leak).
4. Team Lead reading an employee outside the bound team → `404`.
5. `GUEST_DEMO` calling any non-GET endpoint (except `/guest/sessions/*`) → `403`.
6. Every successful employee-data read by a non-self principal creates a `data_access_logs` row.
