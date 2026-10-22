import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import HypothesesView from '../components/HypothesesView';

describe('HypothesesView Component', () => {
  const mockHypothesesData = {
    scenario_id: 'test-scenario',
    source: 'gemma-4-26b-a4b-it',
    model_name: 'models/gemma-4-26b-a4b-it',
    audit_flags: [],
    hypotheses: [
      {
        id: 'hyp-001',
        title: 'Lateral Movement via In-Memory Token Theft',
        description: 'Attacker dumped LSASS and used stolen token.',
        supporting_event_ids: ['EVT-1005', 'EVT-1006'],
        contradictory_event_ids: ['EVT-1004'],
        unsupported_event_ids: [],
        assumptions: ['Token was valid'],
        unresolved_questions: ['Was MFA prompted?'],
        investigation_status: 'supported',
        support_assessment: 'Proven by process lineage.',
        recommended_steps: ['Isolate host'],
        alternative_explanations: ['Admin script']
      },
      {
        id: 'hyp-002',
        title: 'Authorized Administrative Maintenance',
        description: 'Routine maintenance script execution.',
        supporting_event_ids: [],
        contradictory_event_ids: ['EVT-1005'],
        unsupported_event_ids: [],
        assumptions: ['Maintenance window was scheduled'],
        unresolved_questions: ['Is there a matching ticket?'],
        investigation_status: 'disputed',
        support_assessment: 'Contradicted by unauthorized process execution.',
        recommended_steps: ['Check change tickets'],
        alternative_explanations: []
      }
    ]
  };

  it('renders hypothesis card with status and citations', () => {
    const onEvaluate = vi.fn();
    const onSelectEvent = vi.fn();
    const onChallenge = vi.fn();

    render(
      <HypothesesView
        hypothesesData={mockHypothesesData}
        isLoading={false}
        error={null}
        onEvaluate={onEvaluate}
        onSelectEvent={onSelectEvent}
        onChallenge={onChallenge}
      />
    );

    expect(screen.getByText('Lateral Movement via In-Memory Token Theft')).toBeInTheDocument();
    expect(screen.getByText('supported')).toBeInTheDocument();
    const evt1005Chips = screen.getAllByText('EVT-1005');
    expect(evt1005Chips.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Engine: gemma-4-26b-a4b-it')).toBeInTheDocument();

    // Clicking an evidence citation triggers onSelectEvent
    fireEvent.click(evt1005Chips[0]);
    expect(onSelectEvent).toHaveBeenCalledWith('EVT-1005');
  });

  it('renders fallback badge when deterministic fallback is source', () => {
    const fallbackData = {
      ...mockHypothesesData,
      source: 'deterministic_fallback',
      model_name: 'deterministic_rule_engine'
    };

    render(
      <HypothesesView
        hypothesesData={fallbackData}
        isLoading={false}
        error={null}
        onEvaluate={vi.fn()}
        onSelectEvent={vi.fn()}
        onChallenge={vi.fn()}
      />
    );

    expect(screen.getByText('Engine: deterministic_fallback')).toBeInTheDocument();
  });

  it('filters hypotheses by status tabs and renders empty evidence indicator', () => {
    render(
      <HypothesesView
        hypothesesData={mockHypothesesData}
        isLoading={false}
        error={null}
        onEvaluate={vi.fn()}
        onSelectEvent={vi.fn()}
        onChallenge={vi.fn()}
      />
    );

    // Initial renders both hypotheses
    expect(screen.getByText('Lateral Movement via In-Memory Token Theft')).toBeInTheDocument();
    expect(screen.getByText('Authorized Administrative Maintenance')).toBeInTheDocument();

    // Filter to disputed
    const disputedFilterBtn = screen.getByRole('button', { name: /Disputed \(1\)/i });
    fireEvent.click(disputedFilterBtn);

    // Only hyp-002 should remain
    expect(screen.queryByText('Lateral Movement via In-Memory Token Theft')).not.toBeInTheDocument();
    expect(screen.getByText('Authorized Administrative Maintenance')).toBeInTheDocument();
    expect(screen.getByText('None cited in scenario')).toBeInTheDocument();
  });

  it('submits a challenge and renders forensic reassessment output', async () => {
    const mockChallenge = vi.fn().mockResolvedValue({
      reassessment: 'Reassessment confirms anomaly does not match routine schedule.',
      updated_status: 'disputed',
      evidence_cited: ['EVT-1005'],
    });

    render(
      <HypothesesView
        hypothesesData={mockHypothesesData}
        isLoading={false}
        error={null}
        onEvaluate={vi.fn()}
        onSelectEvent={vi.fn()}
        onChallenge={mockChallenge}
      />
    );

    const inputs = screen.getAllByPlaceholderText(/Enter an investigator objection/i);
    fireEvent.change(inputs[0], { target: { value: 'Could this be an approved backup job?' } });

    const submitBtns = screen.getAllByRole('button', { name: /Submit/i });
    await act(async () => {
      fireEvent.click(submitBtns[0]);
    });

    expect(mockChallenge).toHaveBeenCalledWith('hyp-001', 'Could this be an approved backup job?');
    expect(await screen.findByText('Gemma 4 Forensic Reassessment:')).toBeInTheDocument();
    expect(screen.getByText(/Reassessment confirms anomaly does not match routine schedule/i)).toBeInTheDocument();
  });
});