import React, { useState } from 'react';
import {
  FolderGit2,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  GitCommit,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Info,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { connectGitHubRepo } from '../api/client';

export default function ConnectGitHubModal({ isOpen, onClose }) {
  const {
    currentUser,
    setCodebaseScanResult,
    setActiveFindingId,
    fetchUserProjects,
    loadProjectData,
  } = useInvestigationStore();

  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [branch, setBranch] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isLoading) return;
    // Clear sensitive credential material upon close
    setToken('');
    setShowToken(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUrl = repoUrl.trim();
    if (!cleanUrl) {
      setError('Please provide a valid GitHub repository URL.');
      return;
    }

    // Client-side pre-validation
    const ghPattern = /^https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\.git)?\/?$/;
    if (!ghPattern.test(cleanUrl) || cleanUrl.includes('@') || cleanUrl.includes('..')) {
      setError("URL must match format: https://github.com/{owner}/{repo} without credentials or parameters.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await connectGitHubRepo({
        repo_url: cleanUrl,
        token: token.trim() || null,
        branch: branch.trim() || null,
        commit_sha: commitSha.trim() || null,
        project_name: projectName.trim() || null,
        owner_username: currentUser?.username || null,
      });

      // Clear token from memory immediately after successful API call
      setToken('');
      setShowToken(false);

      setCodebaseScanResult(res);
      if (res.findings?.length > 0) setActiveFindingId(res.findings[0].id);
      if (res.project_id) await loadProjectData(res.project_id);
      await fetchUserProjects(currentUser?.username);
      onClose();
    } catch (err) {
      setError(err.message || 'GitHub repository connection and validation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(5px)',
        padding: 16,
      }}
    >
      <div
        className="nd-surface nd-animate-fade-up"
        style={{
          width: '100%',
          maxWidth: 540,
          borderRadius: 'var(--nd-radius-xl)',
          border: '1px solid var(--nd-border-default)',
          boxShadow: 'var(--nd-shadow-lg)',
          padding: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxHeight: '92vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Top accent highlight */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent 0%, var(--nd-accent) 50%, transparent 100%)',
          opacity: 0.6,
        }} />

        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--nd-border-subtle)',
            paddingBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              backgroundColor: 'var(--nd-accent-subtle)',
              border: '1px solid var(--nd-accent-border)',
              borderRadius: 'var(--nd-radius-md)',
            }}>
              <FolderGit2 style={{ width: 18, height: 18, color: 'var(--nd-accent)' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--nd-text-primary)' }}>
                Connect GitHub Repository
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--nd-text-secondary)' }}>
                Secure, single-repository connection and automated AST security scan.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="nd-btn nd-btn-ghost nd-btn-xs"
            aria-label="Close modal"
            style={{ padding: 4 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Security / Token Scope Guidance Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            backgroundColor: 'var(--nd-accent-subtle)',
            border: '1px solid var(--nd-accent-border)',
            borderRadius: 'var(--nd-radius-md)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--nd-text-secondary)',
          }}
        >
          <Info size={15} color="var(--nd-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: 'var(--nd-text-primary)' }}>Repository-Scoped Connection:</strong>{' '}
            CausalOps connects to one repository at a time. Use a GitHub fine-grained token with{' '}
            <span style={{ color: 'var(--nd-text-primary)' }}>'Only select repositories'</span> restricted to this target, with{' '}
            <span style={{ color: 'var(--nd-text-primary)' }}>'Contents: Read-only'</span> permission.
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="nd-animate-fade-in"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-critical-border)',
              backgroundColor: 'var(--nd-critical-bg)',
              color: 'var(--nd-critical)',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Validation Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Ingestion & Connection Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Repository URL (Required) */}
          <div>
            <label htmlFor="connect-repo-url" className="nd-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              GitHub Repository URL <span style={{ color: 'var(--nd-accent)' }}>*</span>
            </label>
            <input
              id="connect-repo-url"
              type="url"
              required
              disabled={isLoading}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="nd-input"
              style={{ width: '100%', fontFamily: 'var(--nd-font-mono)', fontSize: 12 }}
              autoFocus
            />
            <p className="nd-caption" style={{ margin: '4px 0 0', fontSize: 11 }}>
              Target GitHub repository URL (public or private).
            </p>
          </div>

          {/* Repository-Scoped Access Token (Password Input with Visibility Toggle) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label htmlFor="connect-repo-token" className="nd-label" style={{ fontSize: 11, margin: 0 }}>
                Repository Access Token <span style={{ color: 'var(--nd-accent)' }}>*</span>
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock
                size={14}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--nd-text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="connect-repo-token"
                type={showToken ? 'text' : 'password'}
                required
                disabled={isLoading}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_... or ghp_..."
                className="nd-input"
                style={{
                  width: '100%',
                  paddingLeft: 36,
                  paddingRight: 40,
                  fontFamily: 'var(--nd-font-mono)',
                  fontSize: 12,
                }}
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                disabled={isLoading}
                aria-label={showToken ? 'Hide token' : 'Show token'}
                title={showToken ? 'Hide token' : 'Show token'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--nd-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                }}
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="nd-caption" style={{ margin: '4px 0 0', fontSize: 11 }}>
              Token is verified server-side against this exact repository and never logged.
            </p>
          </div>

          {/* Branch & Commit SHA (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="connect-repo-branch" className="nd-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                Branch <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--nd-text-muted)' }}>(optional)</span>
              </label>
              <input
                id="connect-repo-branch"
                type="text"
                disabled={isLoading}
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Defaults to default branch"
                className="nd-input"
                style={{ width: '100%', fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}
              />
            </div>
            <div>
              <label htmlFor="connect-repo-commit" className="nd-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                Commit SHA <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--nd-text-muted)' }}>(optional)</span>
              </label>
              <input
                id="connect-repo-commit"
                type="text"
                disabled={isLoading}
                value={commitSha}
                onChange={(e) => setCommitSha(e.target.value)}
                placeholder="Defaults to branch HEAD"
                className="nd-input"
                style={{ width: '100%', fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}
              />
            </div>
          </div>

          {/* Project Name (Optional) */}
          <div>
            <label htmlFor="connect-project-name" className="nd-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Project Display Name <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--nd-text-muted)' }}>(optional)</span>
            </label>
            <input
              id="connect-project-name"
              type="text"
              disabled={isLoading}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Production Service (defaults to owner/repo)"
              className="nd-input"
              style={{ width: '100%', fontSize: 12 }}
            />
          </div>

          {/* Quick Test Repository Helper */}
          <div
            style={{
              borderRadius: 'var(--nd-radius-md)',
              backgroundColor: 'var(--nd-bg-base)',
              border: '1px solid var(--nd-border-subtle)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--nd-text-muted)' }}>Quick Test Example:</span>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setRepoUrl('https://github.com/we45/Vulnerable-Flask-App');
                setBranch('master');
                setProjectName('Vulnerable Flask App');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--nd-accent)',
                cursor: 'pointer',
                fontFamily: 'var(--nd-font-mono)',
                fontSize: 11,
                textDecoration: 'underline',
              }}
            >
              we45/Vulnerable-Flask-App
            </button>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 10,
              borderTop: '1px solid var(--nd-border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="nd-btn nd-btn-ghost nd-btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !repoUrl.trim()}
              className="nd-btn nd-btn-primary nd-btn-sm"
              id="submit-connect-repo"
              style={{ minWidth: 180, justifyContent: 'center' }}
            >
              {isLoading ? (
                <>
                  <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" />
                  <span>Validating &amp; Scanning...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 style={{ width: 14, height: 14 }} />
                  <span>Connect &amp; Scan Repository</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
