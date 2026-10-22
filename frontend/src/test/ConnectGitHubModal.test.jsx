import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectGitHubModal from '../components/ConnectGitHubModal';
import { useInvestigationStore } from '../store/investigationStore';
import * as client from '../api/client';

describe('ConnectGitHubModal Component (Phase 3)', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockReset();
    vi.restoreAllMocks();
    useInvestigationStore.setState({
      currentUser: { id: 'usr-1', username: 'alice_sec' },
      setCodebaseScanResult: vi.fn(),
      setActiveFindingId: vi.fn(),
      fetchUserProjects: vi.fn(),
      loadProjectData: vi.fn(),
    });
  });

  it('renders modal when open with repository-scoped guidance and single-repo inputs', () => {
    render(<ConnectGitHubModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Connect GitHub Repository')).toBeInTheDocument();
    expect(
      screen.getByText(/CausalOps connects to one repository at a time/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/'Only select repositories'/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/'Contents: Read-only'/i)
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/GitHub Repository URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repository Access Token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Commit SHA/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Project Display Name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect & Scan Repository/i })).toBeInTheDocument();
  });

  it('toggles token visibility between password and text using the eye button', () => {
    render(<ConnectGitHubModal isOpen={true} onClose={mockOnClose} />);

    const tokenInput = screen.getByLabelText(/Repository Access Token/i);
    expect(tokenInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /Show token/i });
    fireEvent.click(toggleBtn);

    expect(tokenInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /Hide token/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hide token/i }));
    expect(tokenInput).toHaveAttribute('type', 'password');
  });

  it('rejects malformed or unsafe URLs before submitting API request', async () => {
    const connectSpy = vi.spyOn(client, 'connectGitHubRepo');
    render(<ConnectGitHubModal isOpen={true} onClose={mockOnClose} />);

    const urlInput = screen.getByLabelText(/GitHub Repository URL/i);
    const tokenInput = screen.getByLabelText(/Repository Access Token/i);
    const submitBtn = screen.getByRole('button', { name: /Connect & Scan Repository/i });

    // Try URL with userinfo
    fireEvent.change(urlInput, { target: { value: 'https://user:pass@github.com/org/repo' } });
    fireEvent.change(tokenInput, { target: { value: 'github_pat_12345' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/without credentials or parameters/i);
    });
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('submits valid repository and token data to connectGitHubRepo', async () => {
    const mockScanResult = {
      project_id: 'proj-12345',
      project_name: 'alice-org/secure-core',
      status: 'COMPLETED',
      total_findings: 2,
      findings: [{ id: 'f-1', category: 'sql_injection' }],
    };

    const connectSpy = vi
      .spyOn(client, 'connectGitHubRepo')
      .mockResolvedValueOnce(mockScanResult);

    render(<ConnectGitHubModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText(/GitHub Repository URL/i), {
      target: { value: 'https://github.com/alice-org/secure-core' },
    });
    fireEvent.change(screen.getByLabelText(/Repository Access Token/i), {
      target: { value: 'github_pat_validToken12345' },
    });
    fireEvent.change(screen.getByLabelText(/Branch/i), {
      target: { value: 'main' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Connect & Scan Repository/i }));

    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalledWith({
        repo_url: 'https://github.com/alice-org/secure-core',
        token: 'github_pat_validToken12345',
        branch: 'main',
        commit_sha: null,
        project_name: null,
        owner_username: 'alice_sec',
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
