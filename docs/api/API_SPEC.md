# WorkPulse – REST API Specification (v1)

Base path: `/api/v1`. Interactive documentation: `/swagger-ui.html` (OpenAPI 3 at `/v3/api-docs`).

## Conventions

### Authentication

| Caller | Header |
|---|---|
| Portal user / guest | `Authorization: Bearer <access JWT>` |
| Desktop agent | `X-Device-Token: <opaque device token>` |

JWT claims: `sub` (user id), `org` (organisation id, absent for super admin), `roles`,
`perms` (permission codes), `scope` (`{level, departmentIds, teamIds, employeeId}`),
`gt` (guest type, only for guests), `exp`.

### Response envelope

```json
{
  "success": true,
  "data": { },
  "meta": { "page": 0, "size": 20, "totalElements": 134, "totalPages": 7 },
  "timestamp": "2026-11-04T10:15:30Z"
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [ { "field": "workEmail", "message": "must be a well-formed email address" } ],
    "traceId": "9d1c3f0a4b1e"
  },
  "timestamp": "2026-11-04T10:15:30Z"
}
```

Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`RATE_LIMITED`, `TOKEN_EXPIRED`, `TOKEN_REUSED`, `DEVICE_REVOKED`, `GUEST_EXPIRED`,
`INTERNAL_ERROR`.

### Pagination, sorting, filtering

`?page=0&size=20&sort=lastName,asc&sort=joiningDate,desc`. Max `size` is 200.
Filters are explicit query parameters (`departmentId`, `teamId`, `status`, `q` for search,
`from`, `to` as ISO dates). Date ranges are inclusive and interpreted in the
organisation's timezone unless `tz` is passed.

### Versioning

Path versioned (`/api/v1`). Breaking changes create `/api/v2`; additive changes do not.

## Endpoints

Status: **P1** implemented in Phase 1 · **Pn** planned for phase n.

### Auth (`/auth`)

| Method | Path | Permission | Status |
|---|---|---|---|
| POST | `/auth/login` | public (rate-limited) | P1 |
| POST | `/auth/refresh` | refresh token | P1 |
| POST | `/auth/logout` | authenticated | P1 |
| GET | `/auth/me` | authenticated | P1 |
| POST | `/auth/forgot-password` | public | P1 |
| POST | `/auth/reset-password` | public (token) | P1 |
| POST | `/auth/change-password` | authenticated | P1 |
| POST | `/auth/mfa/enroll` · `/auth/mfa/verify` | authenticated | P12 |
| GET | `/auth/sso/entra/authorize` · `/auth/sso/entra/callback` | public | P12 |
| GET | `/auth/login-history` | SELF_VIEW (own) · USER_VIEW (others) | P1 |

### Guest (`/guest`)

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/guest/config` | public | P1 |
| POST | `/guest/sessions` | public (rate-limited) → demo JWT | P1 |
| DELETE | `/guest/sessions/current` | GUEST_DEMO | P1 |
| POST | `/guest/demo/reset` | GUEST_DEMO (own session) | P1 |
| GET/POST | `/guest/accounts` | GUEST_VIEW / GUEST_CREATE | P11 |
| POST | `/guest/accounts/{id}/activate` · `/revoke` · `/extend` | GUEST_UPDATE | P11 |
| POST | `/guest/invitations/{token}/accept` | public (token) | P11 |

### Users and roles (`/users`, `/roles`)

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/users` · `/users/{id}` | USER_VIEW | P1 |
| POST | `/users/invite` | USER_CREATE | P1 |
| POST | `/users/activate` | public (token) | P1 |
| PUT | `/users/{id}` | USER_UPDATE | P1 |
| POST | `/users/{id}/suspend` · `/reactivate` · `/revoke` | USER_MANAGE | P1 |
| PUT | `/users/{id}/roles` | USER_MANAGE | P1 |
| GET | `/roles` · `/permissions` | ROLE_VIEW | P1 |

### Organisations, departments, teams

| Method | Path | Permission | Status |
|---|---|---|---|
| GET/POST | `/organizations` | ORGANIZATION_VIEW / ORGANIZATION_CREATE (GLOBAL) | P1 |
| GET/PUT | `/organizations/{id}` | ORGANIZATION_VIEW / ORGANIZATION_UPDATE | P1 |
| GET/PUT | `/organizations/current/settings` | ORGANIZATION_CONFIGURE | P1 |
| GET/POST | `/departments` | DEPARTMENT_VIEW / DEPARTMENT_CREATE | P1 |
| GET/PUT/DELETE | `/departments/{id}` | DEPARTMENT_* | P1 |
| GET/POST | `/teams` | TEAM_VIEW / TEAM_CREATE | P1 |
| GET/PUT/DELETE | `/teams/{id}` | TEAM_* | P1 |

