import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Share2,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
  Activity,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { simulateProjectIncident } from '../api/client';
import CyberWorld from './CyberWorld';
import EvidenceInspector from './EvidenceInspector';

export default function CyberWorldView() {
  const navigate = useNavigate();
  const {
    activeProjectId,
    codebaseScanResult,
    scenario,
    setScenario,
    isLoadingScenario,
    selectedEventId,
    setSelectedEventId,
    selectedEntityId,
    setSelectedEntityId,
    currentTimelineIndex,
    setCurrentTimelineIndex,
    playbackState,
    setPlaybackState,
  } = useInvestigationStore();

  const [isSimulating, setIsSimulating] = React.useState(false);

  const events = scenario?.events || [];
  const entities = scenario?.entities || [];

  const currentEvent = events[currentTimelineIndex] || null;
  const selectedEvent = events.find((e) => e.id === selectedEventId) || currentEvent;
  const selectedEntity = entities.find((ent) => ent.id === selectedEntityId);

  const handleSimulate = async () => {
    if (!activeProjectId) return;
    setIsSimulating(true);
    try {
      const newScen = await simulateProjectIncident(activeProjectId);
      setScenario(newScen);
    } catch (err) {
      console.error('Failed to simulate incident:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!codebaseScanResult && !activeProjectId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-500 bg-[#0a0c10]">
        <Activity className="h-12 w-12 text-slate-700 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">No Active Project Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
          Select or ingest a codebase to view its 3D simulated architecture and incident replay.
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
      {/* Top Controls Header */}
      <div className="border-b border-slate-800 bg-[#0d1117] px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100 text-sm tracking-wide">
              3D Cyber World & Incident Replay
            </span>
            <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-800/50">
              Active Project: {codebaseScanResult?.project_name || activeProjectId}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Visualize the active project's simulated network and replay chronological security telemetry events.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="flex items-center space-x-1.5 rounded-lg border border-cyan-700/60 bg-cyan-950/40 hover:bg-cyan-900/50 px-3 py-1.5 text-xs font-medium text-cyan-300 transition disabled:opacity-50"
            title="Generate or update controlled incident simulation for active project"
          >
            <Sparkles className={`h-3.5 w-3.5 text-cyan-400 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Simulating...' : 'Simulate Incident For Project'}</span>
          </button>
        </div>
      </div>

      {/* Main 3D Canvas + Evidence Inspector */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-hidden bg-[#07090e]">
          {isLoadingScenario ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 space-y-2">
              <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
              <span className="text-xs">Loading project 3D architecture & events...</span>
            </div>
          ) : entities.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 space-y-3 p-8 text-center">
              <Activity className="h-10 w-10 text-cyan-500/50" />
              <h4 className="text-sm font-semibold text-slate-200">No Incident Events Generated Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Generate a controlled security incident mapped to the active project's verified components.
              </p>
              <button
                onClick={handleSimulate}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-cyan-500 transition"
              >
                Generate Controlled Incident Simulation
              </button>
            </div>
          ) : (
            <CyberWorld
              entities={entities}
              events={events}
              currentEvent={currentEvent}
              selectedEntityId={selectedEntityId}
              onSelectEntity={(id) => {
                setSelectedEntityId(id);
                setSelectedEventId(null);
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
