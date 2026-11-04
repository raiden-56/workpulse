import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';
import { renderWithProviders } from '@/test/testUtils';

describe('LoginPage', () => {
  it('validates the form before calling the API', async () => {
    renderWithProviders(<LoginPage />, { user: null, route: '/login' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => {
      expect(screen.getByText('Enter a valid work email')).toBeInTheDocument();
      expect(screen.getByText('Enter your password')).toBeInTheDocument();
    });
  });

  it('offers guest mode prominently', () => {
    renderWithProviders(<LoginPage />, { user: null, route: '/login' });
    expect(screen.getByRole('link', { name: /continue as guest/i })).toHaveAttribute('href', '/guest');
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('rejects a malformed email', async () => {
    renderWithProviders(<LoginPage />, { user: null, route: '/login' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/work email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(screen.getByText('Enter a valid work email')).toBeInTheDocument());
  });
});