### Employees (`/employees`)

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/employees` | EMPLOYEE_VIEW (scoped) | P1 |
| POST | `/employees` | EMPLOYEE_CREATE | P1 |
| GET | `/employees/{id}` | EMPLOYEE_VIEW (scoped) | P1 |
| PUT | `/employees/{id}` | EMPLOYEE_UPDATE | P1 |
| POST | `/employees/{id}/deactivate` | EMPLOYEE_DELETE | P1 |
| PUT | `/employees/{id}/manager` · `/department` · `/team` | EMPLOYEE_UPDATE | P1 |
| POST | `/employees/import` (multipart CSV) | EMPLOYEE_CREATE | P3 |
| GET | `/employees/export` | EMPLOYEE_EXPORT | P3 |
| GET | `/employees/me` | SELF_VIEW | P1 |

### Devices and agent

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/devices` · `/devices/{id}` | DEVICE_VIEW (scoped) | P1 |
| PUT | `/devices/{id}` | DEVICE_UPDATE | P1 |
| POST | `/devices/{id}/approve` | DEVICE_APPROVE | P1 |
| POST | `/devices/{id}/revoke` | DEVICE_DELETE | P1 |
| PUT | `/devices/{id}/employee` | DEVICE_UPDATE | P1 |
| GET | `/devices/{id}/diagnostics` | DEVICE_MANAGE | P5 |
| GET/POST | `/agent-versions` | AGENT_MANAGE | P5 |
| POST | `/agent/register` | user JWT (employee) → device + token | P1 |
| POST | `/agent/heartbeat` | device token | P1 |
| GET | `/agent/policy` | device token | P1 |
| GET | `/agent/update-check` | device token | P5 |

### Activity and applications

| Method | Path | Permission | Status |
|---|---|---|---|
| POST | `/activity/batch` | device token (idempotent) | P1 |
| GET | `/activity/timeline?employeeId&date` | ACTIVITY_VIEW (scoped) / SELF_VIEW | P1 |
| GET | `/activity/sessions?employeeId&from&to` | ACTIVITY_VIEW / SELF_VIEW | P6 |
| GET | `/activity/live` | LIVE_MONITORING_VIEW | P1 |
| GET | `/applications/catalog` | APPLICATION_USAGE_VIEW | P7 |
| GET | `/applications/usage?employeeId|teamId|departmentId&from&to&granularity` | APPLICATION_USAGE_VIEW / SELF_VIEW | P7 |
| GET | `/applications/top?from&to` | APPLICATION_USAGE_VIEW | P7 |
| GET/PUT | `/applications/classifications` | APPLICATION_CLASSIFICATION_VIEW / _CONFIGURE | P7 |

### Attendance and shifts

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/attendance/daily?date&departmentId&teamId` | ATTENDANCE_VIEW (scoped) | P7 |
| GET | `/attendance/summary?employeeId&from&to` | ATTENDANCE_VIEW / SELF_VIEW | P7 |
| GET | `/attendance/me?from&to` | SELF_VIEW | P7 |
| GET | `/attendance/export` | ATTENDANCE_EXPORT | P7 |
| GET/POST/PUT | `/shifts` · `/shifts/{id}` | SHIFT_VIEW / SHIFT_MANAGE | P7 |
| GET/POST | `/corrections` | CORRECTION_REQUEST_VIEW / _CREATE | P7 |
| POST | `/corrections/{id}/approve` · `/reject` | CORRECTION_REQUEST_APPROVE | P7 |

### Dashboard and analytics

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/dashboard/overview?from&to&departmentId&teamId` | DASHBOARD_VIEW (scoped) | P1 |
| GET | `/dashboard/me` | SELF_VIEW | P1 |
| GET | `/analytics/overview` · `/analytics/departments` · `/analytics/teams/{id}` | ANALYTICS_VIEW | P7 |
| GET | `/analytics/trends?granularity=day|week|month` | ANALYTICS_VIEW | P7 |

### Anomalies, notifications, reports

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/anomalies` · `/anomalies/{id}` | ANOMALY_VIEW | P9 |
| POST | `/anomalies/{id}/review` | ANOMALY_UPDATE | P9 |
| GET/PUT | `/anomalies/rules` | ANOMALY_CONFIGURE | P9 |
| GET | `/notifications` · PUT `/notifications/{id}/read` · POST `/notifications/read-all` | NOTIFICATION_VIEW | P10 |
| GET | `/reports` (catalogue) · POST `/reports/{type}/export` | REPORT_VIEW / REPORT_EXPORT | P10 |

### Policies, privacy, audit

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/policies` · `/policies/{id}` · `/policies/effective?employeeId` | POLICY_VIEW | P1 |
| POST/PUT | `/policies` · `/policies/{id}` | POLICY_CONFIGURE | P11 |
| PUT | `/policies/{id}/assignments` | POLICY_CONFIGURE | P11 |
| GET | `/privacy/notice` · `/privacy/my-data` · POST `/privacy/acknowledge` | SELF_VIEW | P11 |
| POST | `/privacy/deletion-requests` | PRIVACY_MANAGE | P11 |
| GET | `/audit-logs?from&to&actor&entityType&action` | AUDIT_LOG_VIEW | P1 |
| GET | `/audit-logs/export` | AUDIT_LOG_EXPORT | P12 |
| GET | `/data-access-logs` | AUDIT_LOG_VIEW | P11 |

### System

| Method | Path | Permission | Status |
|---|---|---|---|
| GET | `/system/health` | SYSTEM_VIEW | P1 |
| GET | `/actuator/health` (liveness/readiness) | public (infra network only) | P1 |

## WebSocket

Endpoint `/ws` (STOMP). Subscriptions:

| Destination | Payload | Permission |
|---|---|---|
| `/topic/org.{orgId}.live` | `LiveStatusDelta` | LIVE_MONITORING_VIEW |
| `/topic/org.{orgId}.devices` | `DeviceHealthDelta` | DEVICE_VIEW |
| `/user/queue/notifications` | `Notification` | authenticated |

Phase 1 provides the endpoint and the `live` topic; the polling fallback is
`GET /activity/live`.
