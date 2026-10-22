import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  FolderGit2,
  Activity,
  ShieldAlert,
  GitFork,
  Award,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  GitBranch,
  GitCommit,
  PlusCircle,
  ShieldCheck,
  ShieldX,
  ExternalLink,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import { fetchProjectsSummary } from '../api/client';

// Core workspace capabilities — user-facing labels
const WORKSPACES = [
  {
    to: '/dashboard/investigation',
    label: 'Investigation Workspace',
    icon: Activity,
    description: 'Explore the 3D architecture and trace attack paths in the 2D causal graph with chronological replay.',
    accent: 'var(--nd-accent)',
    accentBg: 'var(--nd-accent-subtle)',
    accentBorder: 'var(--nd-accent-border)',
  },
  {
    to: '/dashboard/hypotheses',
    label: 'Competing Hypotheses',
    icon: ShieldAlert,
    description: 'Evaluate AI-generated root-cause explanations ranked by supporting evidence and contradiction checks.',
    accent: '#8b5cf6',
    accentBg: 'rgba(139,92,246,0.10)',
    accentBorder: 'rgba(139,92,246,0.25)',
  },
  {
    to: '/dashboard/counterfactual',
    label: 'Counterfactual Lab',
    icon: GitFork,
    description: 'Test "what-if" mutations on the incident graph and verify whether removing an event prevents the breach.',
    accent: 'var(--nd-medium)',
    accentBg: 'var(--nd-medium-bg)',
    accentBorder: 'var(--nd-medium-border)',
  },
  {
    to: '/dashboard/scorecard',
    label: 'Investigation Scorecard',
    icon: Award,
    description: 'Review citation-backed evidence, audit AI claims for provenance, and inspect confidence metrics.',
    accent: 'var(--nd-low)',
    accentBg: 'var(--nd-low-bg)',
    accentBorder: 'var(--nd-low-border)',
  },
  {
    to: '/dashboard/fixes',
    label: 'Remediation',
    icon: Wrench,
    description: 'Review proposed patches side-by-side, approve fixes, and verify their effectiveness with re-scan.',
    accent: 'var(--nd-accent)',
    accentBg: 'var(--nd-accent-subtle)',
    accentBorder: 'var(--nd-accent-border)',
  },
];

