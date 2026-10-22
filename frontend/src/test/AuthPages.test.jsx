import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../components/LoginPage';
import SignupPage from '../components/SignupPage';
import { useInvestigationStore } from '../store/investigationStore';
import * as client from '../api/client';

describe('Auth Pages Redesign (LoginPage & SignupPage)', () => {
  beforeEach(() => {
    localStorage.clear();
    useInvestigationStore.setState({
      authToken: null,
      currentUser: null,
      hasCompletedOnboarding: false,
    });
    vi.restoreAllMocks();
  });

  describe('LoginPage Component', () => {
    it('renders cohesive layout, branding, and properly sized form controls', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      // Branding and header
      expect(screen.getByText('CAUSALOPS')).toBeInTheDocument();
      expect(screen.getByText('Sign In to CausalOps')).toBeInTheDocument();
      expect(screen.getByText('Access your protected application security workbench')).toBeInTheDocument();

      // Controls
      expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();

      // Link to signup
      expect(screen.getByRole('link', { name: /Create an account/i })).toBeInTheDocument();
      expect(screen.queryByText(/Quick Test Credentials/i)).not.toBeInTheDocument();
    });

    it('toggles password visibility with Eye icon button', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      const passwordInput = screen.getByPlaceholderText('••••••••');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByTitle('Show password');
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');

      const hideBtn = screen.getByTitle('Hide password');
      fireEvent.click(hideBtn);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('displays error alert on login failure', async () => {
      vi.spyOn(client, 'loginUser').mockRejectedValueOnce(new Error('Invalid credentials provided.'));

      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('analyst'), { target: { value: 'analyst' } });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } });

      const submitBtn = screen.getByRole('button', { name: /Sign In/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Authentication Failed:/i)).toBeInTheDocument();
        expect(screen.getByText(/Invalid credentials provided\./i)).toBeInTheDocument();
      });
    });
  });

  describe('SignupPage Component', () => {
    it('renders signup form with username, email, password, and confirm password fields', () => {
      render(
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Create an account')).toBeInTheDocument();
      expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /Sign in/i }).length).toBeGreaterThanOrEqual(1);

      // Verify Phase 2 signup text update: connects repository, no sample project
      expect(screen.getByText(/After creating your account, you'll connect a GitHub repository to start your first security scan\./i)).toBeInTheDocument();
      expect(screen.queryByText(/choose a sample project/i)).not.toBeInTheDocument();
    });

    it('validates password mismatch on signup submission', async () => {
      render(
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('your-username'), { target: { value: 'alice_sec' } });
      fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'), { target: { value: 'secret123' } });
      fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: 'different' } });

      const submitBtn = screen.getByRole('button', { name: /Create account/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Passwords do not match\./i)).toBeInTheDocument();
    });

    it('validates minimum password length on signup submission', async () => {
      render(
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('your-username'), { target: { value: 'alice_sec' } });
      fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'), { target: { value: '123' } });
      fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: '123' } });

      const submitBtn = screen.getByRole('button', { name: /Create account/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Password must be at least 6 characters\./i)).toBeInTheDocument();
    });
  });
});
