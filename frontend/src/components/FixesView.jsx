import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Check,
  X,
  FileDiff,
  ArrowDown,
  Info,
  Database,
  GitPullRequest,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import { useInvestigationStore } from '../store/investigationStore';
import {
  generateRemediationPatch,
  verifyRemediationPatch,
  publishRemediationPR,
  syncGitHubRepository,
} from '../api/client';
import GitHubSettingsPanel from './GitHubSettingsPanel';

const STATUS_BADGES = {
  OPEN: 'nd-badge nd-badge-neutral',
  FIX_PROPOSED: 'nd-badge nd-badge-medium',
  APPLIED: 'nd-badge nd-badge-info',
  VERIFICATION_FAILED: 'nd-badge nd-badge-critical',
  VERIFIED_FIXED: 'nd-badge nd-badge-low',
};

export default function FixesView() {
  const {
    codebaseScanResult,
    activeFindingId,
    setActiveFindingId,
    updateFindingStatus,
    setGraphData,
    loadProjectData,
    githubStatus,
    checkGitHubStatus,
  } = useInvestigationStore();
  const findings = codebaseScanResult?.findings || [];

  // Default to first finding if none selected
  const activeFinding = findings.find((f) => f.id === activeFindingId) || findings[0] || null;

  // Ensure activeFindingId is synchronized with activeFinding
  React.useEffect(() => {
    if (!activeFindingId && findings.length > 0) {
      setActiveFindingId(findings[0].id);
    }
  }, [activeFindingId, findings.length]);

  const [patchData, setPatchData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);
  const [rejected, setRejected] = useState(false);

  // GitHub integration states
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [showGitHubSettings, setShowGitHubSettings] = useState(false);

  React.useEffect(() => {
    checkGitHubStatus().catch(() => {});
  }, [checkGitHubStatus]);

  // Stale patch protection: immediately clear patch, verification, and errors on finding switch
  React.useEffect(() => {
    setPatchData(null);
    setVerificationResult(null);
    setError(null);
    setRejected(false);
    setPublishError(null);
    setSyncResult(null);
    setSyncError(null);
    if (activeFinding?.evidence_metadata?.pr_url) {
      setPublishResult({
        pull_request_url: activeFinding.evidence_metadata.pr_url,
        pull_request_number: activeFinding.evidence_metadata.pr_number,
        branch_name: activeFinding.evidence_metadata.pr_branch,
        message: 'Existing pull request tracked for this finding.',
      });
    } else {
      setPublishResult(null);
    }
  }, [activeFinding?.id]);

  // Associate patch strictly with active finding: only valid if finding_id matches
  const currentPatchData = (patchData && activeFinding && patchData.finding_id === activeFinding.id)
    ? patchData
    : null;

  // Auto-generate patch when active finding is selected and no patch exists yet
  React.useEffect(() => {
    if (activeFinding && codebaseScanResult && !currentPatchData && !verificationResult && !rejected && !isGenerating) {
      handleGeneratePatch();
    }
  }, [activeFinding?.id, codebaseScanResult?.project_id, rejected]);

  // Reset patch state when the selected finding changes
  const handleSelectFinding = (id) => {
    if (id !== activeFindingId) {
      setActiveFindingId(id);
      setPatchData(null);
      setVerificationResult(null);
      setError(null);
      setRejected(false);
      setPublishError(null);
      setSyncResult(null);
      setSyncError(null);
    }
  };

  const handleGeneratePatch = async () => {
    if (!activeFinding || !codebaseScanResult) return;
    const requestedFindingId = activeFinding.id;
    setIsGenerating(true);
    setVerificationResult(null);
    setError(null);
    setRejected(false);
    try {
      const data = await generateRemediationPatch(
        codebaseScanResult.project_id,
        requestedFindingId
      );
      // Validate that finding has not changed while request was in-flight
      if (data.finding_id === requestedFindingId) {
        setPatchData(data);
        updateFindingStatus(requestedFindingId, 'FIX_PROPOSED');
      }
    } catch (err) {
      setError(err.message || 'Patch generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyFix = async () => {
    if (!currentPatchData || !activeFinding) return;
    if (currentPatchData.finding_id !== activeFinding.id) {
      setError('Patch finding mismatch: current patch does not belong to the selected finding.');
      return;
    }
    setIsApproving(true);
    setError(null);
    try {
      const res = await verifyRemediationPatch(
        codebaseScanResult.project_id,
        activeFinding.id,
        currentPatchData.proposed_code,
        activeFinding.file_path
      );
      setVerificationResult(res);
      if (res.verified) {
        const nextStatus = res.verification_status || (codebaseScanResult?.repository_url ? 'APPLIED' : 'VERIFIED_FIXED');
        updateFindingStatus(activeFinding.id, nextStatus, new Date().toISOString());
        // Invalidate graphData so InvestigationWorkspace re-fetches the updated graph
        setGraphData(null);
      } else {
        updateFindingStatus(activeFinding.id, 'VERIFICATION_FAILED');
      }
    } catch (err) {
      setError(err.message || 'Fix application failed.');
    } finally {
      setIsApproving(false);
    }
  };

  const handlePublishPR = async () => {
    if (!activeFinding || !codebaseScanResult) return;
    if (!githubStatus?.connected) {
      setShowGitHubSettings(true);
      setPublishError('GitHub is not connected. Please connect your GitHub account using the panel below before publishing pull requests.');
      return;
    }
    setIsPublishing(true);
    setPublishError(null);
    try {
      const codeToPublish = currentPatchData?.proposed_code || null;
      const res = await publishRemediationPR(codebaseScanResult.project_id, {
        findingId: activeFinding.id,
        proposedCode: codeToPublish,
        branchName: `causalops/fix-${activeFinding.id.toLowerCase()}`,
        prTitle: `fix(security): remediate ${activeFinding.title} [${activeFinding.cwe_id || activeFinding.id}]`,
      });
      setPublishResult(res);
      if (activeFinding.evidence_metadata) {
        activeFinding.evidence_metadata.pr_url = res.pull_request_url;
        activeFinding.evidence_metadata.pr_number = res.pull_request_number;
        activeFinding.evidence_metadata.pr_branch = res.branch_name;
      }
    } catch (err) {
      setPublishError(err.message || 'GitHub pull request publication failed.');
      if (err.message && (err.message.includes('not configured') || err.message.includes('not connected'))) {
        setShowGitHubSettings(true);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSyncRemote = async () => {
    if (!codebaseScanResult) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const prNumber = publishResult?.pull_request_number || activeFinding?.evidence_metadata?.pr_number || null;
      const res = await syncGitHubRepository(codebaseScanResult.project_id, {
        pullRequestNumber: prNumber,
        branch: codebaseScanResult.branch || 'main',
        forceRescan: true,
      });
      setSyncResult(res);
      if (res.status === 'MERGED_AND_VERIFIED' || res.status === 'SYNCHRONIZED_AND_RESCANNED') {
        setGraphData(null);
        if (loadProjectData) {
          await loadProjectData(codebaseScanResult.project_id);
        }
      }
    } catch (err) {
      setSyncError(err.message || 'Remote synchronization failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRejectPatch = () => {
    setRejected(true);
    setPatchData(null);
    // Revert to OPEN status if rejected
    updateFindingStatus(activeFinding.id, 'OPEN');
  };

  if (!codebaseScanResult) {
    return (
      <div className="nd-workspace" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="nd-empty">
          <FileDiff className="nd-empty-icon" style={{ width: 48, height: 48 }} />
          <span className="nd-subheading">No Codebase Analyzed</span>
          <p className="nd-caption" style={{ maxWidth: 360 }}>
            Scan a codebase first to review proposed security patches and verify remediation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="nd-workspace">
      {/* Top Header */}
      <div className="nd-workspace-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>
            Remediation &amp; Fix Verification
          </span>
          <span className="nd-badge nd-badge-info" style={{ fontFamily: 'var(--nd-font-mono)' }}>
            Gemma 4 Assisted · Deterministically Verified
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="nd-caption">
            Select finding → Review diff → Approve &amp; Verify fix
          </span>
        </div>
      </div>

      {/* Main Workbench */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Finding Selector */}
        <div style={{
          width: 280,
          borderRight: '1px solid var(--nd-border-default)',
          backgroundColor: 'var(--nd-bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: 12,
          gap: 8,
          flexShrink: 0,
        }}>
          <span className="nd-label" style={{ padding: '0 4px', fontSize: 10 }}>
            Findings ({findings.length})
          </span>
          {findings.map((f) => {
            const isSelected = activeFinding?.id === f.id;
            const badgeClass = STATUS_BADGES[f.finding_status] || STATUS_BADGES.OPEN;
            return (
              <div
                key={f.id}
                onClick={() => handleSelectFinding(f.id)}
                style={{
                  cursor: 'pointer',
                  borderRadius: 'var(--nd-radius-md)',
                  border: isSelected ? '1px solid var(--nd-accent)' : '1px solid var(--nd-border-default)',
                  backgroundColor: isSelected ? 'var(--nd-accent-subtle)' : 'var(--nd-bg-base)',
                  padding: 10,
                  transition: 'background-color var(--nd-transition-fast), border-color var(--nd-transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 10, color: 'var(--nd-text-code)', fontWeight: 700 }}>{f.id}</span>
                  <span className="nd-badge nd-badge-neutral" style={{ fontSize: 9 }}>
                    {f.category}
                  </span>
                </div>
                <h4 style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)', margin: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</h4>
                <p style={{ fontSize: 10, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.file_path}:{f.line_start}
                </p>
                <div style={{ marginTop: 6 }}>
                  <span className={badgeClass} style={{ fontSize: 9 }}>
                    {f.finding_status || 'OPEN'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Patch Workbench */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: 12, borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-critical-border)', backgroundColor: 'var(--nd-critical-bg)',
              color: 'var(--nd-critical)', fontSize: 'var(--nd-text-xs)',
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {rejected && !currentPatchData && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: 12, borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-medium-border)', backgroundColor: 'var(--nd-medium-bg)',
              color: 'var(--nd-medium)', fontSize: 'var(--nd-text-xs)',
            }}>
              <X style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>Patch rejected. You can regenerate a new patch at any time.</span>
            </div>
          )}

          {activeFinding && (
            <div className="nd-surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Finding Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <span className="nd-badge nd-badge-critical" style={{ fontSize: 10, fontFamily: 'var(--nd-font-mono)' }}>
                    {activeFinding.category} · {activeFinding.cwe_id}
                  </span>
                  <h2 style={{ fontSize: 'var(--nd-text-lg)', fontWeight: 700, color: 'var(--nd-text-primary)', margin: '8px 0 4px' }}>
                    {activeFinding.title}
                  </h2>
                  <p style={{ fontSize: 'var(--nd-text-xs)', fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-muted)', margin: 0 }}>
                    File: <strong style={{ color: 'var(--nd-text-primary)' }}>{activeFinding.file_path}</strong> · Lines {activeFinding.line_start}–{activeFinding.line_end}
                  </p>
                </div>

                {/* Status Badge */}
                {verificationResult ? (
                  <span className={verificationResult.verified ? 'nd-badge nd-badge-low' : 'nd-badge nd-badge-critical'} style={{ padding: '4px 8px', fontSize: 11 }}>
                    {verificationResult.verified ? (
                      <CheckCircle2 style={{ width: 13, height: 13, marginRight: 4 }} />
                    ) : (
                      <AlertTriangle style={{ width: 13, height: 13, marginRight: 4 }} />
                    )}
                    {verificationResult.verification_status}
                  </span>
                ) : (
                  <span className={STATUS_BADGES[activeFinding.finding_status] || STATUS_BADGES.OPEN} style={{ padding: '4px 8px', fontSize: 11 }}>
                    {activeFinding.finding_status || 'OPEN'}
                  </span>
                )}
              </div>

              {/* Source-to-Sink Evidence Trace */}
              <div style={{
                padding: 12,
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-base)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="nd-label" style={{ fontSize: 10 }}>
                    Source-to-Sink Evidence Trace
                  </span>
                  <span className="nd-badge nd-badge-info" style={{ fontSize: 9 }}>
                    {activeFinding.detection_method === 'python_ast_data_flow'
                      ? 'AST Data Flow Analysis'
                      : (activeFinding.detection_method || 'Deterministic AST Scan')}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
                  <div>
                    <span style={{ color: 'var(--nd-text-muted)' }}>Source Location: </span>
                    <strong style={{ color: 'var(--nd-text-primary)', fontFamily: 'var(--nd-font-mono)' }}>
                      {activeFinding.source_location || `${activeFinding.file_path}:L${activeFinding.line_start}`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--nd-text-muted)' }}>Sink Location: </span>
                    <strong style={{ color: 'var(--nd-text-primary)', fontFamily: 'var(--nd-font-mono)' }}>
                      {activeFinding.sink_location || `${activeFinding.file_path}:L${activeFinding.line_start}`}
                    </strong>
                  </div>
                </div>
                {activeFinding.data_flow_steps && activeFinding.data_flow_steps.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: 'var(--nd-text-muted)', fontWeight: 600 }}>Taint Propagation Steps:</span>
                    <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.5 }}>
                      {activeFinding.data_flow_steps.map((step, idx) => (
                        <li key={idx}>
                          {typeof step === 'object' && step !== null ? (
                            <span>
                              {step.location && <strong style={{ fontFamily: 'var(--nd-font-mono)', marginRight: 6 }}>{step.location}:</strong>}
                              <span>{step.description || step.expression || JSON.stringify(step)}</span>
                            </span>
                          ) : (
                            String(step)
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {activeFinding.evidence_summary && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--nd-text-secondary)' }}>
                    {activeFinding.evidence_summary}
                  </p>
                )}
              </div>

              {/* Vulnerable Code Snippet */}
              {activeFinding.code_snippet && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="nd-label" style={{ fontSize: 10 }}>
                      Vulnerable Code (Line {activeFinding.line_start})
                    </span>
                    {activeFinding.masked_snippet && (
                      <span className="nd-badge nd-badge-neutral" style={{ fontSize: 9 }}>
                        Secret Masked for Security
                      </span>
                    )}
                  </div>
                  <pre style={{
                    borderRadius: 'var(--nd-radius-md)',
                    border: '1px solid var(--nd-critical-border)',
                    backgroundColor: 'var(--nd-critical-bg)',
                    padding: 12,
                    fontFamily: 'var(--nd-font-mono)',
                    fontSize: 'var(--nd-text-xs)',
                    color: 'var(--nd-critical)',
                    overflowX: 'auto',
                    margin: 0,
                  }}>
                    <code>{activeFinding.masked_snippet || activeFinding.code_snippet}</code>
                  </pre>
                </div>
              )}

              {/* Generate Patch Button — shown before patch is generated */}
              {!currentPatchData && !verificationResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid var(--nd-border-subtle)' }}>
                  <button
                    onClick={handleGeneratePatch}
                    disabled={isGenerating}
                    className="nd-btn nd-btn-primary nd-btn-sm"
                  >
                    <Sparkles style={{ width: 13, height: 13 }} className={isGenerating ? 'animate-spin' : ''} />
                    <span>{isGenerating ? 'Generating Patch...' : 'Generate Remediation Patch'}</span>
                  </button>
                  <p className="nd-caption" style={{ margin: 0 }}>
                    Generates a safe code fix. You must explicitly approve before it is applied.
                  </p>
                </div>
              )}

              {/* Patch Diff View — shown after patch is generated */}
              {currentPatchData && !verificationResult && (
                <>
                  {/* Rationale */}
                  <div style={{
                    borderRadius: 'var(--nd-radius-md)',
                    border: '1px solid var(--nd-info-border)',
                    backgroundColor: 'var(--nd-info-bg)',
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="nd-label" style={{ color: 'var(--nd-info)', fontSize: 10 }}>
                        Remediation Rationale
                      </span>
                      <span className={currentPatchData.is_fallback ? 'nd-badge nd-badge-neutral' : 'nd-badge nd-badge-info'} style={{ fontSize: 9 }}>
                        {currentPatchData.is_fallback ? 'Deterministic Fallback' : (currentPatchData.remediation_source || 'Gemma 4')}
                      </span>
                    </div>
                    <p style={{ color: 'var(--nd-text-primary)', fontSize: 'var(--nd-text-xs)', margin: 0, lineHeight: 'var(--nd-leading-base)' }}>
                      {currentPatchData.explanation}
                    </p>
                    {currentPatchData.expected_security_effect && (
                      <div style={{ fontSize: 11, color: 'var(--nd-text-secondary)', borderTop: '1px solid var(--nd-border-subtle)', paddingTop: 6 }}>
                        <strong style={{ color: 'var(--nd-text-primary)' }}>Expected Security Effect: </strong>
                        {currentPatchData.expected_security_effect}
                      </div>
                    )}
                    {currentPatchData.regression_risks && (
                      <div style={{ fontSize: 11, color: 'var(--nd-text-muted)' }}>
                        <strong>Compatibility &amp; Regression Risks: </strong>
                        {currentPatchData.regression_risks}
                      </div>
                    )}
                  </div>

                  {/* Unified Diff */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="nd-label" style={{ fontSize: 10 }}>
                        Proposed Code Diff
                      </span>
                      <span className="nd-caption" style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 10 }}>
                        Unified Patch Format · {activeFinding.file_path}
                      </span>
                    </div>
                    <pre style={{
                      borderRadius: 'var(--nd-radius-md)',
                      border: '1px solid var(--nd-border-default)',
                      backgroundColor: 'var(--nd-bg-base)',
                      padding: 12,
                      fontFamily: 'var(--nd-font-mono)',
                      fontSize: 11,
                      overflowX: 'auto',
                      lineHeight: 1.5,
                      margin: 0,
                    }}>
                      <code>
                        {currentPatchData.diff.split('\n').map((line, idx) => {
                          let color = 'var(--nd-text-secondary)';
                          let fontWeight = 400;
                          if (line.startsWith('+')) { color = 'var(--nd-low)'; fontWeight = 600; }
                          else if (line.startsWith('-')) { color = 'var(--nd-critical)'; fontWeight = 600; }
                          else if (line.startsWith('@')) { color = 'var(--nd-accent)'; }
                          return (
                            <div key={idx} style={{ color, fontWeight }}>
                              {line}
                            </div>
                          );
                        })}
                      </code>
                    </pre>
                  </div>

                  {/* Approval Action Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 14,
                    borderTop: '1px solid var(--nd-border-subtle)',
                    gap: 16,
                  }}>
                    <p className="nd-caption" style={{ margin: 0, maxWidth: 400 }}>
                      Approving will write the patched code to the persisted project source and
                      re-run the scanner to confirm vulnerability elimination.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={handleRejectPatch}
                        disabled={isApproving}
                        className="nd-btn nd-btn-ghost nd-btn-sm"
                      >
                        <X style={{ width: 13, height: 13 }} />
                        <span>Reject Patch</span>
                      </button>
                      <button
                        onClick={handleApplyFix}
                        disabled={isApproving}
                        className="nd-btn nd-btn-primary nd-btn-sm"
                        style={{ backgroundColor: 'var(--nd-low)', borderColor: 'var(--nd-low)' }}
                      >
                        <ShieldCheck style={{ width: 13, height: 13 }} />
                        <span>
                          {isApproving ? 'Applying & Verifying...' : 'Approve & Verify Remediation'}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Verification Success / Failure Result */}
              {verificationResult && (
                <div style={{
                  borderRadius: 'var(--nd-radius-md)',
                  border: verificationResult.verified ? '1px solid var(--nd-low-border)' : '1px solid var(--nd-critical-border)',
                  backgroundColor: verificationResult.verified ? 'var(--nd-low-bg)' : 'var(--nd-critical-bg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {verificationResult.verified ? (
                        <CheckCircle2 style={{ width: 18, height: 18, color: 'var(--nd-low)' }} />
                      ) : (
                        <AlertTriangle style={{ width: 18, height: 18, color: 'var(--nd-critical)' }} />
                      )}
                      <span style={{
                        fontSize: 'var(--nd-text-sm)',
                        fontWeight: 700,
                        color: verificationResult.verified ? 'var(--nd-low)' : 'var(--nd-critical)',
                      }}>
                        {verificationResult.outcome === 'INCONCLUSIVE'
                          ? 'Verification Inconclusive'
                          : verificationResult.verified
                          ? 'Fix Applied & Verified ✓'
                          : 'Verification Failed'}
                      </span>
                    </div>
                    <span className={verificationResult.verified ? 'nd-badge nd-badge-low' : 'nd-badge nd-badge-critical'} style={{ fontSize: 10 }}>
                      {verificationResult.outcome || verificationResult.verification_status}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--nd-text-xs)', color: 'var(--nd-text-primary)', margin: 0 }}>
                    {verificationResult.message}
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, borderTop: '1px solid var(--nd-border-subtle)', paddingTop: 8 }}>
                    <span style={{ color: 'var(--nd-text-secondary)' }}>
                      Syntax: <strong style={{ color: verificationResult.syntax_valid !== false ? 'var(--nd-low)' : 'var(--nd-critical)' }}>
                        {verificationResult.syntax_valid !== false ? 'Valid ✓' : 'Invalid ✗'}
                      </strong>
                    </span>
                    <span style={{ color: 'var(--nd-text-secondary)' }}>
                      Target Finding: <strong style={{ color: verificationResult.target_finding_eliminated !== false ? 'var(--nd-low)' : 'var(--nd-critical)' }}>
                        {verificationResult.target_finding_eliminated !== false ? 'Eliminated ✓' : 'Still Present ✗'}
                      </strong>
                    </span>
                    <span style={{ color: 'var(--nd-text-secondary)' }}>
                      New Findings: <strong style={{ color: verificationResult.new_findings_introduced ? 'var(--nd-critical)' : 'var(--nd-low)' }}>
                        {verificationResult.new_findings_introduced || 0}
                      </strong>
                    </span>
                  </div>
                  {verificationResult.verified && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="nd-surface" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="nd-caption" style={{ textTransform: 'uppercase', fontSize: 9 }}>
                          Remaining Findings (Rescan)
                        </span>
                        <span style={{ fontFamily: 'var(--nd-font-mono)', fontWeight: 700, color: 'var(--nd-medium)', fontSize: 'var(--nd-text-lg)' }}>
                          {verificationResult.rescan_findings_count ?? '—'}
                        </span>
                      </div>
                      <div className="nd-surface" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="nd-caption" style={{ textTransform: 'uppercase', fontSize: 9 }}>
                          3D World Updated
                        </span>
                        <span style={{ fontFamily: 'var(--nd-font-mono)', fontWeight: 700, color: 'var(--nd-low)', fontSize: 'var(--nd-text-lg)' }}>
                          {verificationResult.scenario_regenerated ? 'Yes ✓' : 'Demo Mode'}
                        </span>
                      </div>
                    </div>
                  )}
                  {verificationResult.verified && (
                    <div>
                      <button
                        onClick={handleGeneratePatch}
                        className="nd-btn nd-btn-ghost nd-btn-sm"
                      >
                        <RefreshCw style={{ width: 13, height: 13 }} />
                        <span>Fix Another Finding</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* GitHub Pull Request & Remote Synchronization */}
              {codebaseScanResult?.repository_url && (
                <div className="nd-surface" style={{
                  padding: 16,
                  borderRadius: 'var(--nd-radius-md)',
                  border: '1px solid var(--nd-border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GitPullRequest style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
                      <span style={{ fontSize: 'var(--nd-text-xs)', fontWeight: 600, color: 'var(--nd-text-primary)' }}>
                        GitHub Pull Request &amp; Upstream Sync
                      </span>
                    </div>
                    <span className="nd-badge nd-badge-info" style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 10 }}>
                      Base: {codebaseScanResult.branch || 'main'}
                    </span>
                  </div>

                  {/* Repository Context */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 8,
                    padding: 10,
                    borderRadius: 'var(--nd-radius-sm)',
                    backgroundColor: 'var(--nd-bg-base)',
                    fontSize: 11,
                    fontFamily: 'var(--nd-font-mono)',
                  }}>
                    <div>
                      <span style={{ color: 'var(--nd-text-muted)' }}>Repo: </span>
                      <span style={{ color: 'var(--nd-text-primary)' }}>{codebaseScanResult.repository_url.replace('https://github.com/', '')}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--nd-text-muted)' }}>Remediation Branch: </span>
                      <span style={{ color: 'var(--nd-accent)' }}>causalops/fix-{activeFinding.id.toLowerCase()}</span>
                    </div>
                  </div>

                  {/* GitHub Connection Status Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--nd-radius-sm)',
                    backgroundColor: githubStatus?.connected ? 'var(--nd-low-bg)' : 'var(--nd-medium-bg)',
                    border: githubStatus?.connected ? '1px solid var(--nd-low-border)' : '1px solid var(--nd-medium-border)',
                    fontSize: 11,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {githubStatus?.connected ? (
                        <>
                          <ShieldCheck style={{ width: 14, height: 14, color: 'var(--nd-low)' }} />
                          <span style={{ color: 'var(--nd-text-primary)' }}>
                            Authorized as <strong style={{ color: 'var(--nd-low)' }}>@{githubStatus.github_login}</strong> ({githubStatus.token_hint})
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle style={{ width: 14, height: 14, color: 'var(--nd-medium)' }} />
                          <span style={{ color: 'var(--nd-text-primary)' }}>
                            GitHub not connected. A personal access token is required to publish PRs.
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGitHubSettings(!showGitHubSettings)}
                      className="nd-btn nd-btn-ghost nd-btn-xs"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <KeyRound style={{ width: 12, height: 12 }} />
                      <span>{showGitHubSettings ? 'Hide Credentials' : githubStatus?.connected ? 'Manage Token' : 'Connect GitHub'}</span>
                    </button>
                  </div>

                  {/* Collapsible GitHub Settings Panel */}
                  {showGitHubSettings && (
                    <GitHubSettingsPanel
                      onConnectionChanged={(connected) => {
                        if (connected) {
                          setPublishError(null);
                          setShowGitHubSettings(false);
                        }
                      }}
                    />
                  )}

                  {/* Publish Errors */}
                  {publishError && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: 10, borderRadius: 'var(--nd-radius-sm)',
                      border: '1px solid var(--nd-critical-border)', backgroundColor: 'var(--nd-critical-bg)',
                      color: 'var(--nd-critical)', fontSize: 11,
                    }}>
                      <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                      <span>{publishError}</span>
                    </div>
                  )}

                  {/* Action: Open PR */}
                  {!publishResult ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
                      <p className="nd-caption" style={{ margin: 0 }}>
                        Pushes fix to a dedicated branch and opens a PR with security rationale. Direct pushes to {codebaseScanResult.branch || 'main'} are prohibited.
                      </p>
                      <button
                        onClick={handlePublishPR}
                        disabled={isPublishing || (!verificationResult?.verified && activeFinding.finding_status !== 'VERIFIED_FIXED' && activeFinding.finding_status !== 'APPLIED')}
                        className="nd-btn nd-btn-primary nd-btn-sm"
                        style={{ flexShrink: 0 }}
                        title={!verificationResult?.verified && activeFinding.finding_status !== 'VERIFIED_FIXED' && activeFinding.finding_status !== 'APPLIED' ? 'Verify fix locally before publishing PR' : ''}
                      >
                        <GitPullRequest style={{ width: 13, height: 13 }} />
                        <span>{isPublishing ? 'Publishing PR...' : 'Publish Pull Request'}</span>
                      </button>
                    </div>
                  ) : (
                    /* PR Already Published / Tracked */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 'var(--nd-radius-sm)',
                        backgroundColor: 'var(--nd-info-bg)',
                        border: '1px solid var(--nd-info-border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GitPullRequest style={{ width: 15, height: 15, color: 'var(--nd-info)' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--nd-text-primary)' }}>
                            Pull Request #{publishResult.pull_request_number || activeFinding.evidence_metadata?.pr_number} Active
                          </span>
                        </div>
                        {(publishResult.pull_request_url || activeFinding.evidence_metadata?.pr_url) && (
                          <a
                            href={publishResult.pull_request_url || activeFinding.evidence_metadata?.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nd-btn nd-btn-ghost nd-btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                          >
                            <span>View on GitHub</span>
                            <ExternalLink style={{ width: 12, height: 12 }} />
                          </a>
                        )}
                      </div>

                      {/* Post-Merge Sync Section */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px solid var(--nd-border-subtle)',
                        gap: 12,
                      }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--nd-text-primary)', display: 'block' }}>
                            Post-Merge Verification
                          </span>
                          <p className="nd-caption" style={{ margin: 0 }}>
                            After merging the PR on GitHub, synchronize to ingest upstream commits and verify resolution.
                          </p>
                        </div>
                        <button
                          onClick={handleSyncRemote}
                          disabled={isSyncing}
                          className="nd-btn nd-btn-secondary nd-btn-sm"
                          style={{ flexShrink: 0 }}
                        >
                          <RefreshCw style={{ width: 13, height: 13 }} className={isSyncing ? 'animate-spin' : ''} />
                          <span>{isSyncing ? 'Checking Merge...' : 'Verify PR Merge & Sync'}</span>
                        </button>
                      </div>

                      {/* Sync Feedback */}
                      {syncError && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: 10, borderRadius: 'var(--nd-radius-sm)',
                          border: '1px solid var(--nd-critical-border)', backgroundColor: 'var(--nd-critical-bg)',
                          color: 'var(--nd-critical)', fontSize: 11,
                        }}>
                          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                          <span>{syncError}</span>
                        </div>
                      )}

                      {syncResult && (
                        <div style={{
                          padding: 10,
                          borderRadius: 'var(--nd-radius-sm)',
                          border: syncResult.status === 'MERGED_AND_VERIFIED'
                            ? '1px solid var(--nd-low-border)'
                            : syncResult.status === 'PR_NOT_MERGED'
                            ? '1px solid var(--nd-medium-border)'
                            : '1px solid var(--nd-critical-border)',
                          backgroundColor: syncResult.status === 'MERGED_AND_VERIFIED'
                            ? 'var(--nd-low-bg)'
                            : syncResult.status === 'PR_NOT_MERGED'
                            ? 'var(--nd-medium-bg)'
                            : 'var(--nd-critical-bg)',
                          color: 'var(--nd-text-primary)',
                          fontSize: 11,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            {syncResult.status === 'MERGED_AND_VERIFIED' ? (
                              <>
                                <CheckCircle2 style={{ width: 14, height: 14, color: 'var(--nd-low)' }} />
                                <span style={{ color: 'var(--nd-low)' }}>Merged &amp; Verified Fixed Upstream</span>
                              </>
                            ) : syncResult.status === 'PR_NOT_MERGED' ? (
                              <>
                                <AlertTriangle style={{ width: 14, height: 14, color: 'var(--nd-medium)' }} />
                                <span style={{ color: 'var(--nd-medium)' }}>PR Not Yet Merged on GitHub</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle style={{ width: 14, height: 14, color: 'var(--nd-critical)' }} />
                                <span style={{ color: 'var(--nd-critical)' }}>Sync Check Warning</span>
                              </>
                            )}
                          </div>
                          <p style={{ margin: 0, color: 'var(--nd-text-secondary)' }}>{syncResult.message}</p>
                          {syncResult.commit_sha && (
                            <span style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 10, color: 'var(--nd-text-muted)' }}>
                              Latest Remote Revision: {syncResult.commit_sha}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
