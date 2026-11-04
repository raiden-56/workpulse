package com.workpulse.security;

/** Permission codes. Must match the catalogue seeded in V2__seed_roles_permissions.sql. */
public final class Permissions {

    private Permissions() {}

    public static final String DASHBOARD_VIEW = "DASHBOARD_VIEW";
    public static final String LIVE_MONITORING_VIEW = "LIVE_MONITORING_VIEW";
    public static final String EMPLOYEE_VIEW = "EMPLOYEE_VIEW";
    public static final String EMPLOYEE_CREATE = "EMPLOYEE_CREATE";
    public static final String EMPLOYEE_UPDATE = "EMPLOYEE_UPDATE";
    public static final String EMPLOYEE_DELETE = "EMPLOYEE_DELETE";
    public static final String EMPLOYEE_EXPORT = "EMPLOYEE_EXPORT";
    public static final String DEPARTMENT_VIEW = "DEPARTMENT_VIEW";
    public static final String DEPARTMENT_CREATE = "DEPARTMENT_CREATE";
    public static final String DEPARTMENT_UPDATE = "DEPARTMENT_UPDATE";
    public static final String DEPARTMENT_DELETE = "DEPARTMENT_DELETE";
    public static final String TEAM_VIEW = "TEAM_VIEW";
    public static final String TEAM_CREATE = "TEAM_CREATE";
    public static final String TEAM_UPDATE = "TEAM_UPDATE";
    public static final String TEAM_DELETE = "TEAM_DELETE";
    public static final String USER_VIEW = "USER_VIEW";
    public static final String USER_CREATE = "USER_CREATE";
    public static final String USER_UPDATE = "USER_UPDATE";
    public static final String USER_MANAGE = "USER_MANAGE";
    public static final String ROLE_VIEW = "ROLE_VIEW";
    public static final String ORGANIZATION_VIEW = "ORGANIZATION_VIEW";
    public static final String ORGANIZATION_CREATE = "ORGANIZATION_CREATE";
    public static final String ORGANIZATION_UPDATE = "ORGANIZATION_UPDATE";
    public static final String ORGANIZATION_CONFIGURE = "ORGANIZATION_CONFIGURE";
    public static final String DEVICE_VIEW = "DEVICE_VIEW";
    public static final String DEVICE_UPDATE = "DEVICE_UPDATE";
    public static final String DEVICE_DELETE = "DEVICE_DELETE";
    public static final String DEVICE_APPROVE = "DEVICE_APPROVE";
    public static final String DEVICE_MANAGE = "DEVICE_MANAGE";
    public static final String ACTIVITY_VIEW = "ACTIVITY_VIEW";
    public static final String POLICY_VIEW = "POLICY_VIEW";
    public static final String AUDIT_LOG_VIEW = "AUDIT_LOG_VIEW";
    public static final String NOTIFICATION_VIEW = "NOTIFICATION_VIEW";
    public static final String SYSTEM_VIEW = "SYSTEM_VIEW";
    public static final String SELF_VIEW = "SELF_VIEW";
}
