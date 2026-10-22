import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  GitBranch,
  GitCommit,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Shield,
  Layers,
  Sparkles,
  Cpu,
  FileCode,
  FolderGit2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { connectGitHubRepo, fetchDemoCodebase } from '../api/client';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const {
    currentUser,
    completeOnboarding,
    setCodebaseScanResult,
    setActiveFindingId,
    logout,
  } = useInvestigationStore();

  const [step, setStep] = useState(1); // 1: Target Architecture, 2: Connect Codebase
  const [projectCategory, setProjectCategory] = useState('full_stack');
  const [projectName, setProjectName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitSha, setCommitSha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFinishWithDemo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchDemoCodebase();
      setCodebaseScanResult(res);
      if (res.findings?.length > 0) setActiveFindingId(res.findings[0].id);
      completeOnboarding();
      navigate('/dashboard/projects');
    } catch (err) {
      setError(err.message || 'Failed to load demo codebase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishWithGitHub = async (e) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError('Please provide a valid public GitHub repository URL.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await connectGitHubRepo({
        repo_url: repoUrl.trim(),
        branch: branch.trim() || 'main',
        commit_sha: commitSha.trim() || null,
        project_name: projectName.trim() || null,
        owner_username: currentUser?.username || null,
      });
      setCodebaseScanResult(res);
      if (res.findings?.length > 0) setActiveFindingId(res.findings[0].id);
      completeOnboarding();
      navigate('/dashboard/projects');
    } catch (err) {
      setError(err.message || 'GitHub repository analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    navigate('/dashboard/projects');
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: 'var(--nd-bg-base)',
      color: 'var(--nd-text-primary)',
      fontFamily: 'var(--nd-font-sans)',
    }}>
      {/* Top Header */}
      <header style={{
        display: 'flex',
        height: 48,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--nd-border-default)',
        backgroundColor: 'var(--nd-bg-surface)',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            backgroundColor: 'var(--nd-accent-subtle)',
            border: '1px solid var(--nd-accent-border)',
            borderRadius: 'var(--nd-radius-md)',
          }}>
            <Shield size={13} color="var(--nd-accent)" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em' }}>CAUSALOPS</span>
          <span className="nd-badge nd-badge-info" style={{ fontSize: 9 }}>
            PROJECT ONBOARDING
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
          <span style={{ color: 'var(--nd-text-muted)', fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}>
            Signed in as: <strong style={{ color: 'var(--nd-text-primary)' }}>{currentUser?.username || 'analyst'}</strong>
          </span>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="nd-btn nd-btn-ghost nd-btn-sm"
            style={{ fontSize: 11 }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Stepper Container */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          width: '100%',
          maxWidth: 680,
          backgroundColor: 'var(--nd-bg-surface)',
          border: '1px solid var(--nd-border-default)',
          borderRadius: 'var(--nd-radius-xl)',
          padding: 32,
          boxShadow: 'var(--nd-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {/* Progress Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--nd-border-subtle)', paddingBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--nd-text-primary)', margin: '0 0 4px' }}>
                Project Setup & Ingestion
              </h2>
              <p style={{ fontSize: 12, color: 'var(--nd-text-secondary)', margin: 0 }}>
                Configure your target stack and connect a GitHub repository to begin security analysis.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--nd-font-mono)' }}>
              <span className={`nd-badge ${step === 1 ? 'nd-badge-info' : 'nd-badge-neutral'}`}>
                1. Architecture
              </span>
              <span style={{ color: 'var(--nd-text-muted)' }}>→</span>
              <span className={`nd-badge ${step === 2 ? 'nd-badge-info' : 'nd-badge-neutral'}`}>
                2. Connect GitHub
              </span>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              backgroundColor: 'var(--nd-critical-bg)',
              border: '1px solid var(--nd-critical-border)',
              borderRadius: 'var(--nd-radius-md)',
              fontSize: 12,
              color: 'var(--nd-critical)',
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Target Architecture */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <span className="nd-label" style={{ display: 'block', marginBottom: 2 }}>
                  Select Project Architecture
                </span>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Calibrates the static AST rules and entrypoint-to-sink graph modeling.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { id: 'full_stack', title: 'Full Stack Web App', desc: 'React/Vue frontends + Python/Node APIs with database sinks.', icon: Layers },
                  { id: 'backend_api', title: 'Backend Microservice', desc: 'FastAPI, Express, or Flask REST endpoints & database models.', icon: Cpu },
                  { id: 'scripts', title: 'CLI & Utility Scripts', desc: 'Automation tools, internal utilities, and shell wrappers.', icon: FileCode },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = projectCategory === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setProjectCategory(item.id)}
                      className={isSelected ? 'nd-surface-elevated' : 'nd-surface'}
                      style={{
                        cursor: 'pointer',
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 10,
                        border: isSelected ? '1px solid var(--nd-accent)' : '1px solid var(--nd-border-default)',
                        backgroundColor: isSelected ? 'var(--nd-bg-elevated)' : 'var(--nd-bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Icon size={18} color={isSelected ? 'var(--nd-accent)' : 'var(--nd-text-muted)'} />
                        <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--nd-text-primary)', margin: 0 }}>
                          {item.title}
                        </h4>
                        <p style={{ fontSize: 11, color: 'var(--nd-text-muted)', lineHeight: 1.4, margin: 0 }}>
                          {item.desc}
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: isSelected ? 'var(--nd-accent)' : 'transparent',
                          border: isSelected ? 'none' : '1px solid var(--nd-border-default)',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--nd-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Project Name (Optional)
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., ShopPulse Core API"
                  className="nd-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--nd-border-subtle)' }}>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="nd-btn nd-btn-ghost nd-btn-sm"
                  style={{ color: 'var(--nd-text-muted)' }}
                >
                  Skip to dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="nd-btn nd-btn-primary"
                >
                  <span>Continue to GitHub Ingest</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Connect GitHub Repository (Sole Ingestion Flow) */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <span className="nd-label" style={{ display: 'block', marginBottom: 2 }}>
                  Connect GitHub Repository
                </span>
                <p className="nd-caption" style={{ margin: 0 }}>
                  Enter a public GitHub repository URL. CausalOps clones the repository tree in an isolated sandbox, resolves the exact commit SHA, and scans source code without executing it.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {/* Option 1: ShopPulse Demo */}
                <div className="nd-surface" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Cpu size={15} color="var(--nd-accent)" />
                      <span className="nd-label" style={{ fontSize: 10 }}>Instant Demo</span>
                    </div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--nd-text-primary)', margin: 0 }}>
                      ShopPulse E-Commerce API
                    </h3>
                    <p style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.4, margin: 0 }}>
                      Preloaded fullstack repository with verified SQL Injection, Command Injection, and Hardcoded Secrets to explore immediately.
                    </p>
                  </div>

                  <button
                    onClick={handleFinishWithDemo}
                    disabled={isLoading}
                    className="nd-btn nd-btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {isLoading ? (
                      <>
                        <span className="nd-spinner nd-spinner-sm" />
                        <span>Loading…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} color="var(--nd-accent)" />
                        <span>Load Demo Project</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Option 2: Public GitHub Repo URL */}
                <form onSubmit={handleFinishWithGitHub} className="nd-surface" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FolderGit2 size={15} color="var(--nd-accent)" />
                      <span className="nd-label" style={{ fontSize: 10 }}>Public GitHub Repo</span>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 600, color: 'var(--nd-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Repository URL *
                      </label>
                      <input
                        type="url"
                        required
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/owner/repository"
                        className="nd-input"
                        style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 600, color: 'var(--nd-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Branch
                        </label>
                        <input
                          type="text"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          placeholder="main"
                          className="nd-input"
                          style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 600, color: 'var(--nd-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Commit SHA (Optional)
                        </label>
                        <input
                          type="text"
                          value={commitSha}
                          onChange={(e) => setCommitSha(e.target.value)}
                          placeholder="Latest HEAD"
                          className="nd-input"
                          style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--nd-text-muted)' }}>
                      Quick Test Example:{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setRepoUrl('https://github.com/we45/Vulnerable-Flask-App');
                          setBranch('master');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--nd-accent)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontFamily: 'var(--nd-font-mono)',
                          fontSize: 10,
                        }}
                      >
                        we45/Vulnerable-Flask-App
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !repoUrl.trim()}
                    className="nd-btn nd-btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {isLoading ? (
                      <>
                        <span className="nd-spinner nd-spinner-sm" />
                        <span>Cloning & Analyzing Code…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Connect & Scan Repository</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--nd-border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="nd-btn nd-btn-ghost nd-btn-sm"
                  style={{ gap: 4 }}
                >
                  <ArrowLeft size={13} />
                  <span>Back to Architecture</span>
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="nd-btn nd-btn-ghost nd-btn-sm"
                  style={{ color: 'var(--nd-text-muted)' }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--nd-border-subtle)',
        padding: '12px 24px',
        textAlign: 'center',
        fontSize: 11,
        fontFamily: 'var(--nd-font-mono)',
        color: 'var(--nd-text-muted)',
      }}>
        CausalOps Platform · GitHub Ingestion & Deterministic Causal Security
      </footer>
    </div>
  );
}
