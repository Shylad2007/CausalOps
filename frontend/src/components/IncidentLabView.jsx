import React, { useState, useEffect } from 'react';
import {
  Activity,
  Share2,
  ShieldAlert,
  GitFork,
  CheckCircle2,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchHypotheses, challengeHypothesis, fetchScorecard } from '../api/client';
import CyberWorld from './CyberWorld';
import EvidenceInspector from './EvidenceInspector';
import CausalGraphView from './CausalGraphView';
import HypothesesView from './HypothesesView';
import CounterfactualLab from './CounterfactualLab';
import ScorecardView from './ScorecardView';

export default function IncidentLabView({
  backendHealth,
  onEvaluateHypotheses,
  onChallengeHypothesis,
  onRefreshScorecard
}) {
  const {
    scenario,
    graphData,
    hypothesesData,
    setHypothesesData,
    isLoadingHypotheses,
    setIsLoadingHypotheses,
    hypothesesError,
    setHypothesesError,
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
    currentTimelineIndex,
    setCurrentTimelineIndex
  } = useInvestigationStore();

  const handleEvaluateHypotheses = onEvaluateHypotheses || (() => {
    setIsLoadingHypotheses(true);
    fetchHypotheses('scenario-apt-solar-infiltrate')
      .then((data) => setHypothesesData(data))
      .catch((err) => setHypothesesError(err.message))
      .finally(() => setIsLoadingHypotheses(false));
  });

  const handleChallengeHypothesis = onChallengeHypothesis || ((hypId, challenge) => {
    return challengeHypothesis('scenario-apt-solar-infiltrate', hypId, challenge);
  });

  const handleRefreshScorecard = onRefreshScorecard || (() => {
    setIsLoadingScorecard(true);
    fetchScorecard('scenario-apt-solar-infiltrate')
      .then((data) => setScorecardData(data))
      .catch((err) => setScorecardError(err.message))
      .finally(() => setIsLoadingScorecard(false));
  });

  const [activeSubTab, setActiveSubTab] = useState('3d_world'); // 'overview' | '3d_world' | 'causal_graph' | 'hypotheses' | 'counterfactual' | 'scorecard'

  useEffect(() => {
    if (activeSubTab === 'scorecard' && !scorecardData && !isLoadingScorecard) {
      handleRefreshScorecard();
    }
  }, [activeSubTab]);

  const subNavItems = [
    { id: '3d_world', label: '3D Incident World', icon: Activity },
    { id: 'causal_graph', label: 'Causal Event Graph', icon: Share2 },
    { id: 'hypotheses', label: 'Competing Hypotheses', icon: ShieldAlert },
    { id: 'counterfactual', label: 'Counterfactual Lab', icon: GitFork },
    { id: 'scorecard', label: 'Audit Scorecard', icon: CheckCircle2 },
    { id: 'overview', label: 'Scenario Overview', icon: Layers },
  ];

  const selectedEvent = scenario?.events?.find((e) => e.id === selectedEventId) || scenario?.events?.[currentTimelineIndex];
  const selectedEntity = scenario?.entities?.find((ent) => ent.id === selectedEntityId);

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0c10] overflow-hidden select-none">
      {/* Sub Navigation Bar for Incident Forensics */}
      <div className="border-b border-slate-800 bg-[#0d1117] px-6 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-100 text-xs tracking-wide">
            Incident Forensics & Reliability Lab
          </span>
          <span className="rounded bg-indigo-950/80 px-2 py-0.5 text-[9px] font-mono text-indigo-400 border border-indigo-800/50">
            Operation GhostPulse · Scenario Engine
          </span>
        </div>

        <div className="flex space-x-1">
          {subNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`flex items-center space-x-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Forensic Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scenario Overview Subtab */}
        {activeSubTab === 'overview' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="rounded-xl border border-slate-800 bg-[#0f141c] p-6 shadow-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 uppercase tracking-widest bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800/40">
                      Active Incident Scenario
                    </span>
                    <h2 className="text-xl font-bold text-white mt-2">
                      Operation GhostPulse: Lateral Movement via Stolen Session Token
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      High-severity multi-stage breach across developer workstations, identity services, and internal database servers.
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60">
                    CRITICAL SEVERITY
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-4 border-t border-slate-800/80 pt-4 text-xs">
                  <div>
                    <span className="text-slate-400">Total Telemetry Events</span>
                    <p className="text-lg font-bold text-slate-100 font-mono">
                      {scenario?.events?.length ?? '—'} Records
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Identified Entities</span>
                    <p className="text-lg font-bold text-slate-100 font-mono">
                      {scenario?.entities?.length ?? '—'} Nodes
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Computed Causal Links</span>
                    <p className="text-lg font-bold text-cyan-400 font-mono">
                      {graphData?.edges?.length ?? '—'} Edges
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Competing Hypotheses</span>
                    <p className="text-lg font-bold text-amber-400 font-mono">
                      {hypothesesData?.hypotheses?.length ?? '—'} Formulated
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3D Cyber World View */}
        {activeSubTab === '3d_world' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 relative">
              <CyberWorld
                entities={scenario?.entities || []}
                currentEvent={scenario?.events?.[currentTimelineIndex] || null}
                selectedEntityId={selectedEntityId}
                onSelectEntity={(entId) => {
                  setSelectedEntityId(entId);
                  setSelectedEventId(null);
                }}
              />
            </div>
            <div className="w-80 h-full shrink-0">
              <EvidenceInspector
                selectedEvent={selectedEvent}
                selectedEntity={selectedEntity}
                onClose={() => setSelectedEntityId(null)}
              />
            </div>
          </div>
        )}

        {/* Causal Event Graph */}
        {activeSubTab === 'causal_graph' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <CausalGraphView
                graphData={graphData}
                selectedEventId={selectedEventId}
                onSelectEvent={(id) => {
                  setSelectedEventId(id);
                  setSelectedEntityId(null);
                  const idx = scenario?.events?.findIndex((e) => e.id === id);
                  if (idx !== -1 && idx !== undefined) {
                    setCurrentTimelineIndex(idx);
                  }
                }}
              />
            </div>
            <div className="w-80 h-full shrink-0">
              <EvidenceInspector
                selectedEvent={selectedEvent}
                selectedEntity={selectedEntity}
                onClose={() => setSelectedEntityId(null)}
              />
            </div>
          </div>
        )}

        {/* Competing Hypotheses View */}
        {activeSubTab === 'hypotheses' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <HypothesesView
                hypothesesData={hypothesesData}
                isLoading={isLoadingHypotheses}
                error={hypothesesError}
                onEvaluate={onEvaluateHypotheses}
                onSelectEvent={(eid) => {
                  setSelectedEventId(eid);
                  setSelectedEntityId(null);
                  const idx = scenario?.events?.findIndex((e) => e.id === eid);
                  if (idx !== -1 && idx !== undefined) {
                    setCurrentTimelineIndex(idx);
                  }
                }}
                onChallenge={onChallengeHypothesis}
              />
            </div>
            <div className="w-80 h-full shrink-0">
              <EvidenceInspector
                selectedEvent={selectedEvent}
                selectedEntity={selectedEntity}
                onClose={() => setSelectedEntityId(null)}
              />
            </div>
          </div>
        )}

        {/* Counterfactual Lab */}
        {activeSubTab === 'counterfactual' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <CounterfactualLab
                scenario={scenario}
                onSelectEvent={(eid) => {
                  setSelectedEventId(eid);
                  setSelectedEntityId(null);
                  const idx = scenario?.events?.findIndex((e) => e.id === eid);
                  if (idx !== -1 && idx !== undefined) {
                    setCurrentTimelineIndex(idx);
                  }
                }}
              />
            </div>
            <div className="w-80 h-full shrink-0">
              <EvidenceInspector
                selectedEvent={selectedEvent}
                selectedEntity={selectedEntity}
                onClose={() => setSelectedEntityId(null)}
              />
            </div>
          </div>
        )}

        {/* Audit Scorecard */}
        {activeSubTab === 'scorecard' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <ScorecardView
                scorecardData={scorecardData}
                isLoading={isLoadingScorecard}
                error={scorecardError}
                onRefreshScorecard={onRefreshScorecard}
                onSelectEvent={(eid) => {
                  setSelectedEventId(eid);
                  setSelectedEntityId(null);
                  const idx = scenario?.events?.findIndex((e) => e.id === eid);
                  if (idx !== -1 && idx !== undefined) {
                    setCurrentTimelineIndex(idx);
                  }
                }}
              />
            </div>
            <div className="w-80 h-full shrink-0">
              <EvidenceInspector
                selectedEvent={selectedEvent}
                selectedEntity={selectedEntity}
                onClose={() => setSelectedEntityId(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
