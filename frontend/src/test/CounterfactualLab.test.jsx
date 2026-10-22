import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CounterfactualLab from '../components/CounterfactualLab';
import { useInvestigationStore } from '../store/investigationStore';
import * as apiClient from '../api/client';

vi.mock('../api/client', () => ({
  runCounterfactual: vi.fn(),
}));

describe('CounterfactualLab Component', () => {
  const mockScenario = {
    id: 'test-scenario',
    events: [
      { id: 'EVT-1001', event_type: 'auth_success', timestamp: '2026-03-24T08:00:00Z', source_entity_id: 'usr-1', summary: 'Login' },
      { id: 'EVT-1005', event_type: 'process_spawn', timestamp: '2026-03-24T09:12:00Z', source_entity_id: 'workstation-1', summary: 'Spawned cmd.exe' },
      { id: 'EVT-1006', event_type: 'process_spawn', timestamp: '2026-03-24T09:14:00Z', source_entity_id: 'workstation-1', summary: 'Spawned d.exe' }
    ]
  };

  const mockResult = {
    experiment_id: 'exp-test123',
    scenario_id: 'test-scenario',
    mutation: {
      mutation_type: 'REMOVE_EVENT',
      target_event_id: 'EVT-1005'
    },
    baseline_event_count: 3,
    modified_event_count: 2,
    baseline_edge_count: 2,
    modified_edge_count: 0,
    edges_removed: [
      {
        source_event_id: 'EVT-1005',
        target_event_id: 'EVT-1006',
        relationship_type: 'process_parent_child',
        rule_name: 'RuleProcessLineage',
        explanation: 'Process spawned by EVT-1005.'
      }
    ],
    edges_added: [],
    broken_causal_chains: [
      {
        removed_edge: { source: 'EVT-1005', target: 'EVT-1006' },
        downstream_events_disconnected: ['EVT-1006'],
        explanation: 'Removing EVT-1005 severs downstream execution of d.exe.'
      }
    ],
    hypothesis_impact: {
      reassessment: 'Eliminating EVT-1005 dismantles the attack progression completely.',
      affected_hypotheses: [
        {
          hypothesis_id: 'hyp-001',
          status: 'refuted',
          impact_summary: 'Primary chain broken.'
        }
      ],
      interpretation_type: 'ai_generated_interpretation',
      source: 'gemma-4-26b-a4b-it',
      unsupported_citations: []
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useInvestigationStore.setState({
      counterfactualResult: null,
      isExecutingMutation: false,
      counterfactualError: null,
    });
  });

  it('renders initial setup with presets and run button', () => {
    render(<CounterfactualLab scenario={mockScenario} onSelectEvent={vi.fn()} />);

    expect(screen.getByText('Counterfactual Investigation Lab')).toBeInTheDocument();
    expect(screen.getByText('1. Block Payload Download (EVT-1005)')).toBeInTheDocument();
    expect(screen.getByText('Run Counterfactual Experiment')).toBeInTheDocument();
  });

  it('renders deterministic metrics and severed edges table when experiment result is set', () => {
    useInvestigationStore.setState({ counterfactualResult: mockResult });
    const onSelectEvent = vi.fn();

    render(<CounterfactualLab scenario={mockScenario} onSelectEvent={onSelectEvent} />);

    expect(screen.getByText('Deterministic Recomputation Summary (NetworkX Engine)')).toBeInTheDocument();
    expect(screen.getByText('exp-test123', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('RuleProcessLineage')).toBeInTheDocument();
    expect(screen.getByText('Process spawned by EVT-1005.')).toBeInTheDocument();

    // Verify AI Reassessment with disclaimer is rendered
    expect(screen.getByText('Gemma 4 Counterfactual Hypothesis Reassessment')).toBeInTheDocument();
    expect(screen.getByText('AI Interpretation — Not a Deterministic Certainty')).toBeInTheDocument();
    expect(screen.getByText('Status: refuted')).toBeInTheDocument();

    // Clicking severed source event calls onSelectEvent
    fireEvent.click(screen.getByText('EVT-1005'));
    expect(onSelectEvent).toHaveBeenCalledWith('EVT-1005');
  });

  it('switches mutation type to mutate field and executes experiment', async () => {
    apiClient.runCounterfactual.mockResolvedValueOnce(mockResult);

    render(<CounterfactualLab scenario={mockScenario} onSelectEvent={vi.fn()} />);

    // Click Mutate Field button
    const mutateFieldBtn = screen.getByRole('button', { name: /Mutate Field/i });
    fireEvent.click(mutateFieldBtn);

    expect(screen.getByPlaceholderText('e.g. session_id')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. revoked_val')).toBeInTheDocument();

    // Click Run experiment
    const runBtn = screen.getByRole('button', { name: /Run Counterfactual Experiment/i });
    await act(async () => {
      fireEvent.click(runBtn);
    });

    expect(apiClient.runCounterfactual).toHaveBeenCalledWith(
      'test-scenario',
      expect.objectContaining({
        mutation_type: 'MODIFY_EVENT_FIELD',
      }),
      true
    );
  });

  it('handles error states and reset to baseline button', () => {
    useInvestigationStore.setState({
      counterfactualResult: mockResult,
      counterfactualError: 'NetworkX recomputation timeout',
    });

    render(<CounterfactualLab scenario={mockScenario} onSelectEvent={vi.fn()} />);

    expect(screen.getByText('NetworkX recomputation timeout')).toBeInTheDocument();

    // Reset button clears result
    const resetBtn = screen.getByRole('button', { name: /Reset to Baseline/i });
    fireEvent.click(resetBtn);

    expect(useInvestigationStore.getState().counterfactualResult).toBeNull();
  });
});