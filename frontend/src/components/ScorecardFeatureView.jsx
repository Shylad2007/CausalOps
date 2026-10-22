import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  RefreshCw,
  Award,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchScorecard } from '../api/client';
import ScorecardView from './ScorecardView';
import EvidenceInspector from './EvidenceInspector';

export default function ScorecardFeatureView() {
  const navigate = useNavigate();
  const {
    activeProjectId,
    scenario,
    codebaseScanResult,
    scorecardData,
    setScorecardData,
    isLoadingScorecard,
    setIsLoadingScorecard,
    scorecardError,
    setScorecardError,
    selectedEventId,
    setSelectedEventId,
    selectedEntityId,
    setSelectedEntityId,
    setCurrentTimelineIndex,
  } = useInvestigationStore();

  const handleEvaluate = () => {
    if (!activeProjectId) return;
    setIsLoadingScorecard(true);
    setScorecardError(null);
    fetchScorecard(activeProjectId)
      .then((data) => setScorecardData(data))
      .catch((err) => setScorecardError(err.message))
      .finally(() => setIsLoadingScorecard(false));
  };

  useEffect(() => {
    if (activeProjectId && !scorecardData && !isLoadingScorecard) {
      handleEvaluate();
    }
  }, [activeProjectId]);

  const events = scenario?.events || [];
  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0] || null;
  const selectedEntity = scenario?.entities?.find((ent) => ent.id === selectedEntityId);

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    const idx = events.findIndex((e) => e.id === eventId);
    if (idx !== -1) setCurrentTimelineIndex(idx);
  };

  if (!activeProjectId) {
    return (
      <div className="nd-workspace" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="nd-empty">
          <ShieldCheck className="nd-empty-icon" style={{ width: 48, height: 48 }} />
          <span className="nd-subheading">No Active Project Selected</span>
          <p className="nd-caption" style={{ maxWidth: 360 }}>
            Evidence audit and scorecard evaluation are strictly calculated against the active project's security events and benchmark.
          </p>
          <button
            onClick={() => navigate('/dashboard/projects')}
            className="nd-btn nd-btn-primary nd-btn-sm"
          >
            Go to Projects Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nd-workspace" style={{ flexDirection: 'row' }}>
      {/* Main Scorecard Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', borderRight: '1px solid var(--nd-border-default)' }}>
        {/* Sub-header with project context */}
        <div className="nd-workspace-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award style={{ width: 16, height: 16, color: 'var(--nd-low)' }} />
            <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>
              Evidence Audit &amp; Investigation Scorecard
            </span>
            <span className="nd-badge nd-badge-neutral" style={{ fontFamily: 'var(--nd-font-mono)' }}>
              Project: {codebaseScanResult?.project_name || activeProjectId}
            </span>
            {scenario?.metadata?.ground_truth_root_cause_event_ids?.length > 0 ? (
              <span className="nd-badge nd-badge-low">Ground Truth Benchmark Active</span>
            ) : (
              <span className="nd-badge nd-badge-medium">Evaluation Without Prior Benchmark</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleEvaluate}
              disabled={isLoadingScorecard}
              className="nd-btn nd-btn-primary nd-btn-sm"
            >
              <RefreshCw style={{ width: 14, height: 14 }} className={isLoadingScorecard ? 'animate-spin' : ''} />
              Audit Scorecard
            </button>
          </div>
        </div>

        {/* Error notification if any */}
        {scorecardError && (
          <div style={{ margin: 12, display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 'var(--nd-radius-md)', border: '1px solid var(--nd-critical-border)', backgroundColor: 'var(--nd-critical-bg)', color: 'var(--nd-critical)', fontSize: 12 }}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{scorecardError}</span>
            <button
              onClick={handleEvaluate}
              style={{ marginLeft: 'auto', textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Scorecard Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ScorecardView
            scorecardData={scorecardData}
            isLoading={isLoadingScorecard}
            error={scorecardError}
            onRefreshScorecard={handleEvaluate}
            onSelectEvent={handleSelectEvent}
          />
        </div>
      </div>

      {/* Right Drawer / Inspector */}
      <div style={{ width: 320, borderLeft: '1px solid var(--nd-border-default)', backgroundColor: 'var(--nd-bg-surface)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <EvidenceInspector
          selectedEvent={selectedEvent}
          selectedEntity={selectedEntity}
          scenario={scenario}
          onSelectEntity={(entId) => setSelectedEntityId(entId)}
        />
      </div>
    </div>
  );
}
