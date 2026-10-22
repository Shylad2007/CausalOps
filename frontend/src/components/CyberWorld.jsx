import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import CyberNode from './CyberNode';
import CyberLink from './CyberLink';

const ENTITY_TYPE_LABELS = {
  user: { label: 'USR', color: '#06b6d4' },
  workstation: { label: 'HOST', color: '#3b82f6' },
  server: { label: 'SRV', color: '#8b5cf6' },
  database: { label: 'DB', color: '#ec4899' },
  identity_provider: { label: 'IDP', color: '#10b981' },
  session_token: { label: 'TOKEN', color: '#f59e0b' },
  process: { label: 'PROC', color: '#f43f5e' },
};

export default function CyberWorld({
  entities = [],
  events = [],
  currentEvent = null,
  selectedEntityId = null,
  onSelectEntity = () => {},
  customLinks = null,
}) {
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  const handleCreated = ({ gl }) => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const onLost = (e) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };

    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
  };
  const entityMap = useMemo(() => {
    const map = {};
    entities.forEach((ent) => { map[ent.id] = ent; });
    return map;
  }, [entities]);

  // Derive unique entity-pair links from customLinks, events, or topological proximity
  const entityLinks = useMemo(() => {
    if (customLinks && Array.isArray(customLinks)) {
      return customLinks.map((l, i) => {
        const srcNode = entityMap[l.source || l.srcId];
        const dstNode = entityMap[l.target || l.dstId];
        return {
          id: l.id || `custom-link-${i}`,
          srcId: l.source || l.srcId,
          dstId: l.target || l.dstId,
          start: l.start || srcNode?.position_3d || [0, 0, 0],
          end: l.end || dstNode?.position_3d || [0, 0, 0],
          isActive: true,
          isCritical: l.relationship_type === 'credential_use' || l.rule_name === 'EXPLOIT_SINK_EXECUTION' || Boolean(l.isCritical),
        };
      });
    }

    const seen = new Set();
    const links = [];

    // 1. Derive links directly from actual scenario events (canonical ground truth)
    if (events && Array.isArray(events)) {
      events.forEach((evt) => {
        if (!evt.source_entity_id || !evt.target_entity_id) return;
        const srcNode = entityMap[evt.source_entity_id];
        const dstNode = entityMap[evt.target_entity_id];
        if (!srcNode || !dstNode) return;
        if (!srcNode.position_3d || !dstNode.position_3d) return;

        const key = [evt.source_entity_id, evt.target_entity_id].sort().join('::');
        if (!seen.has(key)) {
          seen.add(key);
          const isCrit = evt.severity === 'critical' || evt.severity === 'high';
          links.push({
            id: `evt-link-${key}`,
            srcId: evt.source_entity_id,
            dstId: evt.target_entity_id,
            start: srcNode.position_3d,
            end: dstNode.position_3d,
            isActive: true,
            isCritical: isCrit,
          });
        }
      });
    }

    // 2. Intra-zone spanning tree for visual network topology
    const byZone = {};
    entities.forEach((ent) => {
      if (!ent.zone) return;
      if (!byZone[ent.zone]) byZone[ent.zone] = [];
      byZone[ent.zone].push(ent);
    });

    Object.values(byZone).forEach((zoneEntities) => {
      for (let i = 0; i < zoneEntities.length - 1; i++) {
        const a = zoneEntities[i];
        const b = zoneEntities[i + 1];
        const key = [a.id, b.id].sort().join('::');
        if (!seen.has(key) && a.position_3d && b.position_3d) {
          seen.add(key);
          links.push({
            id: `zone-link-${key}`,
            srcId: a.id,
            dstId: b.id,
            start: a.position_3d,
            end: b.position_3d,
            isActive: false,
            isCritical: false,
          });
        }
      }
    });

    // 3. Dynamic inter-zone routing: Connect DMZ servers to internal handlers/IDP
    const dmzServers = entities.filter((e) => e.zone === 'dmz' && (e.type === 'server' || e.type === 'workstation'));
    const internalProcs = entities.filter((e) => e.zone === 'prod_internal' && e.type === 'process');
    const identityNodes = entities.filter((e) => e.zone === 'identity');

    dmzServers.forEach((gw) => {
      // Connect gateway to first internal process and identity nodes if not yet linked
      internalProcs.slice(0, 3).forEach((proc) => {
        const key = [gw.id, proc.id].sort().join('::');
        if (!seen.has(key) && gw.position_3d && proc.position_3d) {
          seen.add(key);
          links.push({
            id: `inter-link-${key}`,
            srcId: gw.id,
            dstId: proc.id,
            start: gw.position_3d,
            end: proc.position_3d,
            isActive: true,
            isCritical: false,
          });
        }
      });

      identityNodes.forEach((idp) => {
        const key = [gw.id, idp.id].sort().join('::');
        if (!seen.has(key) && gw.position_3d && idp.position_3d) {
          seen.add(key);
          links.push({
            id: `auth-link-${key}`,
            srcId: gw.id,
            dstId: idp.id,
            start: gw.position_3d,
            end: idp.position_3d,
            isActive: true,
            isCritical: false,
          });
        }
      });
    });

    return links;
  }, [entities, events, entityMap, customLinks]);

  if (contextLost) {
    return (
      <div className="relative h-full w-full bg-[#07090e] flex items-center justify-center p-6 text-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="nd-surface" style={{ padding: 24, maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--nd-text-primary)' }}>
            WebGL Context Lost
          </div>
          <p style={{ fontSize: 12, color: 'var(--nd-text-secondary)', lineHeight: 1.5, margin: 0 }}>
            The 3D graphics context was reset by the browser or GPU. You can restore the 3D scene or continue your investigation using the 2D Causal Event Graph.
          </p>
          <button
            onClick={() => {
              setContextLost(false);
              setCanvasKey((k) => k + 1);
            }}
            className="nd-btn nd-btn-primary nd-btn-sm"
          >
            Restore 3D View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#07090e]">
      <Canvas
        key={canvasKey}
        onCreated={handleCreated}
        gl={{ preserveDrawingBuffer: false, powerPreference: 'default' }}
        camera={{ position: [0, 8, 12], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 15, 10]} intensity={1.2} />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        {/* Blue-tinted fill light for cyberpunk depth */}
        <pointLight position={[-8, 3, -8]} intensity={0.4} color="#1d4ed8" />

        {/* Cyber floor grid */}
        <Grid
          position={[0, -0.6, 0]}
          args={[30, 30]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#0e1726"
          sectionSize={4}
          sectionThickness={1}
          sectionColor="#0ea5e9"
          fadeDistance={25}
          fadeStrength={1.5}
        />

        {/* Network Entity Links */}
        {entityLinks.map((link) => {
          const isLinkActive =
            link.isActive !== undefined
              ? link.isActive
              : currentEvent &&
                ((currentEvent.source_entity_id === link.srcId && currentEvent.target_entity_id === link.dstId) ||
                 (currentEvent.source_entity_id === link.dstId && currentEvent.target_entity_id === link.srcId) ||
                 (currentEvent.source_entity_id === link.srcId) ||
                 (currentEvent.target_entity_id === link.dstId));
          const isCritical =
            link.isCritical !== undefined
              ? link.isCritical
              : currentEvent?.severity === 'critical';
          return (
            <CyberLink
              key={link.id}
              startPos={link.start}
              endPos={link.end}
              isActive={Boolean(isLinkActive)}
              isCritical={Boolean(isCritical)}
            />
          );
        })}

        {/* Network Entity Nodes */}
        {entities.map((entity) => {
          const isCurrentEventSource = currentEvent?.source_entity_id === entity.id;
          const isCurrentEventTarget = currentEvent?.target_entity_id === entity.id;
          return (
            <CyberNode
              key={entity.id}
              entity={entity}
              isSelected={selectedEntityId === entity.id}
              isCurrentEventSource={isCurrentEventSource}
              isCurrentEventTarget={isCurrentEventTarget}
              onSelect={onSelectEntity}
            />
          );
        })}

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>

      {/* Entity Type Legend */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          borderRadius: 'var(--nd-radius-md)',
          backgroundColor: 'rgba(17, 18, 20, 0.85)',
          border: '1px solid var(--nd-border-subtle)',
          padding: '10px 14px',
          fontSize: 10,
          fontFamily: 'var(--nd-font-mono)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: 'var(--nd-shadow-sm)',
        }}
      >
        <div style={{
          color: 'var(--nd-text-muted)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: 9,
          marginBottom: 2,
        }}>
          Entity Types
        </div>
        {Object.entries(ENTITY_TYPE_LABELS).map(([type, { label, color }]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
            <span style={{ color, fontWeight: 700 }}>[{label}]</span>
            <span style={{ color: 'var(--nd-text-secondary)', textTransform: 'capitalize' }}>
              {type.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Controls Info */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          borderRadius: 'var(--nd-radius-md)',
          backgroundColor: 'rgba(17, 18, 20, 0.85)',
          border: '1px solid var(--nd-border-subtle)',
          padding: '6px 12px',
          fontSize: 11,
          color: 'var(--nd-text-secondary)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: 'var(--nd-shadow-sm)',
        }}
      >
        <span style={{ color: 'var(--nd-accent)', fontWeight: 600 }}>3D Security Attack-Path Explorer</span>
        <span style={{ color: 'var(--nd-text-muted)' }}>•</span>
        <span>Drag to Orbit</span>
        <span style={{ color: 'var(--nd-text-muted)' }}>•</span>
        <span>Shift + Drag to Pan</span>
        <span style={{ color: 'var(--nd-text-muted)' }}>•</span>
        <span>Scroll to Zoom</span>
      </div>

      {/* Active event badge */}
      {currentEvent && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            borderRadius: 'var(--nd-radius-md)',
            backgroundColor: 'rgba(17, 18, 20, 0.9)',
            border: '1px solid var(--nd-accent)',
            padding: '8px 12px',
            fontSize: 11,
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            maxWidth: 320,
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              color: 'var(--nd-accent)',
              fontWeight: 700,
              fontFamily: 'var(--nd-font-mono)',
              fontSize: 11,
            }}>
              {currentEvent.id}
            </span>
            <span style={{
              fontSize: 9,
              fontFamily: 'var(--nd-font-mono)',
              padding: '1px 5px',
              borderRadius: 'var(--nd-radius-xs)',
              backgroundColor: currentEvent.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: currentEvent.severity === 'critical' ? 'var(--nd-critical)' : 'var(--nd-medium)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>
              {currentEvent.severity}
            </span>
          </div>
          <p style={{
            color: 'var(--nd-text-primary)',
            fontSize: 11,
            margin: 0,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {currentEvent.summary}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, fontFamily: 'var(--nd-font-mono)' }}>
            <span style={{ color: 'var(--nd-text-muted)' }}>SRC:</span>
            <span style={{ color: 'var(--nd-accent)' }}>{currentEvent.source_entity_id}</span>
            {currentEvent.target_entity_id && (
              <>
                <span style={{ color: 'var(--nd-text-muted)' }}>→ DST:</span>
                <span style={{ color: '#c084fc' }}>{currentEvent.target_entity_id}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
