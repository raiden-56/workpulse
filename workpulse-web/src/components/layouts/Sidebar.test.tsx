import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar, visibleNavItems } from './Sidebar';
import { hasAny } from '@/constants/permissions';
import { makeUser, renderWithProviders } from '@/test/testUtils';

describe('Sidebar', () => {
  it('shows only navigation items the user is permitted to see', () => {
    renderWithProviders(<Sidebar collapsed={false} />, {
      user: makeUser({ permissions: ['DASHBOARD_VIEW', 'EMPLOYEE_VIEW', 'NOTIFICATION_VIEW'] }),
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.queryByText('Devices')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Users & roles')).not.toBeInTheDocument();
    // always-visible account items
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Help centre')).toBeInTheDocument();
  });

  it('marks planned modules and keeps them gated by permission', () => {
    const items = visibleNavItems((p) => hasAny(['ANOMALY_VIEW'], p));
    expect(items.map((i) => i.id)).toContain('anomalies');
    expect(items.find((i) => i.id === 'anomalies')?.planned).toBe(true);
    expect(items.map((i) => i.id)).not.toContain('devices');
  });

  it('collapsed mode renders icons without labels', () => {
    renderWithProviders(<Sidebar collapsed />, { user: makeUser({ permissions: ['DASHBOARD_VIEW'] }) });
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
});
