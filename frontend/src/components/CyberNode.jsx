import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const ENTITY_CONFIG = {
  user: { color: '#06b6d4', geometry: 'sphere', label: 'USER' },
  workstation: { color: '#3b82f6', geometry: 'box', label: 'HOST' },
  server: { color: '#8b5cf6', geometry: 'cylinder', label: 'SRV' },
  database: { color: '#ec4899', geometry: 'cylinder', label: 'DB' },
  identity_provider: { color: '#10b981', geometry: 'box', label: 'IDP' },
  session_token: { color: '#f59e0b', geometry: 'octahedron', label: 'TOKEN' },
  process: { color: '#f43f5e', geometry: 'dodecahedron', label: 'PROC' },
};

export default function CyberNode({ entity, isSelected, isCurrentEventSource, isCurrentEventTarget, onSelect }) {
  const meshRef = useRef();
  const config = ENTITY_CONFIG[entity.type] || { color: '#94a3b8', geometry: 'box', label: 'NODE' };

  const isSevered = entity.isSevered === true;
  const isHighlighted = isSelected || isCurrentEventSource || isCurrentEventTarget;
  const pos = entity.position_3d || [0, 0, 0];

  // Subtle floating pulsation for active highlighted nodes only
  useFrame(() => {
    if (meshRef.current && isHighlighted && !isSevered) {
      const t = performance.now() * 0.001;
      meshRef.current.position.y = pos[1] + Math.sin(t * 3) * 0.08;
    }
  });

  // Severed (VERIFIED_FIXED) nodes render in green
  const nodeColor = isSevered
    ? '#10b981'
    : isHighlighted
    ? isCurrentEventSource ? '#f43f5e' : '#06b6d4'
    : config.color;

  const emissiveColor = isSevered
    ? '#10b981'
    : isHighlighted
    ? isCurrentEventSource ? '#f43f5e' : '#06b6d4'
    : '#000000';

  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect(entity.id); }}>
      {/* Visual geometry */}
      <mesh ref={meshRef}>
        {config.geometry === 'box' && <boxGeometry args={[1, 0.8, 1]} />}
        {config.geometry === 'sphere' && <sphereGeometry args={[0.55, 24, 24]} />}
        {config.geometry === 'cylinder' && <cylinderGeometry args={[0.6, 0.6, 0.9, 24]} />}
        {config.geometry === 'octahedron' && <octahedronGeometry args={[0.5]} />}
        {config.geometry === 'dodecahedron' && <dodecahedronGeometry args={[0.5]} />}

        <meshStandardMaterial
          color={nodeColor}
          emissive={emissiveColor}
          emissiveIntensity={isSevered ? 0.35 : isHighlighted ? 0.6 : 0.0}
          roughness={isSevered ? 0.5 : 0.25}
          metalness={0.7}
          wireframe={false}
          opacity={isSevered ? 0.6 : 1.0}
          transparent={isSevered}
        />
      </mesh>

      {/* Target/Selection Ring */}
      {isHighlighted && !isSevered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
          <ringGeometry args={[0.8, 0.95, 32]} />
          <meshBasicMaterial
            color={isCurrentEventSource ? '#f43f5e' : '#06b6d4'}
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* 3D Label & Type Tag */}
      <Html position={[0, 0.85, 0]} center distanceFactor={12}>
        <div
          className={`pointer-events-none select-none rounded border px-2 py-0.5 text-[10px] font-mono whitespace-nowrap shadow-lg transition-all ${
            isSevered
              ? 'border-emerald-600 bg-slate-900/90 text-emerald-300'
              : isHighlighted
              ? 'border-cyan-400 bg-slate-900/90 text-cyan-300 ring-2 ring-cyan-500/30'
              : 'border-slate-700/80 bg-slate-950/80 text-slate-300'
          }`}
        >
          <span className={`font-semibold mr-1 ${isSevered ? 'text-emerald-400' : 'text-cyan-400'}`}>
            [{isSevered ? '✓ FIXED' : (
              entity.category === 'vulnerable_component' ? 'VULN' :
              entity.category === 'entrypoint' ? 'ENTRY' :
              entity.category === 'api_gateway' ? 'ROUTER' :
              entity.category === 'compromised_sink' ? 'SINK' :
              config.label
            )}]
          </span>
          <span>{entity.name}</span>
        </div>
      </Html>
    </group>
  );
}