// Severity count badge helper
function SeverityBadge({ count, label, variant }) {
  const variants = {
    critical: { color: 'var(--nd-critical)', bg: 'var(--nd-critical-bg)', border: 'var(--nd-critical-border)' },
    high:     { color: 'var(--nd-high)',     bg: 'var(--nd-high-bg)',     border: 'var(--nd-high-border)'     },
    medium:   { color: 'var(--nd-medium)',   bg: 'var(--nd-medium-bg)',   border: 'var(--nd-medium-border)'   },
    low:      { color: 'var(--nd-low)',      bg: 'var(--nd-low-bg)',      border: 'var(--nd-low-border)'      },
    neutral:  { color: 'var(--nd-text-secondary)', bg: 'var(--nd-bg-hover)', border: 'var(--nd-border-default)' },
  };
  const v = variants[variant] || variants.neutral;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 12px',
      backgroundColor: v.bg, border: `1px solid ${v.border}`,
      borderRadius: 'var(--nd-radius-md)',
      minWidth: 64,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: v.color, lineHeight: 1 }}>{count ?? 0}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const onOpenConnectModal = outletCtx.onOpenConnectModal;

  const {
    currentUser,
    activeProjectId,
    codebaseScanResult,
    loadProjectData,
  } = useInvestigationStore();

  const [projects, setProjects] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const loadAllProjects = async () => {
    setIsLoadingList(true);
    setFetchError(null);
    try {
      const list = await fetchProjectsSummary(currentUser?.username);
      // Strict user isolation & clean separation: filter to real user-owned repositories
      const rawList = Array.isArray(list) ? list : [];
      const userProjects = rawList.filter((p) => {
        if (p.is_demo) return false;
        if (currentUser?.username && p.owner_username) {
          return p.owner_username.toLowerCase() === currentUser.username.toLowerCase();
        }
        return true;
      });
      setProjects(userProjects);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setFetchError(err.message || 'Failed to load projects');
      setProjects([]);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadAllProjects();
  }, [currentUser?.username, activeProjectId]);

  const handleSelectProject = async (projId) => {
    setLoadingProjectId(projId);
    try {
      await loadProjectData(projId);
      navigate('/dashboard/investigation');
    } finally {
      setLoadingProjectId(null);
    }
  };

  const hasProjects = projects.length > 0;
  const findings = codebaseScanResult?.findings || [];
  const openCount = codebaseScanResult?.open_findings_count ?? findings.filter((f) => f.finding_status !== 'VERIFIED_FIXED').length;
  const fixedCount = codebaseScanResult?.fixed_findings_count ?? findings.filter((f) => f.finding_status === 'VERIFIED_FIXED').length;
  const totalFindings = codebaseScanResult?.total_findings ?? findings.length;

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      backgroundColor: 'var(--nd-bg-base)',
      fontFamily: 'var(--nd-font-sans)',
      color: 'var(--nd-text-primary)',
    }}>
      <div style={{ maxWidth: 'var(--nd-content-max)', margin: '0 auto', padding: '24px 24px 48px' }}>

        {/* ── Dashboard Header ─────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 28,
          paddingBottom: 18,
          borderBottom: '1px solid var(--nd-border-subtle)',
          flexWrap: 'wrap',
          gap: 14,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="nd-badge nd-badge-info" style={{ fontSize: 10, letterSpacing: '0.06em' }}>
                WORKSPACE
              </span>
              <span style={{ fontSize: 12, color: 'var(--nd-text-muted)', fontFamily: 'var(--nd-font-mono)' }}>
                {currentUser?.username ? `@${currentUser.username}` : ''}
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--nd-text-primary)', margin: 0, letterSpacing: '-0.015em' }}>
              Security Project Dashboard
            </h1>
            <p style={{ fontSize: 13, color: 'var(--nd-text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
              Connect repositories, inspect real findings with code evidence, and verify deterministic fixes.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={loadAllProjects}
              disabled={isLoadingList}
              className="nd-btn nd-btn-ghost nd-btn-sm"
              title="Refresh project list"
            >
              <RefreshCw size={13} style={{ animation: isLoadingList ? 'nd-spin 0.7s linear infinite' : 'none' }} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onOpenConnectModal}
              className="nd-btn nd-btn-primary nd-btn-sm"
              id="projects-connect-repo"
              style={{ boxShadow: '0 0 14px rgba(59,130,246,0.2)' }}
            >
              <PlusCircle size={14} />
              <span>Connect GitHub repository</span>
            </button>
          </div>
        </div>

        {/* ── Error Banner ─────────────────────────────────────────── */}
        {fetchError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              backgroundColor: 'var(--nd-critical-bg)',
              border: '1px solid var(--nd-critical-border)',
              borderRadius: 'var(--nd-radius-md)',
              color: 'var(--nd-critical)',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>Failed to synchronize repository list: {fetchError}</span>
          </div>
        )}

        {/* ── Empty State for New Users (No Repositories Connected) ── */}
        {!isLoadingList && !hasProjects && (
          <div
            className="nd-surface nd-animate-fade-up"
            style={{
              padding: '56px 32px',
              textAlign: 'center',
              maxWidth: 620,
              margin: '36px auto',
              borderRadius: 'var(--nd-radius-xl)',
              boxShadow: 'var(--nd-shadow-lg)',
              border: '1px solid var(--nd-border-default)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle top accent gradient */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 2,
              background: 'linear-gradient(90deg, transparent 0%, var(--nd-accent) 50%, transparent 100%)',
              opacity: 0.6,
            }} />

            {/* Icon */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 58,
              height: 58,
              marginBottom: 20,
              backgroundColor: 'var(--nd-accent-subtle)',
              border: '1px solid var(--nd-accent-border)',
              borderRadius: 'var(--nd-radius-xl)',
              boxShadow: '0 0 24px rgba(59,130,246,0.18)',
            }}>
              <FolderGit2 size={28} color="var(--nd-accent)" />
            </div>

            {/* Mandatory Exact Heading */}
            <h2 style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--nd-text-primary)',
              margin: '0 0 10px',
              letterSpacing: '-0.02em',
            }}>
              Secure your codebase
            </h2>

            {/* Mandatory Exact Supporting Text */}
            <p style={{
              fontSize: 14,
              color: 'var(--nd-text-secondary)',
              maxWidth: 480,
              margin: '0 auto 28px',
              lineHeight: 1.6,
            }}>
              Connect a GitHub repository to scan for vulnerabilities, investigate findings, and verify fixes.
            </p>

            {/* Mandatory Exact Primary Action */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={onOpenConnectModal}
                className="nd-btn nd-btn-primary nd-btn-lg"
                id="empty-connect-github-btn"
                style={{
                  padding: '12px 28px',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: '0 0 18px rgba(59,130,246,0.25)',
                }}
              >
                <PlusCircle size={16} />
                <span>Connect GitHub repository</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Returning Users: Active Project View & Workspaces ─────── */}
        {hasProjects && (
          <div>
            {/* Active Project Card */}
            {activeProjectId && codebaseScanResult && (
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--nd-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Active Investigation Target
                  </span>
                  <span className="nd-badge nd-badge-info" style={{ fontSize: 10 }}>
                    Status: {codebaseScanResult.status || 'COMPLETED'}
                  </span>
                </div>

                <div className="nd-surface" style={{
                  borderRadius: 'var(--nd-radius-xl)',
                  padding: 24,
                  border: '1px solid var(--nd-border-default)',
                }}>
                  {/* Top row: Project identity */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginBottom: 20,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 44, height: 44, flexShrink: 0,
                        backgroundColor: 'var(--nd-accent-subtle)',
                        border: '1px solid var(--nd-accent-border)',
                        borderRadius: 'var(--nd-radius-lg)',
                      }}>
                        <FolderGit2 size={20} color="var(--nd-accent)" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--nd-text-primary)', margin: 0 }}>
                            {codebaseScanResult.project_name || activeProjectId}
                          </h2>
                          <span className="nd-badge nd-badge-low" style={{ fontSize: 10 }}>
                            Connected
                          </span>
                        </div>

                        {/* Metadata pills */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 12,
                          fontSize: 12,
                          color: 'var(--nd-text-muted)',
                        }}>
                          {codebaseScanResult.repository_url && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-code)' }}>
                              <GitBranch size={13} />
                              {codebaseScanResult.repository_url}
                              {codebaseScanResult.branch && ` (${codebaseScanResult.branch})`}
                            </span>
                          )}
                          {codebaseScanResult.commit_sha && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--nd-font-mono)' }}>
                              <GitCommit size={13} />
                              {codebaseScanResult.commit_sha.substring(0, 8)}
                            </span>
                          )}
                          {codebaseScanResult.scan_timestamp && (
                            <span>
                              Scanned {new Date(codebaseScanResult.scan_timestamp).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate('/dashboard/investigation')}
                      className="nd-btn nd-btn-primary"
                      style={{ gap: 8 }}
                    >
                      <span>Open Workspace</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Findings breakdown / zero-findings indicator */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 10,
                    paddingTop: 16,
                    borderTop: '1px solid var(--nd-border-subtle)',
                  }}>
                    {totalFindings === 0 ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        backgroundColor: 'var(--nd-low-bg)',
                        border: '1px solid var(--nd-low-border)',
                        borderRadius: 'var(--nd-radius-md)',
                        fontSize: 13,
                        color: 'var(--nd-low)',
                        fontWeight: 500,
                      }}>
                        <CheckCircle2 size={16} />
                        <span>Deterministic scan passed: 0 security vulnerabilities detected in repository tree.</span>
                      </div>
                    ) : (
                      <>
                        <SeverityBadge count={totalFindings} label="Total" variant="neutral" />
                        <SeverityBadge count={codebaseScanResult.critical_count} label="Critical" variant="critical" />
                        <SeverityBadge count={codebaseScanResult.high_count} label="High" variant="high" />
                        <SeverityBadge count={openCount} label="Open" variant="medium" />
                        <SeverityBadge count={fixedCount} label="Fixed" variant="low" />
                        {codebaseScanResult.manifest?.detected_languages?.length > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            backgroundColor: 'var(--nd-bg-hover)',
                            border: '1px solid var(--nd-border-default)',
                            borderRadius: 'var(--nd-radius-md)',
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lang</span>
                            <span style={{ fontSize: 11, color: 'var(--nd-text-secondary)', fontFamily: 'var(--nd-font-mono)' }}>
                              {codebaseScanResult.manifest.detected_languages.join(', ')}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Core Capability Workspace Cards */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--nd-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                Investigation &amp; Remediation Modules
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                {WORKSPACES.map(({ to, label, icon: Icon, description, accent, accentBg, accentBorder }) => (
                  <div
                    key={to}
                    onClick={() => navigate(to)}
                    style={{
                      backgroundColor: 'var(--nd-bg-surface)',
                      border: '1px solid var(--nd-border-default)',
                      borderRadius: 'var(--nd-radius-lg)',
                      padding: 18,
                      cursor: 'pointer',
                      transition: 'border-color var(--nd-transition-fast), background-color var(--nd-transition-fast), transform var(--nd-transition-fast)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = accentBorder;
                      e.currentTarget.style.backgroundColor = 'var(--nd-bg-elevated)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--nd-border-default)';
                      e.currentTarget.style.backgroundColor = 'var(--nd-bg-surface)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36,
                        backgroundColor: accentBg,
                        border: `1px solid ${accentBorder}`,
                        borderRadius: 'var(--nd-radius-md)',
                      }}>
                        <Icon size={18} color={accent} />
                      </div>
                      <ArrowRight size={14} color="var(--nd-text-muted)" />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nd-text-primary)' }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--nd-text-secondary)', lineHeight: 1.5 }}>{description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Repositories List */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--nd-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Connected Repositories ({projects.length})
                </div>
              </div>

              <div className="nd-surface" style={{
                borderRadius: 'var(--nd-radius-xl)',
                border: '1px solid var(--nd-border-default)',
                overflow: 'hidden',
              }}>
                {projects.map((proj, idx) => {
                  const isActive = proj.project_id === activeProjectId;
                  const isLoadingThis = loadingProjectId === proj.project_id;
                  return (
                    <div
                      key={proj.project_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '14px 18px',
                        borderBottom: idx < projects.length - 1 ? '1px solid var(--nd-border-subtle)' : 'none',
                        backgroundColor: isActive ? 'var(--nd-accent-subtle)' : 'transparent',
                        transition: 'background-color var(--nd-transition-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <FolderGit2
                          size={16}
                          color={isActive ? 'var(--nd-accent)' : 'var(--nd-text-muted)'}
                          style={{ flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: 'var(--nd-text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {proj.project_name}
                            </span>
                            {isActive && <span className="nd-badge nd-badge-info">Active</span>}
                            <span className="nd-badge nd-badge-neutral" style={{ fontSize: 10 }}>
                              {proj.status || 'COMPLETED'}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 12,
                            fontSize: 12,
                            color: 'var(--nd-text-muted)',
                          }}>
                            {proj.repository_url && (
                              <span style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                                {proj.repository_url}
                              </span>
                            )}
                            <span>{proj.open_findings_count} open · {proj.fixed_findings_count} fixed</span>
                            {proj.scan_timestamp && (
                              <span>Scanned {new Date(proj.scan_timestamp).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {isActive ? (
                          <button
                            onClick={() => navigate('/dashboard/investigation')}
                            className="nd-btn nd-btn-primary nd-btn-sm"
                          >
                            <span>Investigate</span>
                            <ArrowRight size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectProject(proj.project_id)}
                            disabled={!!loadingProjectId}
                            className="nd-btn nd-btn-ghost nd-btn-sm"
                          >
                            {isLoadingThis ? (
                              <>
                                <span className="nd-spinner nd-spinner-sm" />
                                <span>Loading…</span>
                              </>
                            ) : (
                              'Select'
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
