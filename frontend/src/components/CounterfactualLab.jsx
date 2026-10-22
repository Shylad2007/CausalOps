import React, { useState } from 'react';
import {
  GitFork,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Link2Off,
  Zap,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  ChevronDown,
  HelpCircle,
  Activity,
  FileCode,
  Check
} from 'lucide-react';
import { runCounterfactual } from '../api/client';
import { useInvestigationStore } from '../store/investigationStore';

export default function CounterfactualLab({ scenario, onSelectEvent }) {
  const {
    counterfactualResult,
    setCounterfactualResult,
    isExecutingMutation,
    setIsExecutingMutation,
    counterfactualError,
    setCounterfactualError,
    clearCounterfactual,
  } = useInvestigationStore();

  const events = scenario?.events || [];

  const [selectedTargetEventId, setSelectedTargetEventId] = useState(
    events[4]?.id || events[0]?.id || 'EVT-1005'
  );
  const [mutationType, setMutationType] = useState('REMOVE_EVENT'); // 'REMOVE_EVENT' | 'MODIFY_EVENT_FIELD'
  const [fieldPath, setFieldPath] = useState('session_id');
  const [newValue, setNewValue] = useState('tok-invalidated-by-secops');
  const [includeAi, setIncludeAi] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const selectedEventObj = events.find((e) => e.id === selectedTargetEventId);

  const handleRunExperiment = async (overrideMutation = null) => {
    setIsExecutingMutation(true);
    setCounterfactualError(null);

    const mutation = overrideMutation || {
      mutation_type: mutationType,
      target_event_id: selectedTargetEventId,
      ...(mutationType === 'MODIFY_EVENT_FIELD'
        ? { field_path: fieldPath, new_value: newValue }
        : {}),
    };

    try {
      const result = await runCounterfactual(scenario.id, mutation, includeAi);
      setCounterfactualResult(result);
    } catch (err) {
      setCounterfactualError(err.message || 'Counterfactual experiment failed.');
    } finally {
      setIsExecutingMutation(false);
    }
  };

  const handleApplyPreset = (presetType) => {
    if (presetType === 'remove_stage1') {
      setSelectedTargetEventId('EVT-1005');
      setMutationType('REMOVE_EVENT');
      handleRunExperiment({
        mutation_type: 'REMOVE_EVENT',
        target_event_id: 'EVT-1005',
      });
    } else if (presetType === 'mutate_token') {
      setSelectedTargetEventId('EVT-1007');
      setMutationType('MODIFY_EVENT_FIELD');
      setFieldPath('extracted_token');
      setNewValue('tok-corrupted-revoked-signature');
      handleRunExperiment({
        mutation_type: 'MODIFY_EVENT_FIELD',
        target_event_id: 'EVT-1007',
        field_path: 'extracted_token',
        new_value: 'tok-corrupted-revoked-signature',
      });
    } else if (presetType === 'remove_lsass') {
      setSelectedTargetEventId('EVT-1006');
      setMutationType('REMOVE_EVENT');
      handleRunExperiment({
        mutation_type: 'REMOVE_EVENT',
        target_event_id: 'EVT-1006',
      });
    }
  };

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
        
        {/* ── Header Card ──────────────────────────────────────────────── */}
        <div className="nd-surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 'var(--nd-radius-md)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: 'var(--nd-accent)',
                flexShrink: 0,
              }}>
                <GitFork style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 'var(--nd-text-lg)', fontWeight: 700, color: 'var(--nd-text-primary)', margin: 0 }}>
                    Counterfactual Investigation Lab
                  </h2>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--nd-accent)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 'var(--nd-radius-xs)',
                    padding: '1px 6px',
                  }}>
                    DAG MUTATION ENGINE
                  </span>
                </div>
                <p className="nd-caption" style={{ margin: '4px 0 0' }}>
                  Simulate security interventions, eliminate pivot points, and observe mathematically proven graph recomputations versus AI-generated causal interpretation.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {counterfactualResult && (
                <button
                  onClick={clearCounterfactual}
                  className="nd-btn nd-btn-ghost nd-btn-sm"
                  title="Reset modified scenario and return to baseline"
                >
                  <RotateCcw style={{ width: 13, height: 13 }} />
                  <span>Reset to Baseline</span>
                </button>
              )}
              <button
                onClick={() => setShowGuide(!showGuide)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  color: showGuide ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Toggle developer guide"
              >
                <HelpCircle style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {/* Collapsible Developer Guide */}
          {showGuide && (
            <div style={{
              borderRadius: 'var(--nd-radius-md)',
              backgroundColor: 'var(--nd-bg-base)',
              border: '1px solid var(--nd-border-subtle)',
              padding: 12,
              fontSize: 'var(--nd-text-xs)',
              color: 'var(--nd-text-secondary)',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <strong style={{ color: 'var(--nd-text-primary)' }}>How Counterfactual Analysis Works:</strong>
              <div>
                1. <strong>Baseline Scenario:</strong> Represents observed facts recorded from codebase analysis or telemetry.
              </div>
              <div>
                2. <strong>Hypothetical Intervention:</strong> You remove an event (e.g. firewall block) or mutate a field (e.g. token revocation).
              </div>
              <div>
                3. <strong>Deterministic Recomputation:</strong> NetworkX recalculates the causal DAG. Any edges depending on the altered step are mathematically severed.
              </div>
              <div>
                4. <strong>Gemma 4 Reassessment:</strong> Evaluates whether the attacker could bypass the block via alternative paths.
              </div>
            </div>
          )}

          {/* Quick Intervention Presets */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            paddingTop: 12,
            borderTop: '1px solid var(--nd-border-subtle)',
            fontSize: 'var(--nd-text-xs)',
          }}>
            <span className="nd-label" style={{ fontSize: 10 }}>Quick Intervention Presets:</span>
            <button
              onClick={() => handleApplyPreset('remove_stage1')}
              disabled={isExecutingMutation}
              className="nd-btn nd-btn-ghost nd-btn-sm"
              style={{ color: 'var(--nd-critical)' }}
            >
              1. Block Payload Download (EVT-1005)
            </button>
            <button
              onClick={() => handleApplyPreset('remove_lsass')}
              disabled={isExecutingMutation}
              className="nd-btn nd-btn-ghost nd-btn-sm"
              style={{ color: 'var(--nd-medium)' }}
            >
              2. Neutralize LSASS Dump (EVT-1006)
            </button>
            <button
              onClick={() => handleApplyPreset('mutate_token')}
              disabled={isExecutingMutation}
              className="nd-btn nd-btn-ghost nd-btn-sm"
              style={{ color: 'var(--nd-accent)' }}
            >
              3. Revoke Extracted Bearer Token (EVT-1007)
            </button>
          </div>
        </div>

        {/* ── Experiment Controls Configurator ─────────────────────────── */}
        <div className="nd-surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--nd-border-subtle)', flexWrap: 'wrap', gap: 8 }}>
            <span className="nd-label" style={{ color: 'var(--nd-text-primary)', fontSize: 11 }}>
              Configure Scenario Intervention
            </span>
            <span className="nd-caption">
              Deterministic Isolated Clone • Baseline scenario remains immutable
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Target Event Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="nd-label" style={{ fontSize: 10 }}>Target Telemetry Event</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedTargetEventId}
                  onChange={(e) => setSelectedTargetEventId(e.target.value)}
                  className="nd-input"
                  style={{ appearance: 'none', paddingRight: 32 }}
                >
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id} style={{ backgroundColor: 'var(--nd-bg-surface)', color: 'var(--nd-text-primary)' }}>
                      {evt.id} — [{evt.event_type}] {evt.summary?.substring(0, 45)}...
                    </option>
                  ))}
                </select>
                <ChevronDown style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--nd-text-muted)', pointerEvents: 'none' }} />
              </div>
              {selectedEventObj && (
                <p className="nd-caption" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Host: <span style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-code)' }}>{selectedEventObj.source_entity_id}</span> | Time: {selectedEventObj.timestamp}
                </p>
              )}
            </div>

            {/* Mutation Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="nd-label" style={{ fontSize: 10 }}>Intervention Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setMutationType('REMOVE_EVENT')}
                  className={mutationType === 'REMOVE_EVENT' ? 'nd-btn nd-btn-primary nd-btn-sm' : 'nd-btn nd-btn-ghost nd-btn-sm'}
                  style={mutationType === 'REMOVE_EVENT' ? { backgroundColor: 'var(--nd-critical)', borderColor: 'var(--nd-critical)' } : {}}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                  <span>Remove Event</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMutationType('MODIFY_EVENT_FIELD')}
                  className={mutationType === 'MODIFY_EVENT_FIELD' ? 'nd-btn nd-btn-primary nd-btn-sm' : 'nd-btn nd-btn-ghost nd-btn-sm'}
                >
                  <Edit3 style={{ width: 13, height: 13 }} />
                  <span>Mutate Field</span>
                </button>
              </div>
              <p className="nd-caption" style={{ margin: 0 }}>
                {mutationType === 'REMOVE_EVENT'
                  ? 'Simulate preventative defense dropping this specific event.'
                  : 'Mutate observable credentials, session keys, or parameters.'}
              </p>
            </div>

            {/* Additional parameters if modifying field */}
            {mutationType === 'MODIFY_EVENT_FIELD' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label className="nd-label" style={{ fontSize: 9 }}>Field Path</label>
                    <input
                      type="text"
                      value={fieldPath}
                      onChange={(e) => setFieldPath(e.target.value)}
                      placeholder="e.g. session_id"
                      className="nd-input"
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label className="nd-label" style={{ fontSize: 9 }}>New Value</label>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. revoked_val"
                      className="nd-input"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-subtle)',
                backgroundColor: 'var(--nd-bg-base)',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                justifyContent: 'center',
              }}>
                <span className="nd-label" style={{ fontSize: 10 }}>Intervention Objective:</span>
                <span className="nd-caption">
                  Assess if removing {selectedTargetEventId} breaks causal propagation to subsequent network/database attacks.
                </span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 14,
            borderTop: '1px solid var(--nd-border-subtle)',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--nd-text-xs)', color: 'var(--nd-text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeAi}
                onChange={(e) => setIncludeAi(e.target.checked)}
                style={{ accentColor: 'var(--nd-accent)' }}
              />
              <span>Include Gemma 4 Counterfactual Reassessment (AI-generated interpretation)</span>
            </label>

            <button
              onClick={() => handleRunExperiment()}
              disabled={isExecutingMutation}
              className="nd-btn nd-btn-primary nd-btn-sm"
            >
              {isExecutingMutation ? (
                <>
                  <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" />
                  <span>Executing Graph Recomputation...</span>
                </>
              ) : (
                <>
                  <Zap style={{ width: 13, height: 13 }} />
                  <span>Run Counterfactual Experiment</span>
                </>
              )}
            </button>
          </div>

          {counterfactualError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: 12, borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-critical-border)', backgroundColor: 'var(--nd-critical-bg)',
              color: 'var(--nd-critical)', fontSize: 'var(--nd-text-xs)',
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{counterfactualError}</span>
            </div>
          )}
        </div>

        {/* ── Experiment Results View ──────────────────────────────────── */}
        {counterfactualResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Deterministic Metrics Card */}
            <div className="nd-surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--nd-border-subtle)', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
                  <span className="nd-label" style={{ color: 'var(--nd-text-primary)', fontSize: 11 }}>
                    Deterministic Recomputation Summary (NetworkX Engine)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="nd-badge nd-badge-info" style={{ fontFamily: 'var(--nd-font-mono)' }}>
                    100% Deterministic DAG
                  </span>
                  <span className="nd-badge nd-badge-neutral" style={{ fontFamily: 'var(--nd-font-mono)' }}>
                    ID: {counterfactualResult.experiment_id}
                  </span>
                </div>
              </div>

              {/* 4 Stats Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div className="nd-surface" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="nd-label" style={{ fontSize: 10 }}>Events (Base vs Mod)</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-secondary)' }}>
                      {counterfactualResult.baseline_event_count}
                    </span>
                    <ArrowRight style={{ width: 12, height: 12, color: 'var(--nd-text-muted)' }} />
                    <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                      {counterfactualResult.modified_event_count}
                    </span>
                  </div>
                </div>

                <div className="nd-surface" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="nd-label" style={{ fontSize: 10 }}>Causal Edges (Base vs Mod)</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-secondary)' }}>
                      {counterfactualResult.baseline_edge_count}
                    </span>
                    <ArrowRight style={{ width: 12, height: 12, color: 'var(--nd-text-muted)' }} />
                    <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-accent)' }}>
                      {counterfactualResult.modified_edge_count}
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
                  <span className="nd-label" style={{ color: 'var(--nd-critical)', fontSize: 10 }}>Causal Edges Severed</span>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-critical)' }}>
                    {counterfactualResult.edges_removed?.length || 0}
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
                  <span className="nd-label" style={{ color: 'var(--nd-medium)', fontSize: 10 }}>Broken Causal Paths</span>
                  <span style={{ fontSize: 'var(--nd-text-xl)', fontWeight: 700, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-medium)' }}>
                    {counterfactualResult.broken_causal_chains?.length || 0}
                  </span>
                </div>
              </div>

              {/* Severed Edges Table */}
              {counterfactualResult.edges_removed?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-critical)' }}>
                    <Link2Off style={{ width: 14, height: 14 }} />
                    <span>Severed Causal Edges (Mathematically Eliminated)</span>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: 'var(--nd-radius-md)', border: '1px solid var(--nd-border-default)' }}>
                    <table className="nd-table">
                      <thead>
                        <tr>
                          <th>Source Event</th>
                          <th>Target Event</th>
                          <th>Relationship Type</th>
                          <th>Rule Provenance</th>
                          <th>Causal Severance Rationale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {counterfactualResult.edges_removed.map((edge, idx) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-code)' }}>
                              <button
                                onClick={() => onSelectEvent?.(edge.source_event_id)}
                                style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                                title={`Inspect ${edge.source_event_id}`}
                              >
                                {edge.source_event_id}
                              </button>
                            </td>
                            <td style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-critical)' }}>
                              <button
                                onClick={() => onSelectEvent?.(edge.target_event_id)}
                                style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                                title={`Inspect ${edge.target_event_id}`}
                              >
                                {edge.target_event_id}
                              </button>
                            </td>
                            <td style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}>
                              {edge.relationship_type}
                            </td>
                            <td style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}>
                              {edge.rule_name}
                            </td>
                            <td style={{ fontSize: 11 }}>
                              {edge.explanation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Broken Causal Chains / Downstream Impact */}
              {counterfactualResult.broken_causal_chains?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-medium)' }}>
                    <AlertTriangle style={{ width: 14, height: 14 }} />
                    <span>Downstream Impact &amp; Orphaned Chains</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {counterfactualResult.broken_causal_chains.map((chain, cIdx) => (
                      <div
                        key={cIdx}
                        style={{
                          borderRadius: 'var(--nd-radius-md)',
                          border: '1px solid var(--nd-medium-border)',
                          backgroundColor: 'var(--nd-medium-bg)',
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          fontSize: 'var(--nd-text-xs)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'var(--nd-font-mono)', fontWeight: 600, color: 'var(--nd-medium)' }}>
                            Severed Link: {chain.removed_edge?.source} → {chain.removed_edge?.target}
                          </span>
                          <span className="nd-caption" style={{ color: 'var(--nd-medium)' }}>
                            {chain.downstream_events_disconnected?.length || 0} downstream event(s) isolated
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--nd-text-primary)' }}>{chain.explanation}</p>
                        {chain.downstream_events_disconnected?.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                            <span className="nd-label" style={{ fontSize: 9 }}>
                              Disconnected Nodes:
                            </span>
                            {chain.downstream_events_disconnected.map((dNode) => (
                              <button
                                key={dNode}
                                onClick={() => onSelectEvent?.(dNode)}
                                className="nd-badge nd-badge-medium"
                                style={{ cursor: 'pointer', fontFamily: 'var(--nd-font-mono)' }}
                                title={`Inspect disconnected event ${dNode}`}
                              >
                                {dNode}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Gemma 4 AI Reassessment Card (Clearly Separated) */}
            {counterfactualResult.hypothesis_impact && (
              <div className="nd-surface-elevated" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--nd-border-subtle)', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
                      <h3 style={{ fontSize: 'var(--nd-text-sm)', fontWeight: 700, color: 'var(--nd-text-primary)', margin: 0 }}>
                        Gemma 4 Counterfactual Hypothesis Reassessment
                      </h3>
                      <span className="nd-badge nd-badge-info" style={{ fontFamily: 'var(--nd-font-mono)' }}>
                        {counterfactualResult.hypothesis_impact.source}
                      </span>
                    </div>
                    <p className="nd-caption" style={{ margin: '4px 0 0' }}>
                      AI-assisted counterfactual reasoning evaluating whether the adversary's objective remains viable under this intervention.
                    </p>
                  </div>

                  {/* Explicit AI Disclaimer Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 'var(--nd-radius-md)',
                    border: '1px solid var(--nd-medium-border)',
                    backgroundColor: 'var(--nd-medium-bg)',
                    color: 'var(--nd-medium)',
                    fontSize: 11,
                    fontWeight: 500,
                  }}>
                    <Info style={{ width: 13, height: 13, flexShrink: 0 }} />
                    <span>AI Interpretation — Not a Deterministic Certainty</span>
                  </div>
                </div>

                {/* Reassessment Narrative */}
                <div style={{
                  borderRadius: 'var(--nd-radius-md)',
                  border: '1px solid var(--nd-info-border)',
                  backgroundColor: 'var(--nd-info-bg)',
                  padding: 14,
                  fontSize: 'var(--nd-text-xs)',
                  color: 'var(--nd-text-primary)',
                  lineHeight: 'var(--nd-leading-base)',
                }}>
                  <p className="nd-label" style={{ color: 'var(--nd-info)', margin: '0 0 4px' }}>Analytical Evaluation:</p>
                  <p style={{ margin: 0 }}>{counterfactualResult.hypothesis_impact.reassessment}</p>
                </div>

                {/* Impacted Hypotheses Grid */}
                {counterfactualResult.hypothesis_impact.affected_hypotheses?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span className="nd-label" style={{ fontSize: 10 }}>
                      Impact on Competing Hypotheses:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                      {counterfactualResult.hypothesis_impact.affected_hypotheses.map((hyp, hIdx) => {
                        const statusBadgeConfig = {
                          refuted: 'nd-badge nd-badge-critical',
                          weakened: 'nd-badge nd-badge-medium',
                          strengthened: 'nd-badge nd-badge-low',
                          unaffected: 'nd-badge nd-badge-neutral',
                        };
                        const badgeCls = statusBadgeConfig[hyp.status] || 'nd-badge nd-badge-neutral';

                        return (
                          <div
                            key={hIdx}
                            className="nd-surface"
                            style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--nd-text-xs)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--nd-font-mono)' }}>{hyp.hypothesis_id}</span>
                              <span className={badgeCls} style={{ fontSize: 9 }}>
                                Status: {hyp.status}
                              </span>
                            </div>
                            <p className="nd-caption" style={{ margin: 0 }}>{hyp.impact_summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Unsupported Citations Audit */}
                {counterfactualResult.hypothesis_impact.unsupported_citations?.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: 12, borderRadius: 'var(--nd-radius-md)',
                    border: '1px solid var(--nd-critical-border)', backgroundColor: 'var(--nd-critical-bg)',
                    color: 'var(--nd-critical)', fontSize: 'var(--nd-text-xs)',
                  }}>
                    <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span>
                      Audit Warning: Model cited invalid or nonexistent event references:{' '}
                      {counterfactualResult.hypothesis_impact.unsupported_citations.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}