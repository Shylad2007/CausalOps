import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FixesView from '../components/FixesView';
import { useInvestigationStore } from '../store/investigationStore';
import * as apiClient from '../api/client';

vi.mock('../api/client', () => ({
  generateRemediationPatch: vi.fn(),
  verifyRemediationPatch: vi.fn(),
}));

describe('FixesView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInvestigationStore.setState({
      codebaseScanResult: null,
      activeFindingId: null,
    });
  });

  it('renders empty state when no codebase has been scanned', () => {
    render(
      <MemoryRouter>
        <FixesView />
      </MemoryRouter>
    );
    expect(screen.getByText('No Codebase Analyzed')).toBeInTheDocument();
    expect(screen.getByText(/Scan a codebase first to review proposed security patches/i)).toBeInTheDocument();
  });

  it('generates patch and verifies fix resolution for active finding', async () => {
    const mockFinding = {
      id: 'VULN-001',
      category: 'sql_injection',
      title: 'Raw SQL String Concatenation in User Search',
      file_path: 'backend/api/routes/users.py',
      line_start: 38,
      line_end: 40,
      code_snippet: 'query = f"SELECT * FROM users WHERE username = \'{search_query}\'"',
      cwe_id: 'CWE-89',
    };

    const mockScan = {
      project_id: 'proj-test-123',
      findings: [mockFinding],
    };

    apiClient.generateRemediationPatch.mockResolvedValueOnce({
      finding_id: 'VULN-001',
      file_path: 'backend/api/routes/users.py',
      proposed_code: 'query = "SELECT * FROM users WHERE username = %s"\ncursor.execute(query, (search_query,))',
      explanation: 'Replaces raw f-string with parameterized query.',
      diff: '--- a/users.py\n+++ b/users.py\n@@ -38,1 +38,1 @@\n-raw\n+fixed',
      verification_status: 'PENDING_APPROVAL',
    });

    apiClient.verifyRemediationPatch.mockResolvedValueOnce({
      finding_id: 'VULN-001',
      verification_status: 'VERIFIED_FIXED',
      message: 'Deterministic re-scan confirmed: Vulnerability eliminated.',
      verified: true,
      attack_path_severed: true,
    });

    useInvestigationStore.setState({
      codebaseScanResult: mockScan,
      activeFindingId: 'VULN-001',
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <FixesView />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Remediation & Fix Verification')).toBeInTheDocument();
    expect(screen.getAllByText('Raw SQL String Concatenation in User Search').length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText(/Replaces raw f-string with parameterized query/i)).toBeInTheDocument();
    });

    // Click Approve & Verify Remediation
    const verifyBtn = screen.getByRole('button', { name: /Approve & Verify Remediation/i });
    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText('VERIFIED_FIXED').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Deterministic re-scan confirmed/i)).toBeInTheDocument();
    });
  });

  it('clears stale patch data and reloads when switching between findings', async () => {
    const finding1 = {
      id: 'VULN-001',
      category: 'insecure_cors',
      title: 'Permissive Wildcard CORS Configuration',
      file_path: 'backend/main.py',
      line_start: 15,
      line_end: 17,
      code_snippet: 'allow_origins=["*"]',
      cwe_id: 'CWE-942',
    };

    const finding2 = {
      id: 'VULN-002',
      category: 'sql_injection',
      title: 'SQL Injection in User Search',
      file_path: 'backend/api/users.py',
      line_start: 20,
      line_end: 22,
      code_snippet: 'query = f"SELECT * FROM users WHERE username = \'{username}\'"',
      cwe_id: 'CWE-89',
    };

    const mockScan = {
      project_id: 'proj-multi-123',
      findings: [finding1, finding2],
    };

    // First patch for finding1
    apiClient.generateRemediationPatch.mockImplementation(async (projId, findingId) => {
      if (findingId === 'VULN-001') {
        return {
          finding_id: 'VULN-001',
          file_path: 'backend/main.py',
          proposed_code: 'ALLOWED_ORIGINS = ["http://localhost:5173"]',
          explanation: 'Replaces wildcard CORS with explicit origin allowlist.',
          diff: '--- a/main.py\n+++ b/main.py\n+ALLOWED_ORIGINS',
          verification_status: 'PENDING_APPROVAL',
        };
      } else if (findingId === 'VULN-002') {
        return {
          finding_id: 'VULN-002',
          file_path: 'backend/api/users.py',
          proposed_code: 'cursor.execute("SELECT * FROM users WHERE username = %s", (username,))',
          explanation: 'Uses parameterized query for SQL injection defense.',
          diff: '--- a/users.py\n+++ b/users.py\n+parameterized',
          verification_status: 'PENDING_APPROVAL',
        };
      }
    });

    useInvestigationStore.setState({
      codebaseScanResult: mockScan,
      activeFindingId: 'VULN-001',
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <FixesView />
        </MemoryRouter>
      );
    });

    // Should display finding1's patch rationale
    await waitFor(() => {
      expect(screen.getByText(/Replaces wildcard CORS with explicit origin allowlist/i)).toBeInTheDocument();
    });

    // Switch to finding2
    const finding2Card = screen.getByText('SQL Injection in User Search');
    await act(async () => {
      fireEvent.click(finding2Card);
    });

    // Finding1's rationale must no longer appear, and finding2's rationale should be loaded
    await waitFor(() => {
      expect(screen.queryByText(/Replaces wildcard CORS with explicit origin allowlist/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Uses parameterized query for SQL injection defense/i)).toBeInTheDocument();
    });
  });

  it('displays evidence trace, masked secret, remediation attribution, and tri-state verification', async () => {
    const mockFinding = {
      id: 'VULN-003',
      category: 'hardcoded_secret',
      title: 'Hardcoded Secret Key in Configuration',
      file_path: 'backend/config.py',
      line_start: 12,
      line_end: 12,
      code_snippet: 'JWT_SECRET = "super_secret_12345678"',
      masked_snippet: 'JWT_SECRET = "su************78"',
      cwe_id: 'CWE-798',
      detection_method: 'ast_analysis',
      source_location: 'backend/config.py:12 (AST Assignment to JWT_SECRET)',
      sink_location: 'backend/config.py:12 (Global module scope)',
      data_flow_steps: [
        {
          step_index: 1,
          location: 'backend/config.py:12',
          expression: 'JWT_SECRET = "su************78"',
          description: 'Hardcoded secret token assigned in code'
        }
      ]
    };

    const mockScan = {
      project_id: 'proj-evidence-test',
      findings: [mockFinding],
    };

    apiClient.generateRemediationPatch.mockResolvedValueOnce({
      finding_id: 'VULN-003',
      file_path: 'backend/config.py',
      proposed_code: 'import os\nJWT_SECRET = os.environ.get("JWT_SECRET")',
      explanation: 'Reads JWT_SECRET from environment variable instead of hardcoding.',
      diff: '--- a/config.py\n+++ b/config.py\n-JWT_SECRET = "..."\n+JWT_SECRET = os.environ.get("JWT_SECRET")',
      verification_status: 'PENDING_APPROVAL',
      remediation_source: 'gemma-4-26b-a4b-it',
      is_fallback: false,
      expected_security_effect: 'Eliminates plaintext secret from source code.',
      regression_risks: 'Requires JWT_SECRET environment variable in deployment.'
    });

    apiClient.verifyRemediationPatch.mockResolvedValueOnce({
      finding_id: 'VULN-003',
      verification_status: 'VERIFIED_FIXED',
      outcome: 'VERIFIED',
      message: 'Independent verification confirmed: finding eliminated.',
      verified: true,
      attack_path_severed: true,
      evidence_report: {
        syntax_valid: true,
        finding_eliminated: true,
        new_findings_introduced: 0,
        checks_executed: ['AST parse check', 'Regex vulnerability rules', 'Full directory re-scan']
      }
    });

    useInvestigationStore.setState({
      codebaseScanResult: mockScan,
      activeFindingId: 'VULN-003',
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <FixesView />
        </MemoryRouter>
      );
    });

    // Check evidence trace is displayed
    expect(screen.getByText('Source-to-Sink Evidence Trace')).toBeInTheDocument();
    expect(screen.getByText('backend/config.py:12 (AST Assignment to JWT_SECRET)')).toBeInTheDocument();
    expect(screen.getByText('JWT_SECRET = "su************78"')).toBeInTheDocument();

    // Check Gemma 4 attribution
    await waitFor(() => {
      expect(screen.getByText('gemma-4-26b-a4b-it')).toBeInTheDocument();
      expect(screen.getByText(/Eliminates plaintext secret from source code/i)).toBeInTheDocument();
    });

    // Click Approve & Verify
    const verifyBtn = screen.getByRole('button', { name: /Approve & Verify Remediation/i });
    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Fix Applied & Verified ✓')).toBeInTheDocument();
      expect(screen.getByText('Valid ✓')).toBeInTheDocument();
      expect(screen.getByText('Eliminated ✓')).toBeInTheDocument();
    });
  });
});
