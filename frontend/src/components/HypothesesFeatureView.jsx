import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchHypotheses, challengeHypothesis } from '../api/client';
import HypothesesView from './HypothesesView';
import EvidenceInspector from './EvidenceInspector';

export default function HypothesesFeatureView() {
  const navigate = useNavigate();
  const {
    activeProjectId,
    scenario,
    graphData,
    hypothesesData,
    setHypothesesData,
    isLoadingHypotheses,
    setIsLoadingHypotheses,
    hypothesesError,
    setHypothesesError,
    selectedEventId,
    setSelectedEventId,
    selectedEntityId,
    setSelectedEntityId,
    setCurrentTimelineIndex,
  } = useInvestigationStore();

  const handleEvaluate = () => {
    if (!activeProjectId) return;
    setIsLoadingHypotheses(true);
    setHypothesesError(null);
    fetchHypotheses(activeProjectId)
      .then((data) => setHypothesesData(data))
      .catch((err) => setHypothesesError(err.message))
      .finally(() => setIsLoadingHypotheses(false));
  };

  const handleChallenge = (hypId, challenge) => {
    if (!activeProjectId) return Promise.reject(new Error('No active project'));
    return challengeHypothesis(activeProjectId, hypId, challenge);
  };

  useEffect(() => {
    if (activeProjectId && !hypothesesData && !isLoadingHypotheses) {
      handleEvaluate();
    }
  }, [activeProjectId]);

  const events = scenario?.events || [];
  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0] || null;
  const selectedEntity = scenario?.entities?.find((ent) => ent.id === selectedEntityId);

  if (!activeProjectId) {
    return (
      <div className="nd-workspace" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="nd-empty">
          <ShieldAlert className="nd-empty-icon" style={{ width: 48, height: 48 }} />
          <span className="nd-subheading">No Active Project Selected</span>
          <p className="nd-caption" style={{ maxWidth: 360 }}>
            Select or ingest a project to formulate and challenge Gemma 4 competing hypotheses.
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
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <HypothesesView
          hypothesesData={hypothesesData}
          isLoading={isLoadingHypotheses}
          error={hypothesesError}
          onEvaluate={handleEvaluate}
          onSelectEvent={(eid) => {
            setSelectedEventId(eid);
            setSelectedEntityId(null);
            const idx = events.findIndex((e) => e.id === eid);
            if (idx !== -1) setCurrentTimelineIndex(idx);
          }}
          onChallenge={handleChallenge}
        />
      </div>

      {/* Evidence Inspector Side Panel */}
      <div style={{ width: 340, height: '100%', flexShrink: 0, borderLeft: '1px solid var(--nd-border-default)', backgroundColor: 'var(--nd-bg-surface)' }}>
        <EvidenceInspector
          selectedEvent={selectedEvent}
          selectedEntity={selectedEntity}
          graphData={graphData}
          scenario={scenario}
          onSelectEntity={(entId) => {
            setSelectedEntityId(entId);
            setSelectedEventId(null);
          }}
          onSelectEvent={(eid) => {
            setSelectedEventId(eid);
            setSelectedEntityId(null);
            const idx = events.findIndex((e) => e.id === eid);
            if (idx !== -1) setCurrentTimelineIndex(idx);
          }}
          onClose={() => {
            setSelectedEntityId(null);
            setSelectedEventId(null);
          }}
        />
      </div>
    </div>
  );
}
