import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { connectGitHubToken, disconnectGitHub, fetchGitHubStatus } from '../api/client';

export default function GitHubSettingsPanel({ onConnectionChanged = null }) {
  const { githubStatus, checkGitHubStatus } = useInvestigationStore();

  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);

  useEffect(() => {
    if (!githubStatus) {
      checkGitHubStatus().catch(() => {});
    }
  }, [githubStatus, checkGitHubStatus]);

  const handleConnect = async (e) => {
    e?.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please enter a valid GitHub Personal Access Token.');
      return;
    }
    setIsConnecting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await connectGitHubToken(tokenInput.trim());
      await checkGitHubStatus();
      setTokenInput('');
      setIsUpdatingToken(false);
      setSuccessMsg(`Successfully connected GitHub account @${res.github_login}.`);
      if (onConnectionChanged) onConnectionChanged(true);
    } catch (err) {
      setError(err.message || 'Failed to authorize GitHub token.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your GitHub account? Stored tokens will be permanently deleted.')) {
      return;
    }
    setIsDisconnecting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await disconnectGitHub();
      await checkGitHubStatus();
      setSuccessMsg('GitHub account disconnected. Credentials removed from secure storage.');
      if (onConnectionChanged) onConnectionChanged(false);
    } catch (err) {
      setError(err.message || 'Failed to disconnect GitHub account.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = githubStatus?.connected;

  return (
    <div
      className="nd-surface"
      style={{
        padding: 16,
        borderRadius: 'var(--nd-radius-md)',
        border: '1px solid var(--nd-border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderGit2 style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
          <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>
            GitHub Connection &amp; Authentication
          </span>
        </div>
        <span
          className={isConnected ? 'nd-badge nd-badge-low' : 'nd-badge nd-badge-neutral'}
          style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 10 }}
        >
          {isConnected ? `Connected @${githubStatus.github_login}` : 'Not Connected'}
        </span>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            borderRadius: 'var(--nd-radius-sm)',
            border: '1px solid var(--nd-critical-border)',
            backgroundColor: 'var(--nd-critical-bg)',
            color: 'var(--nd-critical)',
            fontSize: 11,
          }}
        >
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            borderRadius: 'var(--nd-radius-sm)',
            border: '1px solid var(--nd-low-border)',
            backgroundColor: 'var(--nd-low-bg)',
            color: 'var(--nd-low)',
            fontSize: 11,
          }}
        >
          <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Connected State Card */}
      {isConnected && !isUpdatingToken ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8,
              padding: 10,
              borderRadius: 'var(--nd-radius-sm)',
              backgroundColor: 'var(--nd-bg-base)',
              fontSize: 11,
              fontFamily: 'var(--nd-font-mono)',
            }}
          >
            <div>
              <span style={{ color: 'var(--nd-text-muted)' }}>GitHub User: </span>
              <span style={{ color: 'var(--nd-text-primary)', fontWeight: 600 }}>@{githubStatus.github_login}</span>
            </div>
            <div>
              <span style={{ color: 'var(--nd-text-muted)' }}>Token (Encrypted at rest): </span>
              <span style={{ color: 'var(--nd-accent)' }}>{githubStatus.token_hint || '••••••••'}</span>
            </div>
            {githubStatus.scopes?.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--nd-text-muted)' }}>Authorized Scopes: </span>
                <span style={{ color: 'var(--nd-text-secondary)' }}>{githubStatus.scopes.join(', ')}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            <p className="nd-caption" style={{ margin: 0 }}>
              Credentials are encrypted at rest with Fernet on the backend and reused for PR publishing &amp; sync.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsUpdatingToken(true)}
                className="nd-btn nd-btn-ghost nd-btn-xs"
              >
                <KeyRound style={{ width: 12, height: 12 }} />
                <span>Update Token</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="nd-btn nd-btn-ghost nd-btn-xs"
                style={{ color: 'var(--nd-critical)' }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
                <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Disconnected or Updating State */
        <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="nd-caption" style={{ margin: 0, lineHeight: 1.5 }}>
            Authorize GitHub once to enable publishing remediation pull requests and syncing code changes.
            Requires a Personal Access Token with <strong style={{ color: 'var(--nd-text-primary)' }}>repo</strong> scope.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="nd-label" style={{ fontSize: 10 }}>
                GitHub Personal Access Token (classic or fine-grained)
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=CausalOps"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 10,
                  color: 'var(--nd-accent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  textDecoration: 'none',
                }}
              >
                <span>Generate token on GitHub</span>
                <ExternalLink style={{ width: 10, height: 10 }} />
              </a>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                className="nd-input"
                style={{ width: '100%', paddingRight: 36, fontFamily: 'var(--nd-font-mono)', fontSize: 11 }}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--nd-text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock style={{ width: 12, height: 12, color: 'var(--nd-low)' }} />
              <span className="nd-caption" style={{ fontSize: 10 }}>
                Encrypted at rest on backend · Never exposed to browser or logs
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isUpdatingToken && (
                <button
                  type="button"
                  onClick={() => setIsUpdatingToken(false)}
                  className="nd-btn nd-btn-ghost nd-btn-sm"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isConnecting || !tokenInput.trim()}
                className="nd-btn nd-btn-primary nd-btn-sm"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" />
                    <span>Validating &amp; Saving...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck style={{ width: 13, height: 13 }} />
                    <span>Authorize &amp; Connect GitHub</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
