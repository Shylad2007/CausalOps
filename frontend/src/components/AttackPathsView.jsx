import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Layers,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  FileCode,
  Sparkles,
  Server,
  Database,
  Terminal,
  Cpu,
  RefreshCw,
  FolderOpen,
  Share2,
  Lock
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchCodebaseAttackGraph, fetchDemoCodebase } from '../api/client';
import CyberWorld from './CyberWorld';

export default function AttackPathsView() {
  const navigate = useNavigate();
  const {
    codebaseScanResult,
    setCodebaseScanResult,
    setIsScanningCodebase,
    setActiveTab,
    activeFindingId,
    setActiveFindingId
  } = useInvestigationStore();

  const [attackGraph, setAttackGraph] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('3d'); // '3d' | '2d'
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  useEffect(() => {
    if (codebaseScanResult?.project_id) {
      loadGraph(codebaseScanResult.project_id);
    }
  }, [codebaseScanResult?.project_id]);

  const loadGraph = async (projectId) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCodebaseAttackGraph(projectId);
      setAttackGraph(data);
      if (data.nodes?.length > 0 && !selectedNodeId) {
        // Default select first vulnerable component node
        const firstVuln = data.nodes.find(n => n.category === 'vulnerable_component');
        setSelectedNodeId(firstVuln ? firstVuln.id : data.nodes[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load attack graph.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsScanningCodebase(true);
    try {
      const result = await fetchDemoCodebase();
      setCodebaseScanResult(result);
      if (result.findings?.length > 0) {
        setActiveFindingId(result.findings[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load demo codebase.');
    } finally {
      setIsScanningCodebase(false);
    }
  };

  // Find the selected node object
  const selectedNode = attackGraph?.nodes?.find(n => n.id === selectedNodeId);
  // Find associated finding if any
  const associatedFinding = codebaseScanResult?.findings?.find(
    f => f.id === selectedNode?.finding_id || f.id === activeFindingId
  );

  const handleSelectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    const node = attackGraph?.nodes?.find(n => n.id === nodeId);
    if (node?.finding_id) {
      setActiveFindingId(node.finding_id);
    }
  };

  if (!codebaseScanResult) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-500 bg-[#0a0c10]">
        <Share2 className="h-12 w-12 text-slate-700 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">No Codebase Analyzed</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
          Scan a codebase first to explore its 3D architectural topography and deterministic attack paths.
        </p>
        <button
          onClick={handleLoadDemo}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-cyan-500 transition"
        >
          Load Sample Codebase Demo
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
              Codebase Attack Paths
            </span>
            <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-800/50">
              Architectural DAG & 3D Topography
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Traces how external untrusted inputs traverse API gateways into vulnerable handlers and compromised sinks.
          </p>
        </div>

        {/* View Mode Toggle & Metrics */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-3 text-xs font-mono text-slate-400">
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">
              Nodes: <strong className="text-slate-200">{attackGraph?.metrics?.node_count || 0}</strong>
            </span>
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">
              Causal Edges: <strong className="text-cyan-400">{attackGraph?.metrics?.edge_count || 0}</strong>
            </span>
            <span className="px-2 py-1 rounded bg-rose-950/50 border border-rose-800/50 text-rose-300">
              Critical Paths: <strong>{attackGraph?.metrics?.critical_attack_paths || 0}</strong>
            </span>
          </div>

          <div className="flex rounded-lg border border-slate-800 bg-slate-900/80 p-0.5">
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                viewMode === '3d'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>3D Topology</span>
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                viewMode === '2d'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>2D Causal Flow</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Visual Area: 3D or 2D */}
        <div className="flex-1 relative overflow-hidden bg-[#07090e]">
          {isLoading ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 space-y-2">
              <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
              <span className="text-xs">Generating topological attack graph...</span>
            </div>
          ) : viewMode === '3d' ? (
            <CyberWorld
              entities={attackGraph?.nodes || []}
              customLinks={attackGraph?.edges || []}
              selectedEntityId={selectedNodeId}
              onSelectEntity={(id) => handleSelectNode(id)}
            />
          ) : (
            /* 2D Causal Flow DAG Representation */
            <div className="h-full w-full p-8 overflow-y-auto flex items-center justify-center">
              <div className="max-w-4xl w-full grid grid-cols-4 gap-6 relative">
                {/* Stage 1: External Client */}
                <div className="flex flex-col space-y-3">
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
                    Tier 1: Entrypoint
                  </span>
                  <div
                    onClick={() => handleSelectNode('node-attacker-client')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      selectedNodeId === 'node-attacker-client'
                        ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-500/50'
                        : 'border-slate-800 bg-[#0f141c] hover:border-slate-700'
                    }`}
                  >
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                      External Client
                    </span>
                    <h4 className="text-xs font-bold text-white mt-2">Public Web / API Client</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Untrusted input dispatch</p>
                  </div>
                </div>

                {/* Stage 2: Gateway */}
                <div className="flex flex-col space-y-3">
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
                    Tier 2: Router
                  </span>
                  <div
                    onClick={() => handleSelectNode('node-api-router')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      selectedNodeId === 'node-api-router'
                        ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-500/50'
                        : 'border-slate-800 bg-[#0f141c] hover:border-slate-700'
                    }`}
                  >
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40">
                      API Gateway
                    </span>
                    <h4 className="text-xs font-bold text-white mt-2">{codebaseScanResult.project_name}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">HTTP Request Dispatcher</p>
                  </div>
                </div>

                {/* Stage 3: Vulnerable Handlers */}
                <div className="flex flex-col space-y-3">
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
                    Tier 3: Handlers
                  </span>
                  {attackGraph?.nodes?.filter(n => n.category === 'vulnerable_component').map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => handleSelectNode(node.id)}
                        className={`cursor-pointer rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-rose-400 bg-rose-950/30 ring-1 ring-rose-500/50'
                            : 'border-slate-800 bg-[#0f141c] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/40">
                            {node.severity || 'CRITICAL'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{node.name}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-white mt-1.5 truncate">
                          {node.finding_title || node.description}
                        </h4>
                      </div>
                    );
                  })}
                </div>

                {/* Stage 4: Sinks */}
                <div className="flex flex-col space-y-3">
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
                    Tier 4: Sinks
                  </span>
                  {attackGraph?.nodes?.filter(n => n.category === 'compromised_sink').map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => handleSelectNode(node.id)}
                        className={`cursor-pointer rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-500/50'
                            : 'border-slate-800 bg-[#0f141c] hover:border-slate-700'
                        }`}
                      >
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/40">
                          Sink ({node.type})
                        </span>
                        <h4 className="text-xs font-semibold text-white mt-1.5">{node.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{node.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Node & Exploit Path Inspector */}
        <div className="w-96 border-l border-slate-800 bg-[#0d1117] flex flex-col overflow-y-auto p-5 space-y-5 shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              Attack Path Node Inspector
            </span>
            <h3 className="text-base font-bold text-white mt-1">
              {selectedNode ? selectedNode.name : 'Select a node'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {selectedNode ? selectedNode.description : 'Click any node in 3D or 2D to inspect its exploit context.'}
            </p>
          </div>

          {selectedNode && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Node ID:</span>
                <span className="text-slate-200">{selectedNode.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="text-cyan-300">{selectedNode.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Security Zone:</span>
                <span className="text-slate-300">{selectedNode.zone}</span>
              </div>
              {selectedNode.position_3d && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinates:</span>
                  <span className="text-slate-400">
                    [{selectedNode.position_3d.map(c => c.toFixed(1)).join(', ')}]
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Associated Finding Details */}
          {associatedFinding && (
            <div className="rounded-xl border border-slate-800 bg-[#0f141c] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-cyan-400">{associatedFinding.id}</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60">
                  {associatedFinding.severity}
                </span>
              </div>

              <h4 className="text-xs font-bold text-white leading-snug">
                {associatedFinding.title}
              </h4>

              <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-mono">
                <FileCode className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{associatedFinding.file_path}:{associatedFinding.line_start}</span>
              </div>

              <pre className="rounded border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px] text-rose-300 overflow-x-auto">
                <code>{associatedFinding.code_snippet}</code>
              </pre>

              <button
                onClick={() => {
                  setActiveFindingId(associatedFinding.id);
                  navigate('/dashboard/fixes');
                }}
                className="w-full flex items-center justify-center space-x-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 py-2 text-xs font-bold text-white shadow transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Review AI Patch & Verify Fix</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
