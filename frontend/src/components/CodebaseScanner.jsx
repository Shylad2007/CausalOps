import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileCode,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Terminal,
  FileText,
  ArrowRight,
  Sparkles,
  Activity
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { uploadAndScanZip, fetchDemoCodebase } from '../api/client';

export default function CodebaseScanner() {
  const navigate = useNavigate();
  const {
    codebaseScanResult,
    setCodebaseScanResult,
    isScanningCodebase,
    setIsScanningCodebase,
    codebaseScanError,
    setCodebaseScanError,
    activeFindingId,
    setActiveFindingId,
    setActiveTab
  } = useInvestigationStore();

  const [selectedFile, setSelectedFile] = useState(null);
  const [projectNameInput, setProjectNameInput] = useState('');

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsScanningCodebase(true);
    setCodebaseScanError(null);

    try {
      const result = await uploadAndScanZip(selectedFile, projectNameInput);
      setCodebaseScanResult(result);
      if (result.findings?.length > 0) {
        setActiveFindingId(result.findings[0].id);
      }
    } catch (err) {
      setCodebaseScanError(err.message || 'Scan failed.');
    } finally {
      setIsScanningCodebase(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsScanningCodebase(true);
    setCodebaseScanError(null);

    try {
      const result = await fetchDemoCodebase();
      setCodebaseScanResult(result);
      if (result.findings?.length > 0) {
        setActiveFindingId(result.findings[0].id);
      }
    } catch (err) {
      setCodebaseScanError(err.message || 'Failed to load demo codebase.');
    } finally {
      setIsScanningCodebase(false);
    }
  };

  const findings = codebaseScanResult?.findings || [];
  const manifest = codebaseScanResult?.manifest;
  const activeFinding = findings.find(f => f.id === activeFindingId) || findings[0];

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/60';
      case 'high':
        return 'bg-orange-950/80 text-orange-300 border-orange-800/60';
      case 'medium':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      default:
        return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0c10] overflow-hidden select-none">
      {/* Top Banner / Codebase Ingestion Controls */}
      <div className="border-b border-slate-800 bg-[#0d1117] px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 text-sm tracking-wide">
                Codebase Security Scanner
              </span>
              <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-800/50">
                Deterministic Static Analysis
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Upload source archives (.zip) to detect SQL injection, command execution, hardcoded keys, and path traversal with exact file line evidence.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleLoadDemo}
              disabled={isScanningCodebase}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
            >
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>Load ShopPulse Demo Project</span>
            </button>

            <form onSubmit={handleFileUpload} className="flex items-center space-x-2">
              <input
                type="file"
                accept=".zip"
                id="zip-upload"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                }}
              />
              <label
                htmlFor="zip-upload"
                className="cursor-pointer flex items-center space-x-1.5 rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate max-w-[120px]">{selectedFile ? selectedFile.name : 'Choose ZIP...'}</span>
              </label>

              {selectedFile && (
                <button
                  type="submit"
                  disabled={isScanningCodebase}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-cyan-500 transition disabled:opacity-50"
                >
                  {isScanningCodebase ? 'Scanning...' : 'Scan ZIP'}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Scan Error alert */}
        {codebaseScanError && (
          <div className="mt-3 rounded-lg border border-rose-800 bg-rose-950/60 p-2.5 text-xs text-rose-300 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{codebaseScanError}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isScanningCodebase ? (
        <div className="flex flex-1 flex-col items-center justify-center text-slate-400 space-y-3">
          <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
          <p className="text-xs font-medium text-slate-300">
            Unpacking archive safely & running deterministic security checks...
          </p>
        </div>
      ) : codebaseScanResult ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Project Manifest & Findings List */}
          <div className="w-96 border-r border-slate-800 bg-[#0d1117] flex flex-col overflow-hidden shrink-0">
            {/* Manifest Bar */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-100">{codebaseScanResult.project_name}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {manifest?.project_type?.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                {manifest?.detected_languages?.map(lang => (
                  <span key={lang} className="px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                    {lang}
                  </span>
                ))}
                {manifest?.detected_frameworks?.map(fw => (
                  <span key={fw} className="px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                    {fw}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 pt-1 flex justify-between">
                <span>{manifest?.scanned_files} files scanned</span>
                <span className="text-rose-400 font-semibold">{codebaseScanResult.total_findings} findings</span>
              </div>
            </div>

            {/* Findings List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {findings.map((f) => {
                const isSelected = activeFinding?.id === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setActiveFindingId(f.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-all ${
                      isSelected
                        ? 'border-cyan-500/60 bg-cyan-950/20 shadow-md'
                        : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-slate-400">{f.id}</span>
                      <span className={`rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase ${getSeverityBadge(f.severity)}`}>
                        {f.severity}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-200 mt-1 line-clamp-1">{f.title}</h4>
                    <p className="font-mono text-[10px] text-cyan-400 mt-1 truncate">
                      {f.file_path}:{f.line_start}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Finding Evidence Inspector */}
          {activeFinding ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0c10]">
              <div className="rounded-xl border border-slate-800 bg-[#0f141c] p-6 shadow-xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">{activeFinding.id}</span>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${getSeverityBadge(activeFinding.severity)}`}>
                        {activeFinding.severity}
                      </span>
                      {activeFinding.cwe_id && (
                        <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                          {activeFinding.cwe_id}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white mt-1">{activeFinding.title}</h2>
                  </div>
                  <span className="rounded bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 flex items-center space-x-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Deterministic Evidence Match</span>
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeFinding.description}
                </p>

                {/* File Location Banner */}
                <div className="flex items-center space-x-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-mono">
                  <FileCode className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span className="text-slate-400">Location:</span>
                  <span className="text-slate-200 font-bold">{activeFinding.file_path}</span>
                  <span className="text-cyan-400">(Lines {activeFinding.line_start}–{activeFinding.line_end})</span>
                </div>

                {/* Source Code Evidence Snippet */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px]">
                      Extracted Source Code Snippet
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Read directly from codebase file</span>
                  </div>
                  <pre className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-rose-300 overflow-x-auto leading-relaxed shadow-inner">
                    <code>{activeFinding.code_snippet}</code>
                  </pre>
                </div>

                {/* Remediation Guidance */}
                <div className="rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-4 space-y-1 text-xs">
                  <span className="font-semibold text-cyan-300 uppercase tracking-wider text-[11px] block">
                    Recommended Remediation Guidance
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {activeFinding.remediation_guidance}
                  </p>
                </div>

                {/* Observable Metadata */}
                {activeFinding.evidence_metadata && Object.keys(activeFinding.evidence_metadata).length > 0 && (
                  <div className="space-y-1 pt-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Deterministic Match Metadata
                    </span>
                    <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-400 overflow-x-auto">
                      {JSON.stringify(activeFinding.evidence_metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Next Steps Action Bar */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setActiveFindingId(activeFinding.id);
                      navigate('/dashboard/attack-paths');
                    }}
                    className="flex items-center space-x-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition"
                  >
                    <Activity className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Trace Attack Path in 3D / DAG</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveFindingId(activeFinding.id);
                      navigate('/dashboard/fixes');
                    }}
                    className="flex items-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-950/40 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Review AI Fix & Verify Remediation</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select a vulnerability finding from the sidebar to inspect source evidence.
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8 text-slate-500">
          <FolderOpen className="h-12 w-12 text-slate-700 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No Codebase Analyzed Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
            Upload a project source archive (.zip) above or click "Load ShopPulse Demo Project" to run deterministic vulnerability analysis.
          </p>
          <button
            onClick={handleLoadDemo}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-cyan-500 transition"
          >
            Load Sample Codebase Demo
          </button>
        </div>
      )}
    </div>
  );
}
