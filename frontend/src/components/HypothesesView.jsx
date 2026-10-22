import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Sparkles, 
  RefreshCw, 
  HelpCircle, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  Send, 
  MessageSquare, 
  Cpu, 
  ChevronDown, 
  ChevronRight,
  GitBranch,
  Layers,
  Scale,
  Search,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

const STATUS_CONFIG = {
  supported: { badge: 'nd-badge nd-badge-low', label: 'SUPPORTED', color: 'var(--nd-success)' },
  disputed: { badge: 'nd-badge nd-badge-medium', label: 'DISPUTED', color: 'var(--nd-medium)' },
  unresolved: { badge: 'nd-badge nd-badge-neutral', label: 'UNRESOLVED', color: 'var(--nd-text-muted)' },
  rejected: { badge: 'nd-badge nd-badge-critical', label: 'REJECTED', color: 'var(--nd-critical)' },
};

export default function HypothesesView({
  hypothesesData,
  isLoading,
  error,
  onEvaluate,
  onSelectEvent,
  onChallenge,
}) {
  const [challengeInputs, setChallengeInputs] = useState({});
  const [challengeResults, setChallengeResults] = useState({});
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState({});
  const [showExplainer, setShowExplainer] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'supported' | 'disputed' | 'unresolved'

  const hypotheses = hypothesesData?.hypotheses || [];
  const source = hypothesesData?.source || 'uninitialized';
  const modelName = hypothesesData?.model_name || '';

  const handleChallengeSubmit = async (hypId) => {
    const text = challengeInputs[hypId];
    if (!text || !text.trim()) return;

    setIsSubmittingChallenge((prev) => ({ ...prev, [hypId]: true }));
    try {
      const res = await onChallenge(hypId, text);
      setChallengeResults((prev) => ({ ...prev, [hypId]: res }));
    } catch (err) {
      console.error('Challenge failed:', err);
    } finally {
      setIsSubmittingChallenge((prev) => ({ ...prev, [hypId]: false }));
    }
  };

  const filteredHypotheses = hypotheses.filter((h) => {
    if (filterMode === 'all') return true;
    return h.investigation_status === filterMode;
  });

  const supportedCount = hypotheses.filter((h) => h.investigation_status === 'supported').length;
  const disputedCount = hypotheses.filter((h) => h.investigation_status === 'disputed').length;
  const unresolvedCount = hypotheses.filter((h) => h.investigation_status === 'unresolved').length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: 'var(--nd-bg-base)',
      overflow: 'hidden',
    }}>
      {/* ── Top Controller Bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--nd-border-default)',
        backgroundColor: 'var(--nd-bg-surface)',
        flexShrink: 0,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--nd-radius-md)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--nd-accent)',
            flexShrink: 0,
          }}>
            <Scale style={{ width: 16, height: 16 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--nd-text-base)', fontWeight: 700, color: 'var(--nd-text-primary)' }}>
                Competing Hypotheses &amp; Forensic Reasoning
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--nd-text-secondary)' }}>
              Evaluated with <span style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-code)', fontWeight: 600 }}>{modelName || 'Gemma 4'}</span> · Evidence-Grounded Citations
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Source Tag Badge */}
          {source !== 'uninitialized' && (
            <span
              title={source.includes('gemma') ? 'Gemma 4 Live AI Inference' : 'Deterministic fallback mode'}
              className={source.includes('gemma') ? 'nd-badge nd-badge-info' : 'nd-badge nd-badge-medium'}
              style={{ fontFamily: 'var(--nd-font-mono)' }}
            >
              Engine: {source}
            </span>
          )}

          <button
            onClick={onEvaluate}
            disabled={isLoading}
            className="nd-btn nd-btn-primary nd-btn-sm"
          >
            <Sparkles style={{ width: 13, height: 13 }} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Reasoning with Gemma 4...' : 'Evaluate Hypotheses'}</span>
          </button>
        </div>
      </div>

      {/* ── Fallback Mode Warning ── */}
      {source === 'deterministic_fallback' && (
        <div style={{
          backgroundColor: 'var(--nd-medium-bg)',
          borderBottom: '1px solid var(--nd-medium-border)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          fontSize: 'var(--nd-text-xs)',
          color: 'var(--nd-medium)',
          flexShrink: 0,
        }}>
          <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontWeight: 600, margin: 0 }}>⚠ Fallback Mode — Gemma 4 is not configured (no GEMMA_API_KEY).</p>
            <p style={{ margin: 0, opacity: 0.9 }}>
              These hypotheses are <strong>deterministic rule-based templates</strong>, NOT AI-generated analysis.
              Configure <code className="nd-code">GEMMA_API_KEY</code> in <code className="nd-code">backend/.env</code> to enable live Gemma 4 reasoning.
            </p>
          </div>
        </div>
      )}

      {/* ── Live AI Badge ── */}
      {source === 'gemma-4-26b-a4b-it' && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 'var(--nd-text-xs)',
          color: 'var(--nd-success)',
          flexShrink: 0,
        }}>
          <Sparkles style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>LIVE AI REASONING ACTIVE</span>
          <span style={{ opacity: 0.9 }}>— Hypotheses formulated by Gemma 4 ({modelName}) with strict citation grounding.</span>
        </div>
      )}

      {/* ── Audit Warnings Banner ── */}
      {hypothesesData?.audit_flags?.length > 0 && (
        <div style={{
          backgroundColor: 'var(--nd-medium-bg)',
          borderBottom: '1px solid var(--nd-medium-border)',
          padding: '8px 20px',
          fontSize: 'var(--nd-text-xs)',
          color: 'var(--nd-medium)',
          fontFamily: 'var(--nd-font-mono)',
          maxHeight: 110,
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600 }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
            <span>Citation Audit Flags ({hypothesesData.audit_flags.length})</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {hypothesesData.audit_flags.map((flag, idx) => (
              <li key={idx} style={{ lineHeight: 1.5 }}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Collapsible Developer Explainer ── */}
      <div style={{ borderBottom: '1px solid var(--nd-border-default)', backgroundColor: 'var(--nd-bg-surface)', flexShrink: 0 }}>
        <button
          onClick={() => setShowExplainer((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 20px',
            fontSize: 'var(--nd-text-xs)',
            color: 'var(--nd-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HelpCircle style={{ width: 14, height: 14, color: 'var(--nd-accent)' }} />
            <span style={{ fontWeight: 600, color: 'var(--nd-text-secondary)' }}>
              Developer's Guide: Understanding Competing Hypotheses &amp; Evidence Grounding
            </span>
          </span>
          {showExplainer ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
        </button>
        {showExplainer && (
          <div style={{
            padding: '0 20px 14px',
            fontSize: 'var(--nd-text-xs)',
            color: 'var(--nd-text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            lineHeight: 'var(--nd-leading-base)',
          }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--nd-text-primary)' }}>Why Competing Hypotheses?</strong> Security investigations frequently suffer from confirmation bias—latching onto the first apparent vulnerability without evaluating alternative attack vectors. Competing Hypotheses systematically presents the most plausible primary explanation alongside competing alternatives.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 4 }}>
              <div style={{ padding: 10, borderRadius: 'var(--nd-radius-md)', backgroundColor: 'var(--nd-bg-base)', border: '1px solid var(--nd-border-subtle)' }}>
                <strong style={{ color: 'var(--nd-success)', display: 'block', marginBottom: 2 }}>✓ Supporting Citations</strong>
                Verified scenario telemetry events that confirm steps in the hypothesis chain.
              </div>
              <div style={{ padding: 10, borderRadius: 'var(--nd-radius-md)', backgroundColor: 'var(--nd-bg-base)', border: '1px solid var(--nd-border-subtle)' }}>
                <strong style={{ color: 'var(--nd-critical)', display: 'block', marginBottom: 2 }}>✗ Contradictory Citations</strong>
                Telemetry evidence that conflicts with or disproves this hypothesis.
              </div>
              <div style={{ padding: 10, borderRadius: 'var(--nd-radius-md)', backgroundColor: 'var(--nd-bg-base)', border: '1px solid var(--nd-border-subtle)' }}>
                <strong style={{ color: 'var(--nd-accent)', display: 'block', marginBottom: 2 }}>💬 Interactive Challenge</strong>
                Submit counter-theories (e.g., routine devops task) to trigger dynamic AI reassessment.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Comparison & Filter Summary Bar ── */}
      {hypotheses.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          borderBottom: '1px solid var(--nd-border-subtle)',
          backgroundColor: 'var(--nd-bg-elevated)',
          flexShrink: 0,
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 12,
        }}>
          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--nd-text-muted)' }}>Filter:</span>
            {[
              { id: 'all', label: `All (${hypotheses.length})` },
              { id: 'supported', label: `Supported (${supportedCount})` },
              { id: 'disputed', label: `Disputed (${disputedCount})` },
              { id: 'unresolved', label: `Unresolved (${unresolvedCount})` },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterMode(id)}
                style={{
                  background: filterMode === id ? 'var(--nd-bg-surface)' : 'transparent',
                  color: filterMode === id ? 'var(--nd-text-primary)' : 'var(--nd-text-muted)',
                  border: filterMode === id ? '1px solid var(--nd-border-default)' : '1px solid transparent',
                  borderRadius: 'var(--nd-radius-sm)',
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: filterMode === id ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--nd-text-secondary)' }}>
            <span>Click any event citation badge to inspect telemetry in the Evidence Panel.</span>
          </div>
        </div>
      )}

      {/* ── Main Hypotheses Scroll Area ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {hypotheses.length === 0 && !isLoading && (
          <div className="nd-empty" style={{ height: 260 }}>
            <Cpu className="nd-empty-icon" style={{ width: 40, height: 40 }} />
            <span className="nd-subheading">No Hypotheses Evaluated Yet</span>
            <p className="nd-caption" style={{ maxWidth: 380 }}>
              Click "Evaluate Hypotheses" to invoke Gemma 4's structured forensic reasoner against recorded scenario telemetry.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="nd-empty" style={{ height: 260 }}>
            <RefreshCw className="nd-spinner" style={{ width: 28, height: 28, marginBottom: 8 }} />
            <span className="nd-caption">
              Gemma 4 is synthesizing incident evidence and formulating competing explanations...
            </span>
          </div>
        )}

        {filteredHypotheses.map((hyp, index) => {
          const statusConfig = STATUS_CONFIG[hyp.investigation_status] || STATUS_CONFIG.unresolved;
          const challengeRes = challengeResults[hyp.id];
          const isPrimary = index === 0;

          return (
            <div
              key={hyp.id}
              style={{
                borderRadius: 'var(--nd-radius-md)',
                border: isPrimary ? '1px solid var(--nd-accent)' : '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-surface)',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                boxShadow: isPrimary ? '0 0 16px rgba(59, 130, 246, 0.08)' : 'none',
                position: 'relative',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--nd-font-mono)', fontSize: 'var(--nd-text-xs)' }}>
                    <span style={{
                      fontWeight: 700,
                      color: isPrimary ? 'var(--nd-accent)' : 'var(--nd-text-code)',
                      padding: '1px 6px',
                      borderRadius: 'var(--nd-radius-xs)',
                      backgroundColor: 'var(--nd-bg-base)',
                      border: '1px solid var(--nd-border-subtle)',
                    }}>
                      {hyp.id}
                    </span>
                    <span className={statusConfig.badge}>
                      {hyp.investigation_status}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: isPrimary ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                    }}>
                      {isPrimary ? '★ Primary Hypothesis' : `Alternative Theory #${index + 1}`}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 'var(--nd-text-md)', fontWeight: 700, color: 'var(--nd-text-primary)', margin: '8px 0 0' }}>
                    {hyp.title}
                  </h3>
                </div>

                {/* Engine Provenance Tag */}
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--nd-font-mono)',
                  color: 'var(--nd-text-muted)',
                  backgroundColor: 'var(--nd-bg-base)',
                  border: '1px solid var(--nd-border-subtle)',
                  borderRadius: 'var(--nd-radius-xs)',
                  padding: '2px 8px',
                  flexShrink: 0,
                }}>
                  {source.includes('gemma') ? 'Gemma 4 Reasoning' : 'Deterministic Template'}
                </span>
              </div>

              {/* Description */}
              <p style={{ fontSize: 'var(--nd-text-xs)', color: 'var(--nd-text-secondary)', lineHeight: 'var(--nd-leading-base)', margin: 0 }}>
                {hyp.description}
              </p>

              {/* Support Assessment */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-subtle)',
                backgroundColor: 'var(--nd-bg-base)',
                padding: 12,
                fontSize: 'var(--nd-text-xs)',
              }}>
                <span className="nd-label" style={{ display: 'block', marginBottom: 4, fontSize: 10 }}>
                  Qualitative Support Assessment
                </span>
                <p style={{ color: 'var(--nd-text-primary)', margin: 0, lineHeight: 1.5 }}>
                  {hyp.support_assessment}
                </p>
              </div>

              {/* Evidence Citations: Supporting & Contradicting */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, fontSize: 'var(--nd-text-xs)', fontFamily: 'var(--nd-font-mono)' }}>
                {/* Supporting */}
                <div style={{
                  borderRadius: 'var(--nd-radius-md)',
                  border: '1px solid var(--nd-low-border)',
                  backgroundColor: 'var(--nd-low-bg)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--nd-low)', fontWeight: 600, fontSize: 11 }}>
                    <CheckCircle style={{ width: 14, height: 14 }} />
                    <span>Supporting Evidence ({hyp.supporting_event_ids?.length || 0})</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {hyp.supporting_event_ids?.map((eid) => (
                      <button
                        key={eid}
                        onClick={() => onSelectEvent(eid)}
                        className="nd-badge nd-badge-low"
                        style={{ cursor: 'pointer' }}
                        title={`Inspect telemetry for ${eid}`}
                      >
                        {eid}
                      </button>
                    ))}
                    {(!hyp.supporting_event_ids || hyp.supporting_event_ids.length === 0) && (
                      <span className="nd-caption" style={{ color: 'var(--nd-text-muted)' }}>None cited in scenario</span>
                    )}
                  </div>
                </div>

                {/* Contradicting */}
                <div style={{
                  borderRadius: 'var(--nd-radius-md)',
                  border: '1px solid var(--nd-critical-border)',
                  backgroundColor: 'var(--nd-critical-bg)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--nd-critical)', fontWeight: 600, fontSize: 11 }}>
                    <XCircle style={{ width: 14, height: 14 }} />
                    <span>Contradictory Evidence ({hyp.contradictory_event_ids?.length || 0})</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {hyp.contradictory_event_ids?.map((eid) => (
                      <button
                        key={eid}
                        onClick={() => onSelectEvent(eid)}
                        className="nd-badge nd-badge-critical"
                        style={{ cursor: 'pointer' }}
                        title={`Inspect telemetry for ${eid}`}
                      >
                        {eid}
                      </button>
                    ))}
                    {(!hyp.contradictory_event_ids || hyp.contradictory_event_ids.length === 0) && (
                      <span className="nd-caption" style={{ color: 'var(--nd-text-muted)' }}>None observed in telemetry</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Unsupported Claims Flagged by Audit */}
              {hyp.unsupported_event_ids?.length > 0 && (
                <div style={{
                  borderRadius: 'var(--nd-radius-md)',
                  border: '1px solid var(--nd-critical-border)',
                  backgroundColor: 'var(--nd-critical-bg)',
                  padding: 10,
                  fontSize: 'var(--nd-text-xs)',
                  color: 'var(--nd-critical)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span>
                    Audit Warning: Model cited invalid or nonexistent event IDs: <strong style={{ fontFamily: 'var(--nd-font-mono)' }}>{hyp.unsupported_event_ids.join(', ')}</strong>
                  </span>
                </div>
              )}

              {/* Assumptions & Unresolved Questions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, fontSize: 'var(--nd-text-xs)' }}>
                <div style={{ borderRadius: 'var(--nd-radius-sm)', backgroundColor: 'var(--nd-bg-base)', padding: 10, border: '1px solid var(--nd-border-subtle)' }}>
                  <span className="nd-label" style={{ display: 'block', marginBottom: 4, fontSize: 10 }}>
                    Assumptions
                  </span>
                  <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--nd-text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {hyp.assumptions?.length > 0 ? (
                      hyp.assumptions.map((ass, idx) => <li key={idx}>{ass}</li>)
                    ) : (
                      <li style={{ color: 'var(--nd-text-muted)', listStyle: 'none' }}>No unverified assumptions specified.</li>
                    )}
                  </ul>
                </div>
                <div style={{ borderRadius: 'var(--nd-radius-sm)', backgroundColor: 'var(--nd-bg-base)', padding: 10, border: '1px solid var(--nd-border-subtle)' }}>
                  <span className="nd-label" style={{ display: 'block', marginBottom: 4, fontSize: 10 }}>
                    Unresolved Questions
                  </span>
                  <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--nd-text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {hyp.unresolved_questions?.length > 0 ? (
                      hyp.unresolved_questions.map((uq, idx) => <li key={idx}>{uq}</li>)
                    ) : (
                      <li style={{ color: 'var(--nd-text-muted)', listStyle: 'none' }}>All current questions resolved by telemetry.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Investigator Challenge Box */}
              <div style={{ borderTop: '1px solid var(--nd-border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="nd-label" style={{ color: 'var(--nd-accent)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <MessageSquare style={{ width: 14, height: 14 }} />
                  Challenge this Hypothesis
                </span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={challengeInputs[hyp.id] || ''}
                    onChange={(e) => setChallengeInputs({ ...challengeInputs, [hyp.id]: e.target.value })}
                    placeholder="Enter an investigator objection or alternative theory (e.g., 'Could EVT-1005 be DevOps maintenance?')..."
                    className="nd-input"
                  />
                  <button
                    onClick={() => handleChallengeSubmit(hyp.id)}
                    disabled={isSubmittingChallenge[hyp.id]}
                    className="nd-btn nd-btn-primary nd-btn-sm"
                  >
                    <Send style={{ width: 12, height: 12 }} />
                    <span>{isSubmittingChallenge[hyp.id] ? 'Reassessing...' : 'Submit'}</span>
                  </button>
                </div>

                {/* Challenge Reassessment Output */}
                {challengeRes && (
                  <div style={{
                    borderRadius: 'var(--nd-radius-md)',
                    border: '1px solid var(--nd-info-border)',
                    backgroundColor: 'var(--nd-info-bg)',
                    padding: 12,
                    fontSize: 'var(--nd-text-xs)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: 'var(--nd-info)' }}>Gemma 4 Forensic Reassessment:</span>
                      <span className="nd-caption" style={{ fontFamily: 'var(--nd-font-mono)' }}>
                        Updated Status: <strong style={{ color: 'var(--nd-medium)' }}>{challengeRes.updated_status}</strong>
                      </span>
                    </div>
                    <p style={{ color: 'var(--nd-text-primary)', margin: 0, lineHeight: 1.5 }}>{challengeRes.reassessment}</p>
                    {challengeRes.evidence_cited?.length > 0 && (
                      <div className="nd-caption" style={{ fontFamily: 'var(--nd-font-mono)' }}>
                        Evidence cited: {challengeRes.evidence_cited.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}