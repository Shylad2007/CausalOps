import React, { useState } from 'react';
import {
  FolderGit2,
  Upload,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Cpu,
  FileCode,
  X
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { uploadAndScanZip, fetchDemoCodebase } from '../api/client';

export default function OnboardingModal() {
  const {
    isOnboardingModalOpen,
    closeOnboardingModal,
    completeOnboarding,
    setCodebaseScanResult,
    setIsScanningCodebase,
    setCodebaseScanError,
    setActiveFindingId,
    setActiveTab
  } = useInvestigationStore();

  const [step, setStep] = useState(1); // 1: Select Type, 2: Connect Codebase
  const [projectCategory, setProjectCategory] = useState('full_stack');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedZip, setSelectedZip] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  if (!isOnboardingModalOpen) return null;

  const handleFinishWithDemo = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetchDemoCodebase();
      setCodebaseScanResult(res);
      if (res.findings?.length > 0) setActiveFindingId(res.findings[0].id);
      completeOnboarding();
      setActiveTab('codebase_scan');
    } catch (err) {
      setError(err.message || 'Demo load failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishWithZip = async () => {
    if (!selectedZip) {
      setError('Please select a ZIP source code archive.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const res = await uploadAndScanZip(selectedZip);
      setCodebaseScanResult(res);
      if (res.findings?.length > 0) setActiveFindingId(res.findings[0].id);
      completeOnboarding();
      setActiveTab('codebase_scan');
    } catch (err) {
      setError(err.message || 'Codebase scan failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0f141c] p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Sparkles className="h-5 w-5" />
            <h3 className="font-bold text-slate-100 text-sm">Welcome to CausalOps — Quick Setup</h3>
          </div>
          <button onClick={closeOnboardingModal} className="text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center space-x-3 text-xs">
          <span className={`flex items-center space-x-1.5 ${step === 1 ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
            <span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px]">1</span>
            <span>Target Architecture</span>
          </span>
          <span className="text-slate-600">→</span>
          <span className={`flex items-center space-x-1.5 ${step === 2 ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
            <span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px]">2</span>
            <span>Connect Codebase</span>
          </span>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-800/80 bg-rose-950/40 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Step 1: System Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Tell CausalOps what kind of system you are analyzing. This helps the engine configure appropriate route entrypoints, data sinks, and attack path models.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'web_app', title: 'Web App', desc: 'React, Vue, SPA clients with static frontends' },
                { id: 'api_backend', title: 'API / Backend', desc: 'FastAPI, Express, Django REST microservices' },
                { id: 'full_stack', title: 'Full-Stack App', desc: 'Client frontend + API backend with SQL/NoSQL sinks' },
              ].map(cat => (
                <div
                  key={cat.id}
                  onClick={() => setProjectCategory(cat.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    projectCategory === cat.id
                      ? 'border-cyan-500 bg-cyan-950/30 text-white shadow-md'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <h4 className="font-semibold text-xs text-slate-200">{cat.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{cat.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex items-center space-x-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Codebase Connection */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Choose how to provide your application's source code for security analysis:
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Option A: ZIP Archive */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <Upload className="h-4 w-4" />
                  <span className="font-semibold text-xs text-slate-200">Upload Source ZIP</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Safely uploads a project archive (.zip). Files are extracted in an isolated sandbox with path-traversal prevention.
                </p>
                <input
                  type="file"
                  accept=".zip"
                  id="onboarding-zip"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setSelectedZip(e.target.files[0]);
                  }}
                />
                <label
                  htmlFor="onboarding-zip"
                  className="cursor-pointer block text-center rounded border border-cyan-800/60 bg-cyan-950/40 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 transition truncate"
                >
                  {selectedZip ? selectedZip.name : 'Select .zip file...'}
                </label>
                <button
                  onClick={handleFinishWithZip}
                  disabled={!selectedZip || isProcessing}
                  className="w-full rounded bg-cyan-600 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-40"
                >
                  {isProcessing ? 'Analyzing Codebase...' : 'Scan Uploaded Archive'}
                </button>
              </div>

              {/* Option B: Pre-built Demo Project */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Cpu className="h-4 w-4" />
                    <span className="font-semibold text-xs text-slate-200">Load Sample Codebase</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Test CausalOps instantly using <strong className="text-slate-300">ShopPulse</strong>: a fullstack e-commerce project with SQL injection, command execution, and hardcoded keys.
                  </p>
                </div>
                <button
                  onClick={handleFinishWithDemo}
                  disabled={isProcessing}
                  className="w-full rounded border border-emerald-700/60 bg-emerald-950/40 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 transition disabled:opacity-50"
                >
                  {isProcessing ? 'Loading Demo...' : 'Load ShopPulse Demo'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Back to step 1
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
