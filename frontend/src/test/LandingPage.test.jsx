import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../components/LandingPage';
import { useInvestigationStore } from '../store/investigationStore';

describe('LandingPage Component (Phase 1 Simplified)', () => {
  beforeEach(() => {
    useInvestigationStore.setState({
      authToken: null,
      currentUser: null,
    });
  });

  it('renders headline, supporting copy, primary CTA, secondary action, and compact 3-step explanation when unauthenticated', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    // Product name in brand header & footer
    expect(screen.getAllByText('CausalOps').length).toBeGreaterThanOrEqual(1);

    // Mandatory Hero Headline
    expect(screen.getByText(/Build with AI\./i)).toBeInTheDocument();
    expect(screen.getByText(/Secure with confidence\./i)).toBeInTheDocument();

    // Supporting Copy
    expect(
      screen.getByText(
        'Connect your codebase, uncover security vulnerabilities, and get actionable fixes you can verify.'
      )
    ).toBeInTheDocument();

    // Primary CTA: "Get started" linking to /signup
    const getStartedLinks = screen.getAllByRole('link', { name: /Get started/i });
    expect(getStartedLinks.length).toBeGreaterThanOrEqual(1);
    expect(getStartedLinks[0]).toHaveAttribute('href', '/signup');

    // Secondary action: "Sign in" linking to /login
    const signInLinks = screen.getAllByRole('link', { name: /Sign in/i });
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    expect(signInLinks[0]).toHaveAttribute('href', '/login');

    // Compact 3-Step Explanation
    expect(screen.getByText('Scan your code.')).toBeInTheDocument();
    expect(screen.getByText('Understand and fix vulnerabilities.')).toBeInTheDocument();
    expect(screen.getByText('Verify your fixes.')).toBeInTheDocument();

    // Removed obsolete marketing / incident reconstruction content
    expect(screen.queryByText(/A finding is only the beginning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/From isolated findings to an investigation workflow/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/One workspace\. Four connected capabilities/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Turn security findings into informed next steps/i)).not.toBeInTheDocument();
  });

  it('renders "Open dashboard" primary CTA and user session details when authenticated', () => {
    useInvestigationStore.setState({
      authToken: 'cop_valid_token_123',
      currentUser: { id: 'usr-1', username: 'alice_sec' },
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    // Authenticated user indicators
    expect(screen.getByText('alice_sec')).toBeInTheDocument();

    // Primary CTA switches to "Open dashboard"
    const dashboardLinks = screen.getAllByRole('link', { name: /Open dashboard/i });
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(1);
    expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard');

    // Sign out button
    expect(screen.getByRole('button', { name: /Sign out/i })).toBeInTheDocument();
  });
});
