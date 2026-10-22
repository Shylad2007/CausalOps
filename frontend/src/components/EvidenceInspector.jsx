import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestigationStore } from '../store/investigationStore';
import { 
  FileText, 
  Terminal, 
  Server, 
  User, 
  ShieldCheck, 
  AlertTriangle,
  ExternalLink,
  Clock,
  Layers,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Cpu,
  Database,
  Radio,
  Share2,
  Wrench,
} from 'lucide-react';

export default function EvidenceInspector({
  selectedEvent,
  selectedEntity,
  graphData,
  scenario,
  onSelectEntity = () => {},
  onSelectEvent = () => {},
  onClose = () => {},
}) {
  const navigate = useNavigate();
  const { setActiveFindingId } = useInvestigationStore();
  const edges = graphData?.edges || [];
  const events = scenario?.events || [];

  if (!selectedEvent && !selectedEntity) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px 24px',
        textAlign: 'center',
        color: 'var(--nd-text-secondary)',
        gap: 16,
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: 'var(--nd-bg-elevated)',
          border: '1px solid var(--nd-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--nd-text-muted)',
        }}>
          <Layers style={{ width: 22, height: 22 }} />
        </div>
        <div>
          <span style={{ fontSize: 'var(--nd-text-sm)', fontWeight: 600, color: 'var(--nd-text-primary)', display: 'block', marginBottom: 4 }}>
            Evidence &amp; Details Panel
          </span>
          <p style={{ fontSize: 'var(--nd-text-xs)', color: 'var(--nd-text-muted)', lineHeight: 'var(--nd-leading-base)', margin: 0, maxWidth: 240 }}>
            Select any entity in the 3D world or an event in the timeline / 2D graph to inspect its verified telemetry and causal links.
          </p>
        </div>
        <div style={{
          marginTop: 8,
          padding: 12,
          borderRadius: 'var(--nd-radius-md)',
          backgroundColor: 'var(--nd-bg-base)',
          border: '1px solid var(--nd-border-subtle)',
          textAlign: 'left',
          width: '100%',
          fontSize: 11,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--nd-text-primary)' }}>Quick Exploration Tips:</div>
          <div style={{ color: 'var(--nd-text-secondary)' }}>• Click nodes in 3D to view host/service attributes.</div>
          <div style={{ color: 'var(--nd-text-secondary)' }}>• Switch between 3D World and 2D Causal DAG to inspect root-cause chains.</div>
          <div style={{ color: 'var(--nd-text-secondary)' }}>• Click causal links to navigate upstream causes.</div>
        </div>
      </div>
    );
  }

  const severityBadgeClass = (sev) => {
    const s = String(sev || '').toLowerCase();
    if (s === 'critical') return 'nd-badge nd-badge-critical';
    if (s === 'high') return 'nd-badge nd-badge-high';
    if (s === 'medium') return 'nd-badge nd-badge-medium';
    if (s === 'low') return 'nd-badge nd-badge-low';
    return 'nd-badge nd-badge-neutral';
  };

  // Find upstream causes and downstream effects for selected event
  const upstreamEdges = selectedEvent ? edges.filter((e) => e.target === selectedEvent.id) : [];
  const downstreamEdges = selectedEvent ? edges.filter((e) => e.source === selectedEvent.id) : [];

  // Find events related to the selected entity
  const relatedEventsForEntity = selectedEntity
    ? events.filter(
        (e) => e.source_entity_id === selectedEntity.id || e.target_entity_id === selectedEntity.id
      )
    : [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--nd-bg-surface)',
      color: 'var(--nd-text-primary)',
      fontSize: 'var(--nd-text-xs)',
      overflowY: 'auto',
    }}>
      {/* Panel Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--nd-border-default)',
        padding: '12px 16px',
        backgroundColor: 'var(--nd-bg-elevated)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedEvent ? (
            <FileText style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
          ) : (
            <Server style={{ width: 16, height: 16, color: 'var(--nd-accent)' }} />
          )}
          <span style={{ fontWeight: 600, fontSize: 'var(--nd-text-sm)', color: 'var(--nd-text-primary)' }}>
            {selectedEvent ? 'Event Evidence Record' : 'Network Entity Detail'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--nd-text-muted)',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 'var(--nd-radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Clear Selection"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* ── Event Details ─────────────────────────────────────────────── */}
      {selectedEvent && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Header Card */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 'var(--nd-text-sm)', fontWeight: 700, color: 'var(--nd-accent)' }}>
                  {selectedEvent.id}
                </span>
                <span className={severityBadgeClass(selectedEvent.severity)}>
                  {selectedEvent.severity}
                </span>
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--nd-text-muted)',
                backgroundColor: 'var(--nd-bg-base)',
                border: '1px solid var(--nd-border-subtle)',
                borderRadius: 'var(--nd-radius-xs)',
                padding: '2px 6px',
                fontFamily: 'var(--nd-font-mono)',
              }}>
                {selectedEvent.event_type}
              </span>
            </div>

            <p style={{
              fontSize: 'var(--nd-text-sm)',
              fontWeight: 500,
              color: 'var(--nd-text-primary)',
              marginTop: 6,
              lineHeight: 'var(--nd-leading-base)',
            }}>
              {selectedEvent.summary}
            </p>
          </div>

          {/* Provenance Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 'var(--nd-radius-sm)',
            backgroundColor: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            fontSize: 11,
            color: 'var(--nd-text-secondary)',
          }}>
            <Radio style={{ width: 12, height: 12, color: 'var(--nd-accent)', flexShrink: 0 }} />
            <span><strong>Provenance:</strong> Verified Incident Telemetry</span>
          </div>

          {/* Event Context & Metadata */}
          <div style={{
            borderRadius: 'var(--nd-radius-md)',
            border: '1px solid var(--nd-border-default)',
            backgroundColor: 'var(--nd-bg-base)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--nd-text-muted)' }}>Timestamp:</span>
              <span style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-primary)' }}>
                {selectedEvent.timestamp ? new Date(selectedEvent.timestamp).toLocaleString() : 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--nd-text-muted)' }}>Source Node:</span>
              <button
                onClick={() => onSelectEntity(selectedEvent.source_entity_id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--nd-accent)',
                  cursor: 'pointer',
                  fontFamily: 'var(--nd-font-mono)',
                  fontWeight: 600,
                  padding: 0,
                  textDecoration: 'underline',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="Inspect source entity in 3D world"
              >
                <span>{selectedEvent.source_entity_id}</span>
                <ExternalLink style={{ width: 10, height: 10 }} />
              </button>
            </div>

            {selectedEvent.target_entity_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--nd-text-muted)' }}>Target Node:</span>
                <button
                  onClick={() => onSelectEntity(selectedEvent.target_entity_id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--nd-accent)',
                    cursor: 'pointer',
                    fontFamily: 'var(--nd-font-mono)',
                    fontWeight: 600,
                    padding: 0,
                    textDecoration: 'underline',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Inspect target entity in 3D world"
                >
                  <span>{selectedEvent.target_entity_id}</span>
                  <ExternalLink style={{ width: 10, height: 10 }} />
                </button>
              </div>
            )}

            {selectedEvent.actor_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--nd-text-muted)' }}>Actor:</span>
                <span style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-primary)' }}>
                  {selectedEvent.actor_id}
                </span>
              </div>
            )}

            {selectedEvent.session_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--nd-text-muted)' }}>Session:</span>
                <span style={{
                  fontFamily: 'var(--nd-font-mono)',
                  color: 'var(--nd-text-muted)',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {selectedEvent.session_id}
                </span>
              </div>
            )}
          </div>

          {/* ── Causal Connections (Upstream & Downstream) ──────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nd-text-muted)' }}>
              Causal Graph Links
            </span>

            {/* Upstream Causes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--nd-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowLeft style={{ width: 12, height: 12, color: 'var(--nd-medium)' }} />
                Upstream Causes ({upstreamEdges.length}):
              </span>
              {upstreamEdges.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--nd-text-muted)', fontStyle: 'italic', paddingLeft: 8 }}>
                  Root candidate or initial entrypoint (no upstream causes in DAG)
                </div>
              ) : (
                upstreamEdges.map((edge) => (
                  <button
                    key={edge.id}
                    onClick={() => onSelectEvent(edge.source)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      padding: '8px 10px',
                      borderRadius: 'var(--nd-radius-sm)',
                      backgroundColor: 'var(--nd-bg-base)',
                      border: '1px solid var(--nd-border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--nd-accent)';
                      e.currentTarget.style.backgroundColor = 'var(--nd-bg-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--nd-border-subtle)';
                      e.currentTarget.style.backgroundColor = 'var(--nd-bg-base)';
                    }}
                    title={`Jump to cause ${edge.source}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--nd-font-mono)', fontWeight: 700, color: 'var(--nd-accent)', fontSize: 11 }}>
                        {edge.source}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontFamily: 'var(--nd-font-mono)',
                        padding: '1px 5px',
                        borderRadius: 'var(--nd-radius-xs)',
                        backgroundColor: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        color: 'var(--nd-medium)',
                      }}>
                        {edge.rule_name}
                      </span>
                    </div>
                    {edge.explanation && (
                      <span style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.3 }}>
                        {edge.explanation}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Downstream Effects */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--nd-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowRight style={{ width: 12, height: 12, color: 'var(--nd-accent)' }} />
                Downstream Effects ({downstreamEdges.length}):
              </span>
              {downstreamEdges.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--nd-text-muted)', fontStyle: 'italic', paddingLeft: 8 }}>
                  Terminal impact or leaf node (no downstream effects in DAG)
                </div>
              ) : (
                downstreamEdges.map((edge) => (
                  <button
                    key={edge.id}
                    onClick={() => onSelectEvent(edge.target)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      padding: '8px 10px',
                      borderRadius: 'var(--nd-radius-sm)',
                      backgroundColor: 'var(--nd-bg-base)',
                      border: '1px solid var(--nd-border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--nd-accent)';
                      e.currentTarget.style.backgroundColor = 'var(--nd-bg-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--nd-border-subtle)';
                      e.currentTarget.style.backgroundColor = 'var(--nd-bg-base)';
                    }}
                    title={`Jump to effect ${edge.target}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--nd-font-mono)', fontWeight: 700, color: 'var(--nd-accent)', fontSize: 11 }}>
                        {edge.target}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontFamily: 'var(--nd-font-mono)',
                        padding: '1px 5px',
                        borderRadius: 'var(--nd-radius-xs)',
                        backgroundColor: 'rgba(168,85,247,0.1)',
                        border: '1px solid rgba(168,85,247,0.3)',
                        color: '#c084fc',
                      }}>
                        {edge.rule_name}
                      </span>
                    </div>
                    {edge.explanation && (
                      <span style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.3 }}>
                        {edge.explanation}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Process Lineage details if present */}
          {selectedEvent.process_lineage && (
            <div style={{
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-border-default)',
              backgroundColor: 'var(--nd-bg-base)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--nd-text-primary)', fontWeight: 600, fontSize: 11 }}>
                <Terminal style={{ width: 14, height: 14, color: 'var(--nd-accent)' }} />
                <span>Process Lineage Telemetry</span>
              </div>
              <div style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--nd-text-secondary)' }}>
                <div>PID: <span style={{ color: 'var(--nd-text-primary)' }}>{selectedEvent.process_lineage.pid}</span> | PPID: <span style={{ color: 'var(--nd-text-primary)' }}>{selectedEvent.process_lineage.ppid}</span></div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Binary: <span style={{ color: 'var(--nd-text-primary)' }}>{selectedEvent.process_lineage.binary_path}</span>
                </div>
                {selectedEvent.process_lineage.command_line && (
                  <div style={{
                    borderRadius: 'var(--nd-radius-xs)',
                    backgroundColor: 'var(--nd-bg-elevated)',
                    padding: 8,
                    color: 'var(--nd-text-code)',
                    wordBreak: 'break-all',
                    border: '1px solid var(--nd-border-subtle)',
                    marginTop: 4,
                  }}>
                    {selectedEvent.process_lineage.command_line}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Structured Observable Raw Payload */}
          {selectedEvent.observable_data && Object.keys(selectedEvent.observable_data).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--nd-text-secondary)' }}>Observable Metadata:</span>
              <pre style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-base)',
                padding: 10,
                fontFamily: 'var(--nd-font-mono)',
                fontSize: 10,
                color: 'var(--nd-text-secondary)',
                overflowX: 'auto',
                margin: 0,
              }}>
                {JSON.stringify(selectedEvent.observable_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Entity Details ─────────────────────────────────────────────── */}
      {!selectedEvent && selectedEntity && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--nd-font-mono)', fontSize: 'var(--nd-text-sm)', fontWeight: 700, color: 'var(--nd-text-code)' }}>
                {selectedEntity.id}
              </span>
              <span className="nd-badge nd-badge-info">
                {selectedEntity.type}
              </span>
            </div>
            <h4 style={{ fontSize: 'var(--nd-text-base)', fontWeight: 600, color: 'var(--nd-text-primary)', marginTop: 4 }}>
              {selectedEntity.name}
            </h4>
          </div>

          <div style={{
            borderRadius: 'var(--nd-radius-md)',
            border: '1px solid var(--nd-border-default)',
            backgroundColor: 'var(--nd-bg-base)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--nd-text-muted)' }}>Security Zone:</span>
              <span style={{ color: 'var(--nd-text-primary)', fontWeight: 500 }}>{selectedEntity.zone}</span>
            </div>
            {selectedEntity.ip_address && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--nd-text-muted)' }}>IP Address:</span>
                <span style={{ color: 'var(--nd-text-primary)', fontFamily: 'var(--nd-font-mono)' }}>{selectedEntity.ip_address}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--nd-text-muted)' }}>3D Position:</span>
              <span style={{ color: 'var(--nd-text-primary)', fontFamily: 'var(--nd-font-mono)' }}>[{selectedEntity.position_3d?.join(', ')}]</span>
            </div>
          </div>

          {/* Associated Finding / Vulnerability Card */}
          {selectedEntity.finding_id && (
            <div style={{
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid rgba(59,130,246,0.3)',
              backgroundColor: 'rgba(59,130,246,0.06)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--nd-accent)', textTransform: 'uppercase' }}>
                  Targeted Finding
                </span>
                <span className={`nd-badge ${
                  selectedEntity.isSevered ? 'nd-badge-low' : 'nd-badge-critical'
                }`}>
                  {selectedEntity.isSevered ? 'VERIFIED FIXED' : (selectedEntity.severity || 'CRITICAL').toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--nd-text-primary)' }}>
                {selectedEntity.finding_title || selectedEntity.name}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-muted)' }}>
                Finding ID: <span style={{ color: 'var(--nd-text-code)' }}>{selectedEntity.finding_id}</span>
              </div>
              <button
                onClick={() => {
                  setActiveFindingId(selectedEntity.finding_id);
                  navigate('/dashboard/fixes');
                }}
                className="nd-btn nd-btn-primary nd-btn-sm"
                style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Wrench size={12} />
                <span>Open in Remediation</span>
              </button>
            </div>
          )}

          {/* Related Events on this Entity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nd-text-muted)' }}>
              Events On This Asset ({relatedEventsForEntity.length})
            </span>
            {relatedEventsForEntity.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--nd-text-muted)', fontStyle: 'italic' }}>
                No recorded incident telemetry events directly target this asset.
              </div>
            ) : (
              relatedEventsForEntity.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => onSelectEvent(evt.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    padding: '8px 10px',
                    borderRadius: 'var(--nd-radius-sm)',
                    backgroundColor: 'var(--nd-bg-base)',
                    border: '1px solid var(--nd-border-subtle)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--nd-accent)';
                    e.currentTarget.style.backgroundColor = 'var(--nd-bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--nd-border-subtle)';
                    e.currentTarget.style.backgroundColor = 'var(--nd-bg-base)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--nd-font-mono)', fontWeight: 700, color: 'var(--nd-accent)', fontSize: 11 }}>
                      {evt.id}
                    </span>
                    <span className={severityBadgeClass(evt.severity)}>
                      {evt.severity}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--nd-text-secondary)', lineHeight: 1.3 }}>
                    {evt.summary}
                  </span>
                </button>
              ))
            )}
          </div>

          {selectedEntity.attributes && Object.keys(selectedEntity.attributes).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--nd-text-secondary)' }}>Asset Attributes:</span>
              <pre style={{
                borderRadius: 'var(--nd-radius-md)',
                border: '1px solid var(--nd-border-default)',
                backgroundColor: 'var(--nd-bg-base)',
                padding: 10,
                fontFamily: 'var(--nd-font-mono)',
                fontSize: 10,
                color: 'var(--nd-text-secondary)',
                overflowX: 'auto',
                margin: 0,
              }}>
                {JSON.stringify(selectedEntity.attributes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
