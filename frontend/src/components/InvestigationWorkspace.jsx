import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Box,
  Network,
  Info,
  HelpCircle,
  GitBranch,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { simulateProjectIncident, fetchScenarioCausalGraph, fetchCodebaseAttackGraph } from '../api/client';
import CyberWorld from './CyberWorld';
import CausalGraphView from './CausalGraphView';
import EvidenceInspector from './EvidenceInspector';

export default function InvestigationWorkspace() {
  const navigate = useNavigate();
  const {
    activeProjectId,
    codebaseScanResult,
    scenario,
    setScenario,
    isLoadingScenario,
    graphData,
    setGraphData,
    isLoadingGraph,
    setIsLoadingGraph,
    selectedEventId,
    setSelectedEventId,
    selectedEntityId,
    setSelectedEntityId,
    currentTimelineIndex,
    setCurrentTimelineIndex,
    activeFindingId,
    setActiveFindingId,
  } = useInvestigationStore();

  const [viewMode, setViewMode] = useState('3d');
  const [isSimulating, setIsSimulating] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);
  const [attackGraph, setAttackGraph] = useState(null);
  const [isLoadingAttackGraph, setIsLoadingAttackGraph] = useState(false);

  useEffect(() => {
    if (activeProjectId && !graphData && !isLoadingGraph) {
      setIsLoadingGraph(true);
      fetchScenarioCausalGraph(activeProjectId)
        .then((data) => setGraphData(data))
        .catch((err) => console.error('Failed to load causal graph:', err))
        .finally(() => setIsLoadingGraph(false));
    }
  }, [activeProjectId, graphData, isLoadingGraph]);

  useEffect(() => {
    if (activeProjectId && !attackGraph && !isLoadingAttackGraph && typeof fetchCodebaseAttackGraph === 'function') {
      setIsLoadingAttackGraph(true);
      fetchCodebaseAttackGraph(activeProjectId)
        .then((data) => setAttackGraph(data))
        .catch(() => {})
        .finally(() => setIsLoadingAttackGraph(false));
    }
  }, [activeProjectId, attackGraph, isLoadingAttackGraph]);

  const events = scenario?.events || [];
  const scenarioEntities = scenario?.entities || [];
  const attackGraphNodes = attackGraph?.nodes || [];

  const findingsMap = useMemo(() => {
    const map = {};
    (codebaseScanResult?.findings || []).forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [codebaseScanResult?.findings]);

  // Synchronize display entities with latest finding resolution states
  const displayEntities = useMemo(() => {
    const base = scenarioEntities.length > 0 ? scenarioEntities : attackGraphNodes;
    return base.map((ent) => {
      if (ent.finding_id && findingsMap[ent.finding_id]) {
        const finding = findingsMap[ent.finding_id];
        const isFixed = finding.finding_status === 'VERIFIED_FIXED';
        return {
          ...ent,
          isSevered: isFixed,
          severity: finding.severity || ent.severity,
          finding_title: finding.title || ent.finding_title,
        };
      }
      return ent;
    });
  }, [scenarioEntities, attackGraphNodes, findingsMap]);

  const displayLinks = useMemo(() => {
    if (scenarioEntities.length > 0) return null;
    return attackGraph?.edges || null;
  }, [scenarioEntities.length, attackGraph?.edges]);

  const currentEvent = events[currentTimelineIndex] || null;
  const selectedEvent = events.find((e) => e.id === selectedEventId) || currentEvent;
  const selectedEntity = displayEntities.find((ent) => ent.id === selectedEntityId);

  const projectName = codebaseScanResult?.project_name || activeProjectId || 'Unknown Project';
  const findingCount = codebaseScanResult?.findings?.length ?? 0;
  const openCount = codebaseScanResult?.open_findings_count ?? findingCount;
  const lastScan = codebaseScanResult?.scanned_at
    ? new Date(codebaseScanResult.scanned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const handleSimulate = async () => {
    if (!activeProjectId) return;
    setIsSimulating(true);
    try {
      const newScen = await simulateProjectIncident(activeProjectId);
      setScenario(newScen);
      const newGraph = await fetchScenarioCausalGraph(activeProjectId);
      setGraphData(newGraph);
    } catch (err) {
      console.error('Failed to simulate incident:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSelectEntity = (id) => {
    setSelectedEntityId(id);
    setSelectedEventId(null);
    const node = displayEntities.find((e) => e.id === id);
    if (node?.finding_id) {
      setActiveFindingId(node.finding_id);
    }
  };

  if (!codebaseScanResult && !activeProjectId) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--nd-bg-base)',
        padding: 40,
        gap: 20,
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: 'var(--nd-bg-elevated)',
          border: '1px solid var(--nd-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Activity style={{ width: 28, height: 28, color: 'var(--nd-text-muted)' }} />
        </div>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ fontSize: 'var(--nd-text-lg)', fontWeight: 600, color: 'var(--nd-text-primary)', marginBottom: 8 }}>
            No Active Investigation
          </h3>
          <p style={{ fontSize: 'var(--nd-text-sm)', color: 'var(--nd-text-secondary)', lineHeight: 'var(--nd-leading-base)' }}>
            Connect a codebase repository from the Dashboard to investigate its security topology and replay incident events.
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/projects')}
          className="nd-btn nd-btn-primary"
        >
          Go to Projects Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: 'var(--nd-bg-base)' }}>

      {/* ── Investigation Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--nd-border-default)',
        backgroundColor: 'var(--nd-bg-surface)',
        gap: 16,
        flexShrink: 0,
      }}>
        {/* Left: Project identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--nd-radius-md)',
            backgroundColor: 'var(--nd-bg-elevated)',
            border: '1px solid var(--nd-border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <GitBranch style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--nd-text-base)', fontWeight: 700, color: 'var(--nd-text-primary)', whiteSpace: 'nowrap' }}>
                {projectName}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--nd-accent)',
                backgroundColor: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 'var(--nd-radius-xs)',
                padding: '1px 6px',
              }}>
                INVESTIGATION
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3 }}>
              {openCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--nd-critical)', fontFamily: 'var(--nd-font-mono)' }}>
                  <ShieldAlert style={{ width: 11, height: 11 }} />
                  {openCount} open {openCount === 1 ? 'finding' : 'findings'}
                </span>
              )}
              {lastScan && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--nd-text-muted)', fontFamily: 'var(--nd-font-mono)' }}>
                  <Calendar style={{ width: 11, height: 11 }} />
                  Scanned {lastScan}
                </span>
              )}
              {events.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--nd-text-muted)', fontFamily: 'var(--nd-font-mono)' }}>
                  {events.length} timeline events
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* View Mode Segmented */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--nd-bg-base)',
            border: '1px solid var(--nd-border-default)',
            borderRadius: 'var(--nd-radius-md)',
            padding: 3,
            gap: 2,
          }}>
            {[
              { id: '3d', icon: Box, label: '3D World' },
              { id: '2d', icon: Network, label: '2D Causal DAG' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 'calc(var(--nd-radius-md) - 2px)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  transition: 'all 0.15s',
                  backgroundColor: viewMode === id ? 'var(--nd-bg-elevated)' : 'transparent',
                  color: viewMode === id ? 'var(--nd-text-primary)' : 'var(--nd-text-muted)',
                  boxShadow: viewMode === id ? 'var(--nd-shadow-sm)' : 'none',
                }}
              >
                <Icon style={{ width: 12, height: 12 }} />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="nd-btn nd-btn-ghost nd-btn-sm"
            title="Generate or update controlled incident simulation for active project"
          >
            <Sparkles style={{ width: 13, height: 13 }} className={isSimulating ? 'animate-spin' : ''} />
            <span>{isSimulating ? 'Simulating…' : 'Simulate Incident'}</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/hypotheses')}
            className="nd-btn nd-btn-primary nd-btn-sm"
          >
            <span>Next: Hypotheses</span>
            <ArrowRight style={{ width: 12, height: 12 }} />
          </button>

          <button
            onClick={() => setShowGuidance(!showGuidance)}
            style={{
              padding: '5px 6px',
              borderRadius: 'var(--nd-radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: showGuidance ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s',
            }}
            title="Toggle guidance"
          >
            <HelpCircle style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </div>

      {/* ── Guidance Banner ──────────────────────────────────────────────── */}
      {showGuidance && (
        <div style={{
          backgroundColor: 'rgba(59,130,246,0.06)',
          borderBottom: '1px solid rgba(59,130,246,0.18)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
          color: 'var(--nd-text-secondary)',
          flexShrink: 0,
        }}>
          <Info style={{ width: 13, height: 13, color: 'var(--nd-accent)', flexShrink: 0 }} />
          <span>
            <strong style={{ color: 'var(--nd-text-primary)' }}>How to investigate:</strong>{' '}
            Click a node or event to load its evidence in the right panel. Rotate and zoom the 3D topology to trace attack surfaces. Switch to{' '}
            <strong>2D Causal DAG</strong> to inspect deterministic causal links and root causes. When ready, proceed to{' '}
            <strong>Competing Hypotheses</strong>.
          </span>
        </div>
      )}

      {/* ── Main Canvas + Evidence Panel ────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Graph area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* 3D view */}
          <div style={{ position: 'absolute', inset: 0, display: viewMode === '3d' ? 'flex' : 'none', flexDirection: 'column' }}>
            {isLoadingScenario ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--nd-text-secondary)' }}>
                <RefreshCw style={{ width: 22, height: 22, color: 'var(--nd-accent)' }} className="nd-spinner" />
                <span style={{ fontSize: 13 }}>Loading project architecture &amp; events…</span>
              </div>
            ) : displayEntities.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, textAlign: 'center' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'var(--nd-bg-elevated)',
                  border: '1px solid var(--nd-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Activity style={{ width: 24, height: 24, color: 'var(--nd-text-muted)' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--nd-text-base)', fontWeight: 600, color: 'var(--nd-text-primary)', marginBottom: 6 }}>
                    No Incident Events Generated Yet
                  </h4>
                  <p style={{ fontSize: 12, color: 'var(--nd-text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
                    Generate a controlled security incident mapped to this project's verified components.
                  </p>
                </div>
                <button onClick={handleSimulate} className="nd-btn nd-btn-primary nd-btn-sm">
                  <Sparkles style={{ width: 13, height: 13 }} />
                  Generate Incident Simulation
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative', flex: 1, height: '100%' }}>
                <CyberWorld
                  entities={displayEntities}
                  events={events}
                  currentEvent={currentEvent}
                  customLinks={displayLinks}
                  selectedEntityId={selectedEntityId}
                  onSelectEntity={handleSelectEntity}
                />
              </div>
            )}
          </div>

          {/* 2D view */}
          <div style={{ position: 'absolute', inset: 0, display: viewMode === '2d' ? 'flex' : 'none', flexDirection: 'column' }}>
            {isLoadingGraph ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--nd-text-secondary)' }}>
                <RefreshCw style={{ width: 22, height: 22, color: 'var(--nd-accent)' }} className="nd-spinner" />
                <span style={{ fontSize: 13 }}>Computing deterministic causal DAG…</span>
              </div>
            ) : (
              <CausalGraphView
                graphData={graphData}
                selectedEventId={selectedEventId}
                onSelectEvent={(id) => {
                  setSelectedEventId(id);
                  setSelectedEntityId(null);
                  const idx = events.findIndex((e) => e.id === id);
                  if (idx !== -1) setCurrentTimelineIndex(idx);
                }}
              />
            )}
          </div>
        </div>

        {/* ── Evidence Inspector Side Panel ──────────────────────────────── */}
        <div style={{
          width: 350,
          flexShrink: 0,
          borderLeft: '1px solid var(--nd-border-default)',
          backgroundColor: 'var(--nd-bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <EvidenceInspector
            selectedEvent={selectedEvent}
            selectedEntity={selectedEntity}
            graphData={graphData}
            scenario={scenario}
            onSelectEntity={(entId) => {
              handleSelectEntity(entId);
            }}
            onSelectEvent={(id) => {
              setSelectedEventId(id);
              setSelectedEntityId(null);
              const idx = events.findIndex((e) => e.id === id);
              if (idx !== -1) setCurrentTimelineIndex(idx);
            }}
            onClose={() => {
              setSelectedEntityId(null);
              setSelectedEventId(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
