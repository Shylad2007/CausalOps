import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { useInvestigationStore } from '../store/investigationStore';

describe('App Routing & Authentication Journey', () => {
  beforeEach(() => {
    localStorage.clear();
    useInvestigationStore.setState({
      authToken: null,
      currentUser: null,
      isAuthChecking: false,
      hasCompletedOnboarding: false,
      codebaseScanResult: null,
      activeFindingId: null,
      activeProjectId: null,
      scenario: null,
      graphData: null,
      hypothesesData: null,
      scorecardData: null,
    });
  });

  it('renders the public Homepage with value proposition and auth CTAs when unauthenticated', async () => {
    await act(async () => {
      render(<App />);
    });

    // Public header brand
    expect(screen.getByText('CAUSALOPS')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM')).toBeInTheDocument();

    // Hero title & value proposition
    expect(screen.getByText(/Build with AI\./i)).toBeInTheDocument();
    expect(screen.getByText(/Secure with confidence\./i)).toBeInTheDocument();
    expect(screen.getByText(/Connect your codebase, uncover security vulnerabilities/i)).toBeInTheDocument();

    // Public Navigation & Auth Buttons
    expect(screen.getAllByRole('link', { name: /Sign In/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /Get Started/i }).length).toBeGreaterThanOrEqual(1);

    // Protected dashboard tabs must NOT be visible to public users
    expect(screen.queryByText('3D Cyber World & Replay')).not.toBeInTheDocument();
    expect(screen.queryByText('Causal Event Graph')).not.toBeInTheDocument();
    expect(screen.queryByText('Competing Hypotheses')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login when attempting to access protected dashboard', async () => {
    window.history.pushState({}, 'Test', '/dashboard/cyber-world');

    await act(async () => {
      render(<App />);
    });

    // Must be redirected to the dedicated login page
    await waitFor(() => {
      expect(screen.getByText('Sign In to CausalOps')).toBeInTheDocument();
      expect(screen.getByText(/Access your protected application security workbench/i)).toBeInTheDocument();
    });
  });

  it('completes the full authentication, onboarding, dashboard, and logout flow', async () => {
    window.history.pushState({}, 'Test', '/');

    await act(async () => {
      render(<App />);
    });

    // 1. Click "Sign In" from the homepage
    const signInLink = screen.getAllByRole('link', { name: /Sign In/i })[0];
    await act(async () => {
      fireEvent.click(signInLink);
    });

    // 2. We should be on the dedicated Login page
    expect(screen.getByText('Sign In to CausalOps')).toBeInTheDocument();
    const usernameInput = screen.getByPlaceholderText('analyst');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    // 3. Submit login credentials
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'analyst' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);
    });

    // 4. Guided directly to the Protected Project Dashboard (/dashboard/projects)
    await waitFor(() => {
      expect(screen.getByText('CAUSALOPS')).toBeInTheDocument();
      expect(screen.getByText('Security Project Dashboard')).toBeInTheDocument();
    });

    // Verify authenticated user indicator is shown
    expect(screen.getAllByText(/analyst/).length).toBeGreaterThanOrEqual(1);

    // Verify primary navigation tabs are present
    expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Investigation Workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Competing Hypotheses/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Counterfactual Lab/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Investigation Scorecard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Remediation/i })).toBeInTheDocument();

    // Verify Connect GitHub repository action is present
    expect(screen.getAllByText(/Connect GitHub repository/i).length).toBeGreaterThanOrEqual(1);

    // 5. Sign Out
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    await act(async () => {
      fireEvent.click(signOutBtn);
    });

    // 6. Successfully redirected back to Login page
    await waitFor(() => {
      expect(screen.getByText('Sign In to CausalOps')).toBeInTheDocument();
    });
  });
});
