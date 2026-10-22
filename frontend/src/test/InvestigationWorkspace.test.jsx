import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvestigationWorkspace from '../components/InvestigationWorkspace';
import { useInvestigationStore } from '../store/investigationStore';
import * as apiClient from '../api/client';

vi.mock('../api/client', () => ({
  simulateProjectIncident: vi.fn(),
  fetchScenarioCausalGraph: vi.fn(),
  fetchProjectScan: vi.fn(),
  fetchProjectScenario: vi.fn(),
  fetchCodebaseAttackGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
}));

const mockScanResult = {
  project_id: 'proj-demo-shoppulse',
  project_name: 'ShopPulse-API',
  open_findings_count: 2,
  scanned_at: '2026-10-21T10:00:00Z',
  findings: [
    { id: 'VULN-001', title: 'SQL Injection', severity: 'critical', finding_status: 'OPEN' },
    { id: 'VULN-002', title: 'Insecure Direct Object Reference', severity: 'high', finding_status: 'OPEN' },
  ],
};

const mockScenario = {
  project_id: 'proj-demo-shoppulse',
  entities: [
    { id: 'usr-attacker', name: 'External Attacker', type: 'user', zone: 'external', position_3d: [-4, 0, 0] },
    { id: 'srv-gateway', name: 'API Gateway', type: 'server', zone: 'dmz', position_3d: [0, 0, 0] },
    { id: 'db-orders', name: 'Orders DB', type: 'database', zone: 'prod_internal', position_3d: [4, 0, 0] },
  ],
  events: [
    {
      id: 'EVT-001',
      event_type: 'AUTH_PROBE',
      severity: 'medium',
      summary: 'Attacker probes login endpoint with SQL payload',
      timestamp: '2026-10-21T10:05:00Z',
      source_entity_id: 'usr-attacker',
      target_entity_id: 'srv-gateway',
    },
    {
      id: 'EVT-002',
      event_type: 'DATABASE_LEAK',
      severity: 'critical',
      summary: 'SQL injection dumps customer records from Orders DB',
      timestamp: '2026-10-21T10:06:00Z',
      source_entity_id: 'srv-gateway',
      target_entity_id: 'db-orders',
      process_lineage: {
        pid: 1420,
        ppid: 1,
        binary_path: '/usr/local/bin/python3',
        command_line: 'python3 -m uvicorn api.main:app',
      },
      observable_data: {
        injected_payload: "' OR 1=1 --",
        records_exfiltrated: 2400,
      },
    },
  ],
};

const mockGraphData = {
  project_id: 'proj-demo-shoppulse',
  nodes: [
    {
      id: 'EVT-001',
      event_type: 'AUTH_PROBE',
      severity: 'medium',
      summary: 'Attacker probes login endpoint with SQL payload',
      source_entity_id: 'usr-attacker',
    },
    {
      id: 'EVT-002',
      event_type: 'DATABASE_LEAK',
      severity: 'critical',
      summary: 'SQL injection dumps customer records from Orders DB',
      source_entity_id: 'srv-gateway',
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'EVT-001',
      target: 'EVT-002',
      rule_name: 'RuleProcessLineage',
      provenance: 'Deterministic Process Lineage Engine',
      explanation: 'Process memory and socket flow verify direct propagation from probe to dump.',
    },
  ],
  metrics: {
    node_count: 2,
    edge_count: 1,
    root_cause_candidates: ['EVT-001'],
  },
};

describe('InvestigationWorkspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInvestigationStore.setState({
      activeProjectId: null,
      codebaseScanResult: null,
      scenario: null,
      graphData: null,
      selectedEventId: null,
      selectedEntityId: null,
      currentTimelineIndex: 0,
    });
  });

  it('renders empty state when no active project is loaded', () => {
    render(
      <MemoryRouter>
        <InvestigationWorkspace />
      </MemoryRouter>
    );

    expect(screen.getByText('No Active Investigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to Projects Dashboard/i })).toBeInTheDocument();
  });

  it('renders investigation workspace header, project name, and open findings', () => {
    useInvestigationStore.setState({
      activeProjectId: 'proj-demo-shoppulse',
      codebaseScanResult: mockScanResult,
      scenario: mockScenario,
      graphData: mockGraphData,
      selectedEventId: 'EVT-001',
    });

    render(
      <MemoryRouter>
        <InvestigationWorkspace />
      </MemoryRouter>
    );

    expect(screen.getByText('ShopPulse-API')).toBeInTheDocument();
    expect(screen.getByText(/2 open findings/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3D World/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2D Causal DAG/i })).toBeInTheDocument();
    expect(screen.getByText(/Simulate Incident/i)).toBeInTheDocument();
  });

  it('switches between 3D and 2D views and renders 2D DAG nodes with deterministic provenance', async () => {
    useInvestigationStore.setState({
      activeProjectId: 'proj-demo-shoppulse',
      codebaseScanResult: mockScanResult,
      scenario: mockScenario,
      graphData: mockGraphData,
      selectedEventId: 'EVT-001',
    });

    render(
      <MemoryRouter>
        <InvestigationWorkspace />
      </MemoryRouter>
    );

    // Switch to 2D view
    const toggle2DBtn = screen.getByRole('button', { name: /2D Causal DAG/i });
    await act(async () => {
      fireEvent.click(toggle2DBtn);
    });

    // Check DAG elements
    expect(screen.getByText('Deterministic DAG')).toBeInTheDocument();
    expect(screen.getByText('100% Deterministic Provenance')).toBeInTheDocument();
    expect(screen.getAllByText('RuleProcessLineage').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Deterministic Process Lineage Engine/i)).toBeInTheDocument();
  });

  it('displays evidence details with clickable downstream causal link and process lineage telemetry', async () => {
    useInvestigationStore.setState({
      activeProjectId: 'proj-demo-shoppulse',
      codebaseScanResult: mockScanResult,
      scenario: mockScenario,
      graphData: mockGraphData,
      selectedEventId: 'EVT-002',
    });

    render(
      <MemoryRouter>
        <InvestigationWorkspace />
      </MemoryRouter>
    );

    // Evidence panel should show selected event EVT-002
    expect(screen.getByText('Event Evidence Record')).toBeInTheDocument();
    expect(screen.getByText('DATABASE_LEAK')).toBeInTheDocument();
    expect(screen.getByText(/Process Lineage Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText('python3 -m uvicorn api.main:app')).toBeInTheDocument();
    expect(screen.getByText(/Verified Incident Telemetry/i)).toBeInTheDocument();

    // Upstream cause should list EVT-001
    expect(screen.getByText(/Upstream Causes/i)).toBeInTheDocument();
  });
});