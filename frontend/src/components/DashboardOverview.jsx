import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Activity,
  CheckCircle2,
  FileCode,
  ArrowRight,
  Sparkles,
  FolderOpen,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchDemoCodebase } from '../api/client';

export default function DashboardOverview() {
  const navigate = useNavigate();
  const {
    codebaseScanResult,
    setCodebaseScanResult,
    setActiveFindingId,
    setIsScanningCodebase,
    isScanningCodebase,
  } = useInvestigationStore();

  const handleLoadDemo = async () => {
    setIsScanningCodebase(true);
    try {
      const res = await fetchDemoCodebase();
      setCodebaseScanResult(res);
      if (res.findings?.length > 0) setActiveFindingId(res.findings[0].id);
      navigate('/dashboard/findings');
    } finally {
      setIsScanningCodebase(false);
    }
  };

  const findings = codebaseScanResult?.findings || [];
  const manifest = codebaseScanResult?.manifest;
  const openCount = codebaseScanResult?.open_findings_count ?? findings.length;
  const fixedCount = codebaseScanResult?.fixed_findings_count ?? 0;
  const totalCount = findings.length;
  const fixedPct = totalCount > 0 ? Math.round((fixedCount / totalCount) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0a0c10] select-none">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Project Header Banner */}
        <div className="rounded-2xl border border-slate-800 bg-[#0f141c] p-6 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800/40">
                  Active Codebase Security Posture
                </span>
                {codebaseScanResult?.is_demo && (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-800/40">
                    ⚡ Demo Project
                  </span>
                )}
                <span className="text-xs text-slate-500 font-mono">
                  {codebaseScanResult ? `ID: ${codebaseScanResult.project_id}` : 'No Project Connected'}
                </span>
              </div>
              <h1 className="text-2xl font-black text-white mt-2">
                {codebaseScanResult ? codebaseScanResult.project_name : 'No Codebase Analyzed Yet'}
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {codebaseScanResult
                  ? 'Deterministic static analysis and attack graph modeling active. Findings are grounded with exact file paths and source line evidence.'
                  : 'Connect your repository or load the pre-analyzed demo project to begin exploring vulnerabilities and attack paths.'}
              </p>
            </div>

            {!codebaseScanResult ? (
              <button
                onClick={handleLoadDemo}
                disabled={isScanningCodebase}
                className="flex items-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 text-xs shadow-lg shadow-cyan-950/40 transition shrink-0 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>Load Sample Demo Project</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 shrink-0">
                <Link
                  to="/dashboard/findings"
                  className="flex items-center space-x-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition"
                >
                  <FolderOpen className="h-4 w-4 text-cyan-400" />
                  <span>Scan Another ZIP</span>
                </Link>
              </div>
            )}
          </div>

          {/* Severity Metrics Bar */}
          {codebaseScanResult && (
            <>
              <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3">
                  <span className="text-slate-400 block text-[11px]">Critical Severities</span>
                  <p className="text-xl font-bold text-rose-400 mt-1">{codebaseScanResult.critical_count}</p>
                </div>
                <div className="rounded-xl border border-orange-900/40 bg-orange-950/20 p-3">
                  <span className="text-slate-400 block text-[11px]">High Severities</span>
                  <p className="text-xl font-bold text-orange-400 mt-1">{codebaseScanResult.high_count}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                  <span className="text-slate-400 block text-[11px]">Open Findings</span>
                  <p className="text-xl font-bold text-amber-400 mt-1">{openCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
                  <span className="text-slate-400 block text-[11px]">Verified Fixed</span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{fixedCount}</p>
                </div>
              </div>

              {/* Remediation progress bar */}
              {totalCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Remediation Progress</span>
                    <span className="text-emerald-400 font-bold">{fixedPct}% Fixed</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${fixedPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {fixedCount} of {totalCount} vulnerabilities remediated and deterministically verified.
                    {openCount > 0 && ` ${openCount} still require attention.`}
                    {openCount === 0 && totalCount > 0 && ' ✅ All findings resolved!'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 4 Core AppSec Workflow Stage Cards (linking to correct routes) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
              Application Security Workspaces
            </span>
            <span className="text-xs text-slate-500 font-mono">Evidence-Grounded Actions</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Security Findings */}
            <Link
              to="/dashboard/findings"
              className="group rounded-xl border border-slate-800 bg-[#0f141c] p-5 hover:border-cyan-500/50 hover:bg-[#141b24] transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <FileCode className="h-5 w-5" />
                  <h3 className="font-bold text-sm text-slate-100">1. Security Findings & Evidence</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Inspect raw AST findings, CWE classifications, and exact source code line snippets extracted directly from your files. Upload a ZIP or explore the demo.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-[11px] font-mono text-cyan-400">
                <span>
                  {findings.length > 0
                    ? `${findings.length} Issues Detected · ${openCount} Open · ${fixedCount} Fixed`
                    : 'No codebase analyzed yet'}
                </span>
              </div>
            </Link>

            {/* Card 2: Attack Paths */}
            <Link
              to="/dashboard/attack-paths"
              className="group rounded-xl border border-slate-800 bg-[#0f141c] p-5 hover:border-cyan-500/50 hover:bg-[#141b24] transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <Activity className="h-5 w-5" />
                  <h3 className="font-bold text-sm text-slate-100">2. 3D & 2D Attack Paths</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Visualize topological entrypoints traversing the API gateway into vulnerable handler components and compromised data sinks. Fixed paths are visually severed.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-[11px] font-mono text-cyan-400">
                <span>Interactive 3D Topography + 2D Causal Flow</span>
              </div>
            </Link>

            {/* Card 3: Fixes */}
            <Link
              to="/dashboard/fixes"
              className="group rounded-xl border border-slate-800 bg-[#0f141c] p-5 hover:border-cyan-500/50 hover:bg-[#141b24] transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-bold text-sm text-slate-100">3. Remediation & Fix Verification</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Review Gemma 4-assisted code modifications, inspect unified diffs, and deterministically re-verify vulnerability elimination. Each fix updates the live attack graph.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-[11px] font-mono text-cyan-400">
                <span>Developer Approval Gated · Sandbox Re-scan · Status Lifecycle</span>
              </div>
            </Link>

            {/* Card 4: Advanced Analysis */}
            <Link
              to="/dashboard/advanced"
              className="group rounded-xl border border-slate-800 bg-[#0f141c] p-5 hover:border-indigo-500/50 hover:bg-[#141b24] transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <FlaskConical className="h-5 w-5" />
                  <h3 className="font-bold text-sm text-slate-100">4. Advanced Analysis</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Historical breach reference (Operation GhostPulse): causal incident graphs, competing hypotheses, counterfactual mutations, and AI audit scorecards.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-[11px] font-mono text-indigo-400">
                <span>Causal Reasoning · Counterfactual Lab · Benchmark Scorecard</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
