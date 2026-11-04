import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PermissionGate } from './PermissionGate';
import { makeUser, renderWithProviders } from '@/test/testUtils';

describe('PermissionGate', () => {
  it('renders children when the user holds the permission', () => {
    renderWithProviders(
      <PermissionGate permission="EMPLOYEE_VIEW" fallback={<span>denied</span>}>
        <span>allowed</span>
      </PermissionGate>,
      { user: makeUser({ permissions: ['EMPLOYEE_VIEW'] }) },
    );
    expect(screen.getByText('allowed')).toBeInTheDocument();
    expect(screen.queryByText('denied')).not.toBeInTheDocument();
  });

  it('renders the fallback when the permission is missing', () => {
    renderWithProviders(
      <PermissionGate permission="EMPLOYEE_CREATE" fallback={<span>denied</span>}>
        <span>allowed</span>
      </PermissionGate>,
      { user: makeUser({ permissions: ['EMPLOYEE_VIEW'] }) },
    );
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('accepts any of several permissions', () => {
    renderWithProviders(
      <PermissionGate permission={['A', 'DASHBOARD_VIEW']}>
        <span>any</span>
      </PermissionGate>,
      { user: makeUser({ permissions: ['DASHBOARD_VIEW'] }) },
    );
    expect(screen.getByText('any')).toBeInTheDocument();
  });

  it('hides write actions from guests even when the permission is present', () => {
    renderWithProviders(
      <PermissionGate permission="EMPLOYEE_CREATE" write fallback={<span>read-only</span>}>
        <span>create</span>
      </PermissionGate>,
      { user: makeUser({ permissions: ['EMPLOYEE_CREATE'], guestType: 'DEMO', roles: ['GUEST_DEMO'] }) },
    );
    expect(screen.getByText('read-only')).toBeInTheDocument();
  });
});
