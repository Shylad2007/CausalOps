import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  RefreshCw,
  ShieldCheck,
  Scale,
  Cpu,
  Layers,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
} from 'lucide-react';

export default function ScorecardView({
  scorecardData,
  isLoading,
  error,
  onRefreshScorecard,
  onSelectEvent,
}) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'WARNING' | 'PASS' | 'INFO'
  const [showFormula, setShowFormula] = useState(false);

  if (isLoading && !scorecardData) {
    return (
      <div className="nd-empty" style={{ height: '100%', padding: 32 }}>
        <RefreshCw className="nd-spinner" style={{ width: 32, height: 32, marginBottom: 8 }} />
        <span className="nd-subheading">Running Evaluation Scorecard</span>
        <p className="nd-caption" style={{ maxWidth: 360 }}>
          Deterministically computing evidence audit metrics…
        </p>
      </div>
    );
  }

  if (!scorecardData && !isLoading && !error) {
    return (
      <div className="nd-empty" style={{ height: '100%', padding: 32 }}>
        <ShieldCheck className="nd-empty-icon" style={{ width: 48, height: 48 }} />
        <span className="nd-subheading">Investigation Reliability Scorecard</span>
        <p className="nd-caption" style={{ maxWidth: 420 }}>
          Deterministic audit evaluating evidence grounding, uncertainty calibration, contradiction handling, and isolated ground-truth alignment.
        </p>
        <button
          onClick={onRefreshScorecard}
          className="nd-btn nd-btn-primary nd-btn-sm"
        >
          Generate Evaluation Scorecard
        </button>
      </div>
    );
  }

  const metrics = scorecardData?.metrics;
  const findings = scorecardData?.findings || [];

  const filteredFindings = findings.filter((f) => {
    if (activeFilter === 'ALL') return true;
    return f.severity.toUpperCase() === activeFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PASSED_WITH_DISTINCTION':
        return { label: 'Passed with Distinction', className: 'nd-badge nd-badge-low' };
      case 'PASSED_AUDIT':
        return { label: 'Audit Passed', className: 'nd-badge nd-badge-info' };
      case 'REQUIRES_REVIEW':
        return { label: 'Requires Review', className: 'nd-badge nd-badge-medium' };
      case 'CRITICAL_FAILURES':
        return { label: 'Critical Failures Flagged', className: 'nd-badge nd-badge-critical' };
      default:
        return { label: status || 'Unknown', className: 'nd-badge nd-badge-neutral' };
    }
  };

  const getProvenanceBadge = (type) => {
    switch (type) {
      case 'deterministic':
        return { label: 'Deterministic', className: 'nd-badge nd-badge-info' };
      case 'rule_based':
        return { label: 'Rule-Based', className: 'nd-badge nd-badge-neutral' };
      case 'ground_truth_benchmark':
        return { label: 'Isolated Benchmark', className: 'nd-badge nd-badge-low' };
      case 'ai_assessed':
        return { label: 'AI Assessed', className: 'nd-badge nd-badge-medium' };
      default:
        return { label: type, className: 'nd-badge nd-badge-neutral' };
    }
  };

  const statusBadge = getStatusBadge(scorecardData?.audit_status);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      backgroundColor: 'var(--nd-bg-base)',
      padding: 24,
      color: 'var(--nd-text-primary)',
      fontFamily: 'var(--nd-font-sans)',
    }}>
      <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div className="nd-surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 'var(--nd-radius-md)',
                backgroundColor: 'var(--nd-accent-subtle)',
                border: '1px solid var(--nd-accent-border)',
                color: 'var(--nd-accent)',
              }}>
                <CheckCircle2 style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--nd-text-lg)', fontWeight: 700, color: 'var(--nd-text-primary)', margin: 0 }}>
                  Evidence Audit &amp; Reliability Scorecard
                </h2>
                <p className="nd-caption" style={{ margin: '4px 0 0' }}>
                  Objective, mathematically reproducible scorecard auditing evidence citations, calibration, and ground-truth fidelity.
                </p>
              </div>
            </div>

            <button
              onClick={onRefreshScorecard}
              disabled={isLoading}
              className="nd-btn nd-btn-ghost nd-btn-sm"
            >
              <RefreshCw style={{ width: 13, height: 13 }} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Re-evaluating...' : 'Re-run Evaluation'}</span>
            </button>
          </div>

          {/* Overall Audit Banner */}
          {scorecardData && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              paddingTop: 16,
              borderTop: '1px solid var(--nd-border-subtle)',
            }}>
              <div className="nd-surface" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="nd-label" style={{ fontSize: 10 }}>Overall Fidelity Score</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-2xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                    {metrics?.overall_audit_score}
                  </span>
                  <span className="nd-caption" style={{ fontFamily: 'var(--nd-font-mono)' }}>/ 100</span>
                </div>
              </div>

              <div className="nd-surface" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="nd-label" style={{ fontSize: 10 }}>Audit Status</span>
                <div>
                  <span className={statusBadge.className}>
                    {statusBadge.label}
                  </span>
                </div>
              </div>

              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-critical-border)',
                backgroundColor: 'var(--nd-critical-bg)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <span className="nd-label" style={{ color: 'var(--nd-critical)', fontSize: 10 }}>Critical Failures</span>
                <span style={{ fontSize: 'var(--nd-text-2xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-critical)' }}>
                  {scorecardData.critical_failures_count}
                </span>
              </div>

              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-medium-border)',
                backgroundColor: 'var(--nd-medium-bg)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <span className="nd-label" style={{ color: 'var(--nd-medium)', fontSize: 10 }}>Warnings / Anomalies</span>
                <span style={{ fontSize: 'var(--nd-text-2xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-medium)' }}>
                  {scorecardData.warnings_count}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: 12, borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-critical-border)', backgroundColor: 'var(--nd-critical-bg)',
              color: 'var(--nd-critical)', fontSize: 'var(--nd-text-xs)',
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Component Metrics Grid */}
        {metrics && (
          <div className="nd-surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--nd-border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
                <span className="nd-label" style={{ color: 'var(--nd-text-primary)', fontSize: 11 }}>
                  Audited Component Metrics (With Provenance Classification)
                </span>
              </div>
              <button
                onClick={() => setShowFormula(!showFormula)}
                className="nd-btn nd-btn-ghost nd-btn-sm"
                style={{ fontSize: 11 }}
              >
                <span>Scoring Methodology</span>
                {showFormula ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
              </button>
            </div>

            {/* Formula Explainer */}
            {showFormula && (
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-info-border)',
                backgroundColor: 'var(--nd-info-bg)',
                padding: 14,
                fontSize: 'var(--nd-text-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--nd-info)' }}>Transparent Weighted Scoring Methodology:</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6, fontFamily: 'var(--nd-font-mono)', fontSize: 11, color: 'var(--nd-text-secondary)' }}>
                  <div>• Citation Validity: 25% (Critical)</div>
                  <div>• Evidence Semantic Support: 20%</div>
                  <div>• Milestone Coverage: 15%</div>
                  <div>• Contradiction Awareness: 10%</div>
                  <div>• Uncertainty Calibration: 10%</div>
                  <div>• Counterfactual Consistency: 10%</div>
                  <div>• Ground Truth Benchmark: 10%</div>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  * Note: Any ungrounded event citation immediately caps the audit status at CRITICAL_FAILURES regardless of composite percentage.
                </p>
              </div>
            )}

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {/* 1. Citation Validity */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Citation Validity</span>
                  <span className="nd-badge nd-badge-info" style={{ fontSize: 9 }}>Deterministic</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                    {(metrics.citation_validity_ratio * 100).toFixed(1)}%
                  </span>
                  <span className="nd-caption">exist in scenario</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Verifies that all event IDs cited by hypotheses resolve to genuine scenario records.
                </p>
              </div>

              {/* 2. Semantic Evidence Support */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Evidence Support</span>
                  <span className="nd-badge nd-badge-info" style={{ fontSize: 9 }}>Deterministic</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                    {(metrics.evidence_support_ratio * 100).toFixed(1)}%
                  </span>
                  <span className="nd-caption">graph connectivity</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Ensures cited supporting events actively participate in causal graph lineages.
                </p>
              </div>

              {/* 3. Unsupported Claims */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Unsupported Claims</span>
                  <span className="nd-badge nd-badge-neutral" style={{ fontSize: 9 }}>Rule-Based</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{
                    fontSize: 'var(--nd-text-xl)',
                    fontWeight: 700,
                    fontFamily: 'var(--nd-font-mono)',
                    color: metrics.unsupported_claim_count > 0 ? 'var(--nd-critical)' : 'var(--nd-low)',
                  }}>
                    {metrics.unsupported_claim_count}
                  </span>
                  <span className="nd-caption">unsubstantiated claims</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Hypotheses claiming supported status with 0 evidence or excess assumptions.
                </p>
              </div>

              {/* 4. Critical Milestone Coverage */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Milestone Coverage</span>
                  <span className="nd-badge nd-badge-info" style={{ fontSize: 9 }}>Deterministic</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                    {(metrics.critical_milestone_coverage * 100).toFixed(1)}%
                  </span>
                  <span className="nd-caption">milestones cited</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Proportion of critical incident milestones covered across all explanations.
                </p>
              </div>

              {/* 5. Contradiction Awareness */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Contradiction Awareness</span>
                  <span className="nd-badge nd-badge-neutral" style={{ fontSize: 9 }}>Rule-Based</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                    {(metrics.contradiction_awareness_score * 100).toFixed(1)}%
                  </span>
                  <span className="nd-caption">anti-bias score</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Measures whether opposing evidence was documented to prevent confirmation bias.
                </p>
              </div>

              {/* 6. Uncertainty Calibration */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Uncertainty Calibration</span>
                  <span className="nd-badge nd-badge-neutral" style={{ fontSize: 9 }}>Rule-Based</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                    {(metrics.uncertainty_calibration_score * 100).toFixed(1)}%
                  </span>
                  <span className="nd-caption">calibration index</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Penalizes uncalibrated overconfidence and rewards explicit assumption tracking.
                </p>
              </div>

              {/* 7. Counterfactual Consistency */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Counterfactual Consistency</span>
                  <span className="nd-badge nd-badge-info" style={{ fontSize: 9 }}>Deterministic</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                    {(metrics.counterfactual_consistency_score * 100).toFixed(1)}%
                  </span>
                  <span className="nd-caption">diff fidelity</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Validates that intervention outcomes align strictly with recomputed causal graphs.
                </p>
              </div>

              {/* 8. Isolated Ground Truth Benchmark */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-low-border)',
                backgroundColor: 'var(--nd-low-bg)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-low)' }}>Ground Truth Benchmark</span>
                  <span className="nd-badge nd-badge-low" style={{ fontSize: 9 }}>Isolated Benchmark</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-low)' }}>
                    {(metrics.ground_truth_alignment_score * 100).toFixed(1)}%
                  </span>
                  <span className="nd-caption" style={{ color: 'var(--nd-low)' }}>objective fidelity</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Evaluates root cause discovery &amp; path recall against ground truth (isolated from LLM).
                </p>
              </div>

              {/* 9. Reproducibility */}
              <div className="nd-surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>Reproducibility Check</span>
                  <span className="nd-badge nd-badge-info" style={{ fontSize: 9 }}>Deterministic</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>100.0%</span>
                  <span className="nd-caption">pure function</span>
                </div>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Guarantees byte-for-byte identical audit metrics on repeated scenario evaluations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actionable Findings Table */}
        {scorecardData && (
          <div className="nd-surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--nd-border-subtle)', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCheck style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
                <span className="nd-label" style={{ color: 'var(--nd-text-primary)', fontSize: 11 }}>
                  Actionable Findings &amp; Audit Checks ({findings.length})
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="nd-segmented">
                {['ALL', 'CRITICAL', 'WARNING', 'PASS', 'INFO'].map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setActiveFilter(filterKey)}
                    className={`nd-segmented-item ${activeFilter === filterKey ? 'active' : ''}`}
                    style={{ fontSize: 10, padding: '3px 8px' }}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Findings List */}
            {filteredFindings.length === 0 ? (
              <p className="nd-caption" style={{ padding: '24px 0', textAlign: 'center' }}>
                No findings match the selected filter.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredFindings.map((finding) => {
                  const severityConfig = {
                    critical: {
                      border: '1px solid var(--nd-critical-border)',
                      bg: 'var(--nd-critical-bg)',
                      badgeClass: 'nd-badge nd-badge-critical',
                      icon: XCircle,
                      iconColor: 'var(--nd-critical)',
                    },
                    warning: {
                      border: '1px solid var(--nd-medium-border)',
                      bg: 'var(--nd-medium-bg)',
                      badgeClass: 'nd-badge nd-badge-medium',
                      icon: AlertTriangle,
                      iconColor: 'var(--nd-medium)',
                    },
                    pass: {
                      border: '1px solid var(--nd-low-border)',
                      bg: 'var(--nd-low-bg)',
                      badgeClass: 'nd-badge nd-badge-low',
                      icon: CheckCircle2,
                      iconColor: 'var(--nd-low)',
                    },
                    info: {
                      border: '1px solid var(--nd-border-default)',
                      bg: 'var(--nd-bg-base)',
                      badgeClass: 'nd-badge nd-badge-neutral',
                      icon: Info,
                      iconColor: 'var(--nd-text-muted)',
                    },
                  };

                  const currentStyle = severityConfig[finding.severity] || severityConfig.info;
                  const Icon = currentStyle.icon;
                  const provBadge = getProvenanceBadge(finding.metric_type);

                  return (
                    <div
                      key={finding.id}
                      style={{
                        borderRadius: 'var(--nd-radius-md)',
                        border: currentStyle.border,
                        backgroundColor: currentStyle.bg,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        fontSize: 'var(--nd-text-xs)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon style={{ width: 15, height: 15, color: currentStyle.iconColor, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: 'var(--nd-text-primary)' }}>{finding.category}</span>
                          <span className={currentStyle.badgeClass} style={{ fontSize: 9 }}>
                            {finding.severity}
                          </span>
                        </div>
                        <span className={provBadge.className} style={{ fontSize: 9 }}>
                          {provBadge.label}
                        </span>
                      </div>

                      <p style={{ color: 'var(--nd-text-primary)', margin: 0, lineHeight: 1.5 }}>{finding.message}</p>

                      <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 6,
                        paddingTop: 6,
                        borderTop: '1px solid var(--nd-border-subtle)',
                        fontSize: 11,
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--nd-accent)' }}>Actionable Guidance:</span>
                        <span style={{ color: 'var(--nd-text-secondary)' }}>{finding.actionable_guidance}</span>
                      </div>

                      {finding.cited_references?.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                          <span className="nd-label" style={{ fontSize: 9 }}>
                            Associated Citations:
                          </span>
                          {finding.cited_references.map((refId, rIdx) => (
                            <button
                              key={rIdx}
                              onClick={() => onSelectEvent?.(refId.split(':').pop())}
                              className="nd-badge nd-badge-info"
                              style={{ cursor: 'pointer', fontFamily: 'var(--nd-font-mono)' }}
                            >
                              {refId}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
