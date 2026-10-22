import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScorecardView from '../components/ScorecardView';

describe('ScorecardView Component', () => {
  const mockScorecardData = {
    scenario_id: 'test-scenario',
    audit_status: 'PASSED_AUDIT',
    metrics: {
      citation_validity_ratio: 1.0,
      evidence_support_ratio: 0.95,
      unsupported_claim_count: 0,
      critical_milestone_coverage: 0.85,
      contradiction_awareness_score: 1.0,
      uncertainty_calibration_score: 0.9,
      counterfactual_consistency_score: 1.0,
      ground_truth_alignment_score: 0.88,
      reproducibility_score: 1.0,
      overall_audit_score: 92.4,
    },
    metric_provenance: {
      citation_validity_ratio: 'deterministic',
      evidence_support_ratio: 'deterministic',
      unsupported_claim_count: 'rule_based',
      critical_milestone_coverage: 'deterministic',
      contradiction_awareness_score: 'rule_based',
      uncertainty_calibration_score: 'rule_based',
      counterfactual_consistency_score: 'deterministic',
      ground_truth_alignment_score: 'ground_truth_benchmark',
      reproducibility_score: 'deterministic',
      overall_audit_score: 'rule_based',
    },
    findings: [
      {
        id: 'find-001',
        category: 'Citation Validity',
        severity: 'pass',
        message: 'All cited event references resolve to valid scenario events.',
        actionable_guidance: 'No action required.',
        metric_type: 'deterministic',
        cited_references: []
      },
      {
        id: 'find-002',
        category: 'Evidence Support',
        severity: 'warning',
        message: 'Event EVT-1002 has weak downstream linkage.',
        actionable_guidance: 'Review observable network logs.',
        metric_type: 'rule_based',
        cited_references: ['EVT-1002']
      }
    ],
    hypotheses_evaluated_count: 2,
    counterfactuals_evaluated_count: 1,
    critical_failures_count: 0,
    warnings_count: 1,
    summary: 'Audit passed with 92.4 score.'
  };

  it('renders initial CTA when no scorecardData is present', () => {
    const onRefresh = vi.fn();
    render(
      <ScorecardView
        scorecardData={null}
        isLoading={false}
        error={null}
        onRefreshScorecard={onRefresh}
        onSelectEvent={vi.fn()}
      />
    );

    expect(screen.getByText('Investigation Reliability Scorecard')).toBeInTheDocument();
    const btn = screen.getByText('Generate Evaluation Scorecard');
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders overall score, metric cards, and provenance badges', () => {
    render(
      <ScorecardView
        scorecardData={mockScorecardData}
        isLoading={false}
        error={null}
        onRefreshScorecard={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    // Score & Status
    expect(screen.getByText('92.4')).toBeInTheDocument();
    expect(screen.getByText('Audit Passed')).toBeInTheDocument();

    // Metric titles
    expect(screen.getAllByText('Citation Validity').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Evidence Support').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ground Truth Benchmark')).toBeInTheDocument();


    // Provenance classification tags
    expect(screen.getAllByText('Deterministic').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Rule-Based').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Isolated Benchmark').length).toBeGreaterThanOrEqual(1);
  });

  it('filters findings and triggers onSelectEvent on citation click', () => {
    const onSelectEvent = vi.fn();
    render(
      <ScorecardView
        scorecardData={mockScorecardData}
        isLoading={false}
        error={null}
        onRefreshScorecard={vi.fn()}
        onSelectEvent={onSelectEvent}
      />
    );

    // Initial list has both findings
    expect(screen.getByText('All cited event references resolve to valid scenario events.')).toBeInTheDocument();
    expect(screen.getByText('Event EVT-1002 has weak downstream linkage.')).toBeInTheDocument();

    // Filter by WARNING
    fireEvent.click(screen.getByText('WARNING'));
    expect(screen.queryByText('All cited event references resolve to valid scenario events.')).not.toBeInTheDocument();
    expect(screen.getByText('Event EVT-1002 has weak downstream linkage.')).toBeInTheDocument();

    // Click cited reference
    fireEvent.click(screen.getByText('EVT-1002'));
    expect(onSelectEvent).toHaveBeenCalledWith('EVT-1002');
  });
});
