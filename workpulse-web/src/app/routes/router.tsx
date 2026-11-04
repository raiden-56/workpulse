import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layouts/AppShell';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { P } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { RequireAnonymous, RequireAuth, RequirePermission } from './guards';

const crumb = (label: string) => ({ crumb: label });

export const router = createBrowserRouter([
  {
    element: (
      <RequireAnonymous>
        <AuthLayout />
      </RequireAnonymous>
    ),
    children: [
      { path: ROUTES.login, lazy: async () => ({ Component: (await import('@/features/auth/LoginPage')).LoginPage }) },
      { path: ROUTES.guest, lazy: async () => ({ Component: (await import('@/features/guest/GuestEntryPage')).GuestEntryPage }) },
      { path: ROUTES.forgotPassword, lazy: async () => ({ Component: (await import('@/features/auth/ForgotPasswordPage')).ForgotPasswordPage }) },
      { path: ROUTES.resetPassword, lazy: async () => ({ Component: (await import('@/features/auth/ResetPasswordPage')).ResetPasswordPage }) },
      { path: ROUTES.activate, lazy: async () => ({ Component: (await import('@/features/auth/ActivatePage')).ActivatePage }) },
    ],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    handle: crumb('Home'),
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/features/dashboard/DashboardRouter')).DashboardRouter }) },
      {
        path: 'live',
        handle: crumb('Live monitoring'),
        lazy: async () => {
          const { LiveMonitoringPage } = await import('@/features/live-monitoring/LiveMonitoringPage');
          return { Component: () => <RequirePermission permission={P.LIVE_MONITORING_VIEW}><LiveMonitoringPage /></RequirePermission> };
        },
      },
      {
        path: 'employees',
        handle: crumb('Employees'),
        children: [
          {
            index: true,
            lazy: async () => {
              const { EmployeesPage } = await import('@/features/employees/EmployeesPage');
              return { Component: () => <RequirePermission permission={P.EMPLOYEE_VIEW}><EmployeesPage /></RequirePermission> };
            },
          },
          {
            path: ':id',
            handle: crumb('Profile'),
            lazy: async () => {
              const { EmployeeProfilePage } = await import('@/features/employees/EmployeeProfilePage');
              return { Component: () => <RequirePermission permission={P.EMPLOYEE_VIEW}><EmployeeProfilePage /></RequirePermission> };
            },
          },
        ],
      },
      {
        path: 'organization',
        handle: crumb('Departments & teams'),
        lazy: async () => {
          const { OrganizationStructurePage } = await import('@/features/departments/OrganizationStructurePage');
          return { Component: () => <RequirePermission permission={P.DEPARTMENT_VIEW}><OrganizationStructurePage /></RequirePermission> };
        },
      },
      {
        path: 'organizations',
        handle: crumb('Organisations'),
        lazy: async () => {
          const { OrganizationsPage } = await import('@/features/organizations/OrganizationsPage');
          return { Component: () => <RequirePermission permission={P.ORGANIZATION_VIEW}><OrganizationsPage /></RequirePermission> };
        },
      },
      {
        path: 'users',
        handle: crumb('Users & roles'),
        lazy: async () => {
          const { UsersPage } = await import('@/features/users/UsersPage');
          return { Component: () => <RequirePermission permission={P.USER_VIEW}><UsersPage /></RequirePermission> };
        },
      },
      {
        path: 'devices',
        handle: crumb('Devices'),
        lazy: async () => {
          const { DevicesPage } = await import('@/features/devices/DevicesPage');
          return { Component: () => <RequirePermission permission={P.DEVICE_VIEW}><DevicesPage /></RequirePermission> };
        },
      },
      {
        path: 'policies',
        handle: crumb('Monitoring policies'),
        children: [
          {
            index: true,
            lazy: async () => {
              const { PoliciesPage } = await import('@/features/policies/PoliciesPage');
              return { Component: () => <RequirePermission permission={P.POLICY_VIEW}><PoliciesPage /></RequirePermission> };
            },
          },
          {
            path: ':id',
            handle: crumb('Policy'),
            lazy: async () => {
              const { PolicyDetailPage } = await import('@/features/policies/PolicyDetailPage');
              return { Component: () => <RequirePermission permission={P.POLICY_VIEW}><PolicyDetailPage /></RequirePermission> };
            },
          },
        ],
      },
      {
        path: 'audit',
        handle: crumb('Audit logs'),
        lazy: async () => {
          const { AuditPage } = await import('@/features/audit/AuditPage');
          return { Component: () => <RequirePermission permission={P.AUDIT_LOG_VIEW}><AuditPage /></RequirePermission> };
        },
      },
      {
        path: 'notifications',
        handle: crumb('Notifications'),
        lazy: async () => {
          const { NotificationsPage } = await import('@/features/notifications/NotificationsPage');
          return { Component: () => <RequirePermission permission={P.NOTIFICATION_VIEW}><NotificationsPage /></RequirePermission> };
        },
      },
      { path: 'privacy', handle: crumb('Privacy & data'), lazy: async () => ({ Component: (await import('@/features/privacy/PrivacyPage')).PrivacyPage }) },
      { path: 'settings', handle: crumb('Settings'), lazy: async () => ({ Component: (await import('@/features/settings/SettingsPage')).SettingsPage }) },
      { path: 'help', handle: crumb('Help centre'), lazy: async () => ({ Component: (await import('@/features/user-manual/HelpCenterPage')).HelpCenterPage }) },
      { path: 'attendance', handle: crumb('Attendance'), lazy: async () => ({ Component: (await import('@/features/planned/PlannedPages')).AttendancePlannedPage }) },
      { path: 'applications', handle: crumb('Applications'), lazy: async () => ({ Component: (await import('@/features/planned/PlannedPages')).ApplicationsPlannedPage }) },
      { path: 'anomalies', handle: crumb('Anomalies'), lazy: async () => ({ Component: (await import('@/features/planned/PlannedPages')).AnomaliesPlannedPage }) },
      { path: 'reports', handle: crumb('Reports'), lazy: async () => ({ Component: (await import('@/features/planned/PlannedPages')).ReportsPlannedPage }) },
      { path: '403', handle: crumb('Access denied'), lazy: async () => ({ Component: (await import('@/features/errors/ErrorPages')).ForbiddenPage }) },
      { path: '*', lazy: async () => ({ Component: (await import('@/features/errors/ErrorPages')).NotFoundPage }) },
    ],
  },
  { path: '*', element: <Navigate to={ROUTES.root} replace /> },
]);
