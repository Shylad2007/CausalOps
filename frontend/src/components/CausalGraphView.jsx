import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitCommit, 
  ArrowRight, 
  ShieldAlert, 
  HelpCircle, 
  CheckCircle, 
  Info, 
  Maximize2, 
  Search, 
  Filter, 
  Layers, 
  Network, 
  Share2, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Wrench,
  Sparkles,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  GitPullRequest,
  Check,
  Cpu,
  Database
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';

const RULE_BADGE_STYLE = {
  RuleProcessLineage: {
    color: 'var(--nd-medium)',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
  },
  RuleSessionContinuity: {
    color: 'var(--nd-success)',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  RuleNetworkDispatch: {
    color: 'var(--nd-accent)',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
};

export default function CausalGraphView({
  graphData,
  selectedEventId,
  onSelectEvent,
}) {
  const navigate = useNavigate();
  const { codebaseScanResult, activeFindingId, setActiveFindingId } = useInvestigationStore();
  const [subView, setSubView] = useState('dag'); // 'dag' | 'evidence_flow'
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const findings = codebaseScanResult?.findings || [];
  const activeFinding = findings.find((f) => f.id === activeFindingId) || findings[0] || null;

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Compute upstream causes and downstream effects for selected node
  const { upstreamIds, downstreamIds, nodeInDegree, nodeOutDegree } = useMemo(() => {
    const up = new Set();
    const down = new Set();
    const inDeg = {};
    const outDeg = {};

    edges.forEach((e) => {
      outDeg[e.source] = (outDeg[e.source] || 0) + 1;
      inDeg[e.target] = (inDeg[e.target] || 0) + 1;

      if (selectedEventId) {
        if (e.target === selectedEventId) up.add(e.source);
        if (e.source === selectedEventId) down.add(e.target);
      }
    });

    return { upstreamIds: up, downstreamIds: down, nodeInDegree: inDeg, nodeOutDegree: outDeg };
  }, [selectedEventId, edges]);

  // Filter nodes by severity and search
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (severityFilter !== 'all' && n.severity?.toLowerCase() !== severityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = n.id?.toLowerCase().includes(q);
        const matchesType = n.event_type?.toLowerCase().includes(q);
        const matchesSummary = n.summary?.toLowerCase().includes(q);
        const matchesHost = n.source_entity_id?.toLowerCase().includes(q);
        if (!matchesId && !matchesType && !matchesSummary && !matchesHost) {
          return false;
        }
      }
      return true;
    });
  }, [nodes, severityFilter, searchQuery]);

  if (!graphData && findings.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--nd-text-muted)',
        fontSize: 'var(--nd-text-sm)',
        gap: 12,
      }}>
        <Network style={{ width: 32, height: 32, color: 'var(--nd-accent)' }} />
        <span>Loading deterministic causal graph...</span>
      </div>
    );
  }

  const rootCauses = graphData?.metrics?.root_cause_candidates || [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: 'var(--nd-bg-base)',
      overflow: 'hidden',
    }}>
      {/* ── Top Meta & View Switcher Toolbar ─────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        borderBottom: '1px solid var(--nd-border-default)',
        backgroundColor: 'var(--nd-bg-surface)',
        padding: '10px 18px',
        flexShrink: 0,
      }}>
        {/* Left: Summary Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--nd-text-sm)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>
            <Network style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
            <span>Deterministic DAG</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="nd-badge nd-badge-info" style={{ fontFamily: 'var(--nd-font-mono)' }}>
              {nodes.length} Nodes
            </span>
            <span className="nd-badge nd-badge-neutral" style={{ fontFamily: 'var(--nd-font-mono)' }}>
              {edges.length} Causal Edges
            </span>
            {rootCauses.length > 0 && (
              <span className="nd-badge nd-badge-critical" style={{ fontFamily: 'var(--nd-font-mono)' }}>
                Root: {rootCauses.join(', ')}
              </span>
            )}
          </div>

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: 'var(--nd-success)',
            fontFamily: 'var(--nd-font-mono)',
          }}>
            <CheckCircle2 style={{ width: 12, height: 12 }} />
            100% Deterministic Provenance
          </span>
        </div>

        {/* Right: Sub-View Switcher & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 2D Sub-View Switcher: DAG vs Evidence Flow */}
          {findings.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--nd-bg-elevated)',
              border: '1px solid var(--nd-border-default)',
              borderRadius: 'var(--nd-radius-md)',
              padding: 2,
              gap: 2,
            }}>
              <button
                onClick={() => setSubView('dag')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 9px',
                  borderRadius: 'calc(var(--nd-radius-md) - 2px)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: subView === 'dag' ? 'var(--nd-bg-surface)' : 'transparent',
                  color: subView === 'dag' ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                  boxShadow: subView === 'dag' ? 'var(--nd-shadow-sm)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <GitCommit style={{ width: 12, height: 12 }} />
                <span>DAG View</span>
              </button>
              <button
                onClick={() => setSubView('evidence_flow')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 9px',
                  borderRadius: 'calc(var(--nd-radius-md) - 2px)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: subView === 'evidence_flow' ? 'var(--nd-bg-surface)' : 'transparent',
                  color: subView === 'evidence_flow' ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                  boxShadow: subView === 'evidence_flow' ? 'var(--nd-shadow-sm)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <Layers style={{ width: 12, height: 12 }} />
                <span>6-Stage Evidence Flow</span>
              </button>
            </div>
          )}

          {subView === 'dag' && (
            <>
              {/* Search Box */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search style={{
                  position: 'absolute',
                  left: 8,
                  width: 13,
                  height: 13,
                  color: 'var(--nd-text-muted)',
                  pointerEvents: 'none',
                }} />
                <input
                  type="text"
                  placeholder="Search nodes, hosts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    backgroundColor: 'var(--nd-bg-elevated)',
                    border: '1px solid var(--nd-border-default)',
                    borderRadius: 'var(--nd-radius-md)',
                    padding: '4px 8px 4px 26px',
                    fontSize: 12,
                    color: 'var(--nd-text-primary)',
                    width: 160,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Severity Filters */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--nd-bg-elevated)',
                border: '1px solid var(--nd-border-default)',
                borderRadius: 'var(--nd-radius-md)',
                padding: 2,
                gap: 2,
              }}>
                {['all', 'critical', 'high', 'medium'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    style={{
                      background: severityFilter === sev ? 'var(--nd-bg-surface)' : 'transparent',
                      color: severityFilter === sev ? 'var(--nd-text-primary)' : 'var(--nd-text-muted)',
                      border: 'none',
                      borderRadius: 'calc(var(--nd-radius-md) - 2px)',
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      boxShadow: severityFilter === sev ? 'var(--nd-shadow-sm)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Main Scrollable Body ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── MODE 1: 6-Stage Vulnerability Investigation & Evidence Flow ─ */}
        {subView === 'evidence_flow' && activeFinding && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Finding Selector Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-border-default)',
              backgroundColor: 'var(--nd-bg-surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)' }}>
                  Selected Finding:
                </span>
                <select
                  value={activeFinding.id}
                  onChange={(e) => setActiveFindingId(e.target.value)}
                  style={{
                    backgroundColor: 'var(--nd-bg-elevated)',
                    border: '1px solid var(--nd-border-default)',
                    borderRadius: 'var(--nd-radius-sm)',
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--nd-text-primary)',
                    outline: 'none',
                  }}
                >
                  {findings.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.severity?.toUpperCase() || 'CRITICAL'}] {f.id} - {f.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => navigate('/dashboard/fixes')}
                className="nd-btn nd-btn-primary nd-btn-sm"
              >
                <Wrench style={{ width: 13, height: 13 }} />
                <span>Open in Remediation</span>
              </button>
            </div>

            {/* 6-Stage Evidence Pipeline DAG */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
              position: 'relative',
            }}>
              {/* Stage 1: Detected Finding */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-surface)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 700,
                    color: 'var(--nd-accent)',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    padding: '2px 6px',
                    borderRadius: 'var(--nd-radius-xs)',
                  }}>
                    STAGE 1: DETECTED FINDING
                  </span>
                  <span className={`nd-badge ${
                    activeFinding.severity === 'critical' ? 'nd-badge-critical' :
                    activeFinding.severity === 'high' ? 'nd-badge-high' : 'nd-badge-medium'
                  }`}>
                    {activeFinding.severity}
                  </span>
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--nd-text-primary)', margin: '0 0 4px 0' }}>
                    {activeFinding.title}
                  </h4>
                  <div style={{ fontSize: 11, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-secondary)' }}>
                    {activeFinding.file_path}:{activeFinding.line_start}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-muted)', marginTop: 2 }}>
                    CWE: {activeFinding.cwe_id || 'CWE-89'} • Rule: {activeFinding.rule_id}
                  </div>
                </div>
              </div>

              {/* Stage 2: Root-Cause AST Evidence */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-surface)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 700,
                    color: '#c084fc',
                    backgroundColor: 'rgba(192,132,252,0.1)',
                    padding: '2px 6px',
                    borderRadius: 'var(--nd-radius-xs)',
                  }}>
                    STAGE 2: ROOT-CAUSE AST EVIDENCE
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-muted)' }}>
                    Source-to-Sink
                  </span>
                </div>
                <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--nd-text-secondary)' }}>
                  <div>
                    <span style={{ color: 'var(--nd-text-muted)' }}>Source: </span>
                    <code style={{ color: 'var(--nd-accent)', fontFamily: 'var(--nd-font-mono)' }}>
                      {activeFinding.source_sink_trace?.source_expression || 'untrusted_request_parameter'}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--nd-text-muted)' }}>Execution Sink: </span>
                    <code style={{ color: 'var(--nd-critical)', fontFamily: 'var(--nd-font-mono)' }}>
                      {activeFinding.source_sink_trace?.sink_expression || activeFinding.code_snippet?.slice(0, 32) || 'database.execute(query)'}
                    </code>
                  </div>
                  {activeFinding.code_snippet && (
                    <pre style={{
                      backgroundColor: 'var(--nd-bg-base)',
                      border: '1px solid var(--nd-border-subtle)',
                      borderRadius: 'var(--nd-radius-xs)',
                      padding: 6,
                      fontSize: 10,
                      fontFamily: 'var(--nd-font-mono)',
                      color: 'var(--nd-text-code)',
                      overflowX: 'auto',
                      margin: 0,
                    }}>
                      {activeFinding.code_snippet}
                    </pre>
                  )}
                </div>
              </div>

              {/* Stage 3: AI Remediation Proposal */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-surface)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 700,
                    color: 'var(--nd-medium)',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    padding: '2px 6px',
                    borderRadius: 'var(--nd-radius-xs)',
                  }}>
                    STAGE 3: REMEDIATION PROPOSAL
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--nd-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}>
                    <Sparkles style={{ width: 11, height: 11 }} />
                    Gemma 4
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.4 }}>
                  <p style={{ margin: '0 0 6px 0' }}>
                    {activeFinding.remediation_guidance || 'Replace string interpolation with parameterized queries to prevent SQL injection.'}
                  </p>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--nd-radius-xs)',
                    backgroundColor: 'var(--nd-bg-base)',
                    border: '1px solid var(--nd-border-subtle)',
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    color: 'var(--nd-text-muted)',
                  }}>
                    Patch Status: <strong style={{ color: 'var(--nd-text-primary)' }}>{activeFinding.finding_status || 'PROPOSAL READY'}</strong>
                  </div>
                </div>
              </div>

              {/* Stage 4: Developer Review */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-surface)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 700,
                    color: 'var(--nd-accent)',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    padding: '2px 6px',
                    borderRadius: 'var(--nd-radius-xs)',
                  }}>
                    STAGE 4: DEVELOPER REVIEW
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 600,
                    color: activeFinding.finding_status === 'VERIFIED_FIXED' ? 'var(--nd-success)' : 'var(--nd-medium)',
                  }}>
                    {activeFinding.finding_status === 'VERIFIED_FIXED' ? 'APPROVED' : 'INSPECTION'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.4 }}>
                  <p style={{ margin: 0 }}>
                    Human-in-the-loop review verifies code intent, syntax compatibility, and prevents regressions prior to merging.
                  </p>
                  <div style={{
                    marginTop: 8,
                    padding: '4px 8px',
                    borderRadius: 'var(--nd-radius-xs)',
                    backgroundColor: 'var(--nd-bg-base)',
                    border: '1px solid var(--nd-border-subtle)',
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    color: 'var(--nd-text-muted)',
                  }}>
                    Review Checkpoint: <strong style={{ color: 'var(--nd-text-primary)' }}>Developer Authorization</strong>
                  </div>
                </div>
              </div>

              {/* Stage 5: Independent Verification */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-surface)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 700,
                    color: 'var(--nd-success)',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    padding: '2px 6px',
                    borderRadius: 'var(--nd-radius-xs)',
                  }}>
                    STAGE 5: INDEPENDENT VERIFICATION
                  </span>
                  <ShieldCheck style={{ width: 14, height: 14, color: 'var(--nd-success)' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.4 }}>
                  <p style={{ margin: '0 0 6px 0' }}>
                    Deterministic AST parser recompiles patched module and verifies elimination of tainted data flow without introducing new findings.
                  </p>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--nd-radius-xs)',
                    backgroundColor: 'var(--nd-bg-base)',
                    border: '1px solid var(--nd-border-subtle)',
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    color: activeFinding.finding_status === 'VERIFIED_FIXED' ? 'var(--nd-success)' : 'var(--nd-text-muted)',
                  }}>
                    Tri-State Engine: <strong>{activeFinding.finding_status === 'VERIFIED_FIXED' ? 'VERIFIED' : 'PENDING APPLICATION'}</strong>
                  </div>
                </div>
              </div>

              {/* Stage 6: Final Outcome */}
              <div style={{
                borderRadius: 'var(--nd-radius-md)',
                border: activeFinding.finding_status === 'VERIFIED_FIXED' ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--nd-border-default)',
                backgroundColor: activeFinding.finding_status === 'VERIFIED_FIXED' ? 'rgba(16,185,129,0.06)' : 'var(--nd-bg-surface)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 700,
                    color: activeFinding.finding_status === 'VERIFIED_FIXED' ? 'var(--nd-success)' : 'var(--nd-text-muted)',
                    backgroundColor: activeFinding.finding_status === 'VERIFIED_FIXED' ? 'rgba(16,185,129,0.15)' : 'var(--nd-bg-elevated)',
                    padding: '2px 6px',
                    borderRadius: 'var(--nd-radius-xs)',
                  }}>
                    STAGE 6: FINAL OUTCOME
                  </span>
                  <span className={`nd-badge ${activeFinding.finding_status === 'VERIFIED_FIXED' ? 'nd-badge-low' : 'nd-badge-neutral'}`}>
                    {activeFinding.finding_status === 'VERIFIED_FIXED' ? 'VERIFIED FIXED' : 'OPEN'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.4 }}>
                  <p style={{ margin: '0 0 6px 0' }}>
                    {activeFinding.finding_status === 'VERIFIED_FIXED'
                      ? 'Vulnerability eradicated. 3D attack path has been severed and marked verified.'
                      : 'Vulnerability is currently open. Generate and verify patch in Remediation.'}
                  </p>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--nd-radius-xs)',
                    backgroundColor: 'var(--nd-bg-base)',
                    border: '1px solid var(--nd-border-subtle)',
                    fontSize: 10,
                    fontFamily: 'var(--nd-font-mono)',
                    color: activeFinding.finding_status === 'VERIFIED_FIXED' ? 'var(--nd-success)' : 'var(--nd-critical)',
                  }}>
                    Topography: <strong>{activeFinding.finding_status === 'VERIFIED_FIXED' ? 'SEVERED (✓ FIXED)' : 'ACTIVE PATH'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODE 2: Deterministic Causal DAG (Always rendered when in DAG mode) ── */}
        {subView === 'dag' && (
          <>
            {/* Quick Banner to Discover 6-Stage Evidence Flow if findings exist */}
            {activeFinding && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--nd-radius-md)',
                backgroundColor: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.2)',
                fontSize: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info style={{ width: 14, height: 14, color: 'var(--nd-accent)' }} />
                  <span style={{ color: 'var(--nd-text-secondary)' }}>
                    Deep vulnerability investigation flow available for <strong style={{ color: 'var(--nd-text-primary)' }}>{activeFinding.id} ({activeFinding.title})</strong>.
                  </span>
                </div>
                <button
                  onClick={() => setSubView('evidence_flow')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--nd-accent)',
                    fontWeight: 600,
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>Open 6-Stage Evidence Flow</span>
                  <ArrowRight style={{ width: 12, height: 12 }} />
                </button>
              </div>
            )}

            {/* Section: Causal Node Sequence */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nd-text-muted)' }}>
                  Causal DAG Nodes ({filteredNodes.length}{filteredNodes.length !== nodes.length ? ` of ${nodes.length}` : ''})
                </span>
                <span style={{ fontSize: 11, color: 'var(--nd-text-secondary)' }}>
                  Click any node to select and inspect observable evidence
                </span>
              </div>

              {filteredNodes.length === 0 ? (
                <div style={{
                  padding: 32,
                  textAlign: 'center',
                  backgroundColor: 'var(--nd-bg-surface)',
                  borderRadius: 'var(--nd-radius-md)',
                  border: '1px solid var(--nd-border-default)',
                  color: 'var(--nd-text-muted)',
                  fontSize: 12,
                }}>
                  No nodes match the selected filter or search query.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                  gap: 12,
                }}>
                  {filteredNodes.map((node, index) => {
                    const isSelected = selectedEventId === node.id;
                    const isUpstream = upstreamIds.has(node.id);
                    const isDownstream = downstreamIds.has(node.id);
                    const isRoot = rootCauses.includes(node.id);

                    let cardBorder = '1px solid var(--nd-border-default)';
                    let cardBg = 'var(--nd-bg-surface)';
                    let shadow = 'none';

                    if (isSelected) {
                      cardBorder = '1px solid var(--nd-accent)';
                      cardBg = 'rgba(59, 130, 246, 0.08)';
                      shadow = '0 0 0 2px rgba(59, 130, 246, 0.25)';
                    } else if (isUpstream) {
                      cardBorder = '1px solid var(--nd-medium)';
                      cardBg = 'rgba(245, 158, 11, 0.06)';
                    } else if (isDownstream) {
                      cardBorder = '1px solid #c084fc';
                      cardBg = 'rgba(168, 85, 247, 0.06)';
                    }

                    return (
                      <div
                        key={node.id}
                        onClick={() => onSelectEvent(node.id)}
                        style={{
                          borderRadius: 'var(--nd-radius-md)',
                          border: cardBorder,
                          backgroundColor: cardBg,
                          padding: 14,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease-in-out',
                          boxShadow: shadow,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = 'var(--nd-border-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = isUpstream ? 'var(--nd-medium)' : isDownstream ? '#c084fc' : 'var(--nd-border-default)';
                        }}
                      >
                        {/* Top Row: Event ID & Severity */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontFamily: 'var(--nd-font-mono)',
                              fontSize: 10,
                              color: 'var(--nd-text-muted)',
                              padding: '1px 5px',
                              borderRadius: 'var(--nd-radius-xs)',
                              backgroundColor: 'var(--nd-bg-base)',
                              border: '1px solid var(--nd-border-subtle)',
                            }}>
                              #{index + 1}
                            </span>
                            <span style={{
                              fontFamily: 'var(--nd-font-mono)',
                              fontSize: 12,
                              fontWeight: 700,
                              color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text-primary)',
                            }}>
                              {node.id}
                            </span>
                            <span style={{
                              fontSize: 10,
                              color: 'var(--nd-text-muted)',
                              fontFamily: 'var(--nd-font-mono)',
                            }}>
                              [{node.event_type}]
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isRoot && (
                              <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                padding: '1px 5px',
                                borderRadius: 'var(--nd-radius-xs)',
                                backgroundColor: 'rgba(239,68,68,0.15)',
                                color: 'var(--nd-critical)',
                                border: '1px solid rgba(239,68,68,0.3)',
                              }}>
                                ROOT
                              </span>
                            )}
                            <span className={`nd-badge ${
                              node.severity === 'critical' ? 'nd-badge-critical' :
                              node.severity === 'high' ? 'nd-badge-high' :
                              node.severity === 'medium' ? 'nd-badge-medium' :
                              'nd-badge-neutral'
                            }`}>
                              {node.severity}
                            </span>
                          </div>
                        </div>

                        {/* Summary */}
                        <p style={{
                          fontSize: 12,
                          color: 'var(--nd-text-secondary)',
                          lineHeight: 'var(--nd-leading-base)',
                          margin: 0,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {node.summary}
                        </p>

                        {/* Footer Info & Relationship Badges */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid var(--nd-border-subtle)',
                          paddingTop: 8,
                          marginTop: 2,
                          fontSize: 10,
                          fontFamily: 'var(--nd-font-mono)',
                          color: 'var(--nd-text-muted)',
                        }}>
                          <span>Host: <strong style={{ color: 'var(--nd-text-primary)' }}>{node.source_entity_id}</strong></span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isSelected && (
                              <span style={{ fontWeight: 700, color: 'var(--nd-accent)' }}>
                                SELECTED
                              </span>
                            )}
                            {isUpstream && (
                              <span style={{ fontWeight: 700, color: 'var(--nd-medium)' }}>
                                ← CAUSE
                              </span>
                            )}
                            {isDownstream && (
                              <span style={{ fontWeight: 700, color: '#c084fc' }}>
                                → EFFECT
                              </span>
                            )}
                            {!isSelected && !isUpstream && !isDownstream && (
                              <span>
                                in:{nodeInDegree[node.id] || 0} out:{nodeOutDegree[node.id] || 0}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section: Deterministic Provenance Edges Table */}
            <div style={{
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-border-default)',
              backgroundColor: 'var(--nd-bg-surface)',
              padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nd-text-primary)', margin: 0 }}>
                    Deterministic Causal Links &amp; Provenance Explanations
                  </h4>
                  <p style={{ fontSize: 11, color: 'var(--nd-text-muted)', margin: '2px 0 0 0' }}>
                    Every causal link is verified by explicit rule engines without probabilistic hallucination.
                  </p>
                </div>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--nd-font-mono)',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--nd-radius-xs)',
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: 'var(--nd-success)',
                }}>
                  Deterministic Rule Engine
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {edges.map((edge) => {
                  const ruleStyle = RULE_BADGE_STYLE[edge.rule_name] || {
                    color: 'var(--nd-text-secondary)',
                    background: 'var(--nd-bg-elevated)',
                    border: '1px solid var(--nd-border-subtle)',
                  };
                  const isRelevant = edge.source === selectedEventId || edge.target === selectedEventId;

                  return (
                    <div
                      key={edge.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--nd-radius-sm)',
                        backgroundColor: isRelevant ? 'rgba(59, 130, 246, 0.08)' : 'var(--nd-bg-base)',
                        border: isRelevant ? '1px solid var(--nd-accent)' : '1px solid var(--nd-border-subtle)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 16,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                        {/* Link flow representation */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => onSelectEvent(edge.source)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              fontFamily: 'var(--nd-font-mono)',
                              fontWeight: 700,
                              color: edge.source === selectedEventId ? 'var(--nd-accent)' : 'var(--nd-text-primary)',
                              fontSize: 12,
                            }}
                            title={`Select ${edge.source}`}
                          >
                            {edge.source}
                          </button>

                          <ArrowRight style={{ width: 13, height: 13, color: 'var(--nd-text-muted)' }} />

                          <button
                            onClick={() => onSelectEvent(edge.target)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              fontFamily: 'var(--nd-font-mono)',
                              fontWeight: 700,
                              color: edge.target === selectedEventId ? 'var(--nd-accent)' : 'var(--nd-text-primary)',
                              fontSize: 12,
                            }}
                            title={`Select ${edge.target}`}
                          >
                            {edge.target}
                          </button>

                          <span style={{
                            fontSize: 10,
                            fontFamily: 'var(--nd-font-mono)',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 'var(--nd-radius-xs)',
                            ...ruleStyle,
                          }}>
                            {edge.rule_name}
                          </span>

                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 'var(--nd-radius-xs)',
                            backgroundColor: 'var(--nd-bg-elevated)',
                            color: 'var(--nd-text-muted)',
                          }}>
                            {edge.provenance}
                          </span>

                          {isRelevant && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: 'var(--nd-accent)',
                              padding: '1px 5px',
                              borderRadius: 'var(--nd-radius-xs)',
                              backgroundColor: 'rgba(59,130,246,0.15)',
                            }}>
                              Selected Link
                            </span>
                          )}
                        </div>

                        {/* Explanation */}
                        <p style={{
                          fontSize: 12,
                          color: 'var(--nd-text-secondary)',
                          lineHeight: 'var(--nd-leading-base)',
                          margin: '2px 0 0 0',
                        }}>
                          {edge.explanation}
                        </p>
                      </div>

                      {/* Confidence */}
                      <div style={{
                        fontSize: 11,
                        fontFamily: 'var(--nd-font-mono)',
                        color: 'var(--nd-success)',
                        fontWeight: 600,
                        flexShrink: 0,
                        textAlign: 'right',
                      }}>
                        100% Deterministic
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
