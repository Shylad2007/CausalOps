import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AttackPathsView from '../components/AttackPathsView';
import { useInvestigationStore } from '../store/investigationStore';
import * as apiClient from '../api/client';

vi.mock('../api/client', () => ({
  fetchCodebaseAttackGraph: vi.fn(),
  fetchDemoCodebase: vi.fn(),
}));

describe('AttackPathsView Component', () => {
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
        <AttackPathsView />
      </MemoryRouter>
    );
    expect(screen.getByText('No Codebase Analyzed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load Sample Codebase Demo/i })).toBeInTheDocument();
  });

  it('loads and renders attack graph nodes and switches between 3D and 2D views', async () => {
    const mockScan = {
      project_id: 'proj-demo-shoppulse',
      project_name: 'ShopPulse-API',
      findings: [
        {
          id: 'VULN-001',
          title: 'SQL Injection in Users',
          file_path: 'backend/api/users.py',
          line_start: 38,
          category: 'sql_injection',
          severity: 'critical',
          code_snippet: 'cursor.execute(query)',
        },
      ],
    };

    const mockGraph = {
      project_id: 'proj-demo-shoppulse',
      nodes: [
        { id: 'node-attacker-client', name: 'External Client', category: 'entrypoint', zone: 'dmz', type: 'user', position_3d: [-5, 0, 0] },
        { id: 'node-api-router', name: 'API Gateway', category: 'api_gateway', zone: 'dmz', type: 'server', position_3d: [-1.5, 0, 0] },
        { id: 'node-comp-VULN-001', name: 'users.py:38', category: 'vulnerable_component', zone: 'prod_internal', type: 'process', severity: 'critical', finding_id: 'VULN-001', position_3d: [2, 0, 0] },
        { id: 'node-sink-VULN-001', name: 'PostgreSQL DB Sink', category: 'compromised_sink', zone: 'prod_internal', type: 'database', position_3d: [5.5, 0, 0] },
      ],
      edges: [
        { id: 'e1', source: 'node-attacker-client', target: 'node-api-router', relationship_type: 'network_socket_link' },
        { id: 'e2', source: 'node-api-router', target: 'node-comp-VULN-001', relationship_type: 'process_parent_child' },
        { id: 'e3', source: 'node-comp-VULN-001', target: 'node-sink-VULN-001', relationship_type: 'credential_use' },
      ],
      metrics: {
        node_count: 4,
        edge_count: 3,
        critical_attack_paths: 1,
      },
    };

    apiClient.fetchCodebaseAttackGraph.mockResolvedValueOnce(mockGraph);

    useInvestigationStore.setState({
      codebaseScanResult: mockScan,
      activeFindingId: 'VULN-001',
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AttackPathsView />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Codebase Attack Paths')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Causal Edges:')).toBeInTheDocument();
    });

    // Toggle to 2D Causal Flow view
    const toggle2DBtn = screen.getByRole('button', { name: /2D Causal Flow/i });
    await act(async () => {
      fireEvent.click(toggle2DBtn);
    });

    // In 2D view, architectural tiers should be visible
    expect(screen.getByText('Tier 1: Entrypoint')).toBeInTheDocument();
    expect(screen.getByText('Tier 2: Router')).toBeInTheDocument();
    expect(screen.getByText('Tier 3: Handlers')).toBeInTheDocument();
    expect(screen.getByText('Tier 4: Sinks')).toBeInTheDocument();
  });
});
