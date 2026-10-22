import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectDashboard from '../components/ProjectDashboard';
import { useInvestigationStore } from '../store/investigationStore';
import * as client from '../api/client';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      onOpenConnectModal: vi.fn(),
    }),
  };
});

describe('ProjectDashboard Component (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    vi.restoreAllMocks();
    useInvestigationStore.setState({
      authToken: 'test_token',
      currentUser: { id: 'usr-1', username: 'alice_sec' },
      activeProjectId: null,
      codebaseScanResult: null,
      userProjects: [],
    });
  });

  it('renders clean first-time empty state when user has no connected repositories', async () => {
    vi.spyOn(client, 'fetchProjectsSummary').mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>
    );

    // Header elements
    expect(screen.getByText('Security Project Dashboard')).toBeInTheDocument();
    expect(screen.getByText('@alice_sec')).toBeInTheDocument();

    await waitFor(() => {
      // Mandatory empty state heading & copy
      expect(screen.getByText('Secure your codebase')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Connect a GitHub repository to scan for vulnerabilities, investigate findings, and verify fixes.'
        )
      ).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Connect GitHub repository/i }).length).toBeGreaterThanOrEqual(1);
    });

    // Must NOT contain sample-project or demo prompts
    expect(screen.queryByText(/Load sample project/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ShopPulse sample/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Full Stack Web App/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Backend Microservice/i)).not.toBeInTheDocument();
  });

  it('renders returning user projects and enforces user isolation', async () => {
    const mockSummary = [
      {
        project_id: 'proj-alice-1',
        project_name: 'alice/secure-api',
        is_demo: false,
        owner_username: 'alice_sec',
        repository_url: 'https://github.com/alice/secure-api',
        branch: 'main',
        total_findings: 3,
        open_findings_count: 2,
        fixed_findings_count: 1,
        status: 'COMPLETED',
        scan_timestamp: '2026-10-21T12:00:00Z',
      },
      {
        project_id: 'proj-bob-1',
        project_name: 'bob/secret-repo',
        is_demo: false,
        owner_username: 'bob_user',
        repository_url: 'https://github.com/bob/secret-repo',
        branch: 'main',
        total_findings: 5,
        open_findings_count: 5,
        fixed_findings_count: 0,
        status: 'COMPLETED',
        scan_timestamp: '2026-10-21T12:00:00Z',
      },
      {
        project_id: 'proj-demo-shoppulse',
        project_name: 'ShopPulse Demo',
        is_demo: true,
        owner_username: 'system',
        total_findings: 10,
        open_findings_count: 10,
        fixed_findings_count: 0,
        status: 'COMPLETED',
      },
    ];

    vi.spyOn(client, 'fetchProjectsSummary').mockResolvedValueOnce(mockSummary);

    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>
    );

    // Wait for projects list to load
    await waitFor(() => {
      expect(screen.getByText('alice/secure-api')).toBeInTheDocument();
      expect(screen.getByText('Connected Repositories (1)')).toBeInTheDocument();
    });

    // Enforce user isolation: Bob's repository and system demo project must NOT appear
    expect(screen.queryByText('bob/secret-repo')).not.toBeInTheDocument();
    expect(screen.queryByText('ShopPulse Demo')).not.toBeInTheDocument();

    // Verify displayed project fields
    expect(screen.getByText('https://github.com/alice/secure-api')).toBeInTheDocument();
    expect(screen.getByText(/2 open · 1 fixed/i)).toBeInTheDocument();
  });

  it('renders active project summary with findings and workspace links', async () => {
    vi.spyOn(client, 'fetchProjectsSummary').mockResolvedValueOnce([
      {
        project_id: 'proj-alice-1',
        project_name: 'alice/secure-api',
        is_demo: false,
        owner_username: 'alice_sec',
        repository_url: 'https://github.com/alice/secure-api',
        branch: 'main',
        total_findings: 2,
        open_findings_count: 2,
        fixed_findings_count: 0,
        status: 'COMPLETED',
      },
    ]);

    useInvestigationStore.setState({
      activeProjectId: 'proj-alice-1',
      codebaseScanResult: {
        project_id: 'proj-alice-1',
        project_name: 'alice/secure-api',
        repository_url: 'https://github.com/alice/secure-api',
        branch: 'main',
        commit_sha: 'a1b2c3d4e5f6',
        scan_timestamp: '2026-10-21T15:30:00Z',
        status: 'COMPLETED',
        total_findings: 2,
        critical_count: 1,
        high_count: 1,
        open_findings_count: 2,
        fixed_findings_count: 0,
        findings: [
          { id: 'find-1', title: 'SQL Injection', severity: 'critical', finding_status: 'OPEN' },
          { id: 'find-2', title: 'Command Injection', severity: 'high', finding_status: 'OPEN' },
        ],
        manifest: { detected_languages: ['Python', 'JavaScript'] },
      },
    });

    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>
    );

    // Active project banner
    await waitFor(() => {
      expect(screen.getByText('Active Investigation Target')).toBeInTheDocument();
    });
    expect(screen.getAllByText('alice/secure-api').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();

    // Core workspaces
    expect(screen.getByText('Remediation')).toBeInTheDocument();
    expect(screen.getByText('Investigation Workspace')).toBeInTheDocument();
    expect(screen.getByText('Competing Hypotheses')).toBeInTheDocument();
    expect(screen.getByText('Counterfactual Lab')).toBeInTheDocument();
    expect(screen.getByText('Investigation Scorecard')).toBeInTheDocument();
  });

  it('renders clean confirmation when active project scan has zero vulnerabilities', async () => {
    vi.spyOn(client, 'fetchProjectsSummary').mockResolvedValueOnce([
      {
        project_id: 'proj-clean-1',
        project_name: 'alice/clean-service',
        is_demo: false,
        owner_username: 'alice_sec',
        total_findings: 0,
        open_findings_count: 0,
        fixed_findings_count: 0,
        status: 'COMPLETED',
      },
    ]);

    useInvestigationStore.setState({
      activeProjectId: 'proj-clean-1',
      codebaseScanResult: {
        project_id: 'proj-clean-1',
        project_name: 'alice/clean-service',
        status: 'COMPLETED',
        total_findings: 0,
        open_findings_count: 0,
        fixed_findings_count: 0,
        findings: [],
      },
    });

    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Deterministic scan passed: 0 security vulnerabilities detected in repository tree\./i)
      ).toBeInTheDocument();
    });
  });
});
