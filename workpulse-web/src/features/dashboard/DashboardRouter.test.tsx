import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeUser, renderWithProviders } from '@/test/testUtils';

vi.mock('./OverviewDashboard', () => ({ OverviewDashboard: ({ variant }: { variant: string }) => <div>overview:{variant}</div> }));
vi.mock('./HrDashboard', () => ({ HrDashboard: () => <div>hr-dashboard</div> }));
vi.mock('./ItDashboard', () => ({ ItDashboard: () => <div>it-dashboard</div> }));
vi.mock('./EmployeeDashboard', () => ({ EmployeeDashboard: () => <div>employee-dashboard</div> }));
vi.mock('./AuditorDashboard', () => ({ AuditorDashboard: () => <div>auditor-dashboard</div> }));
vi.mock('./SuperAdminDashboard', () => ({ SuperAdminDashboard: () => <div>super-admin-dashboard</div> }));

import { DashboardRouter } from './DashboardRouter';

describe('DashboardRouter', () => {
  it.each([
    [['ORG_ADMIN'], 'overview:executive'],
    [['DEPT_MANAGER'], 'overview:manager'],
    [['TEAM_LEAD'], 'overview:teamLead'],
    [['HR_ADMIN'], 'hr-dashboard'],
    [['IT_ADMIN'], 'it-dashboard'],
    [['AUDITOR'], 'auditor-dashboard'],
    [['EMPLOYEE'], 'employee-dashboard'],
    [['SUPER_ADMIN'], 'super-admin-dashboard'],
  ])('routes roles %s to %s', (roles, expected) => {
    renderWithProviders(<DashboardRouter />, { user: makeUser({ roles }) });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('prefers the highest role when several are granted', () => {
    renderWithProviders(<DashboardRouter />, { user: makeUser({ roles: ['EMPLOYEE', 'TEAM_LEAD', 'HR_ADMIN'] }) });
    expect(screen.getByText('overview:teamLead')).toBeInTheDocument();
  });

  it('shows the executive view for a super admin who selected an organisation', () => {
    renderWithProviders(<DashboardRouter />, { user: makeUser({ roles: ['SUPER_ADMIN'], organizationId: null }), organizationOverride: 'org-2' });
    expect(screen.getByText('overview:executive')).toBeInTheDocument();
  });

  it('follows the persona for demo guests', () => {
    renderWithProviders(<DashboardRouter />, { user: makeUser({ roles: ['GUEST_DEMO'], guestType: 'DEMO', guestPersona: 'IT_ADMIN' }) });
    expect(screen.getByText('it-dashboard')).toBeInTheDocument();
  });
});
