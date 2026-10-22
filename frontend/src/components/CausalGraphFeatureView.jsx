import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Share2,
  RefreshCw,
  GitCommit,
  Info,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchScenarioCausalGraph } from '../api/client';
import CausalGraphView from './CausalGraphView';
import EvidenceInspector from './EvidenceInspector';

export default function CausalGraphFeatureView() {
  const navigate = useNavigate();
  const {
    activeProjectId,
    scenario,
    graphData,
    setGraphData,
    isLoadingGraph,
    setIsLoadingGraph,
    selectedEventId,
    setSelectedEventId,
    selectedEntityId,
    setSelectedEntityId,
    setCurrentTimelineIndex,
  } = useInvestigationStore();

  useEffect(() => {
    if (activeProjectId && !graphData && !isLoadingGraph) {
      setIsLoadingGraph(true);
      fetchScenarioCausalGraph(activeProjectId)
        .then((data) => setGraphData(data))
        .catch((err) => console.error('Failed to load causal graph:', err))
        .finally(() => setIsLoadingGraph(false));
    }
  }, [activeProjectId, graphData]);

  const events = scenario?.events || [];
  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0] || null;
  const selectedEntity = scenario?.entities?.find((ent) => ent.id === selectedEntityId);

  if (!activeProjectId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-500 bg-[#0a0c10]">
        <Share2 className="h-12 w-12 text-slate-700 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">No Active Project Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
          Select or ingest a project to construct its deterministic causal DAG.
        </p>
        <button
          onClick={() => navigate('/dashboard/projects')}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-cyan-500 transition"
        >
          Go to Projects Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0c10] overflow-hidden select-none">
      {/* Top Header */}
      <div className="border-b border-slate-800 bg-[#0d1117] px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100 text-sm tracking-wide">
              Causal Event Graph
            </span>
            <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-800/50">
              Deterministic DAG Reconstruction
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Reconstructs temporal and security relationships using timestamps, identities, sessions, and shared resources.
          </p>
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {isLoadingGraph ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 space-y-2">
              <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
              <span className="text-xs">Computing deterministic causal DAG...</span>
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

        {/* Evidence Inspector Side Panel */}
        <div className="w-80 h-full shrink-0">
          <EvidenceInspector
            selectedEvent={selectedEvent}
            selectedEntity={selectedEntity}
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
