import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';

export default function CyberLink({ startPos, endPos, isActive, isCritical }) {
  const geometry = useMemo(() => {
    const pts = [new THREE.Vector3(...startPos), new THREE.Vector3(...endPos)];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [startPos[0], startPos[1], startPos[2], endPos[0], endPos[1], endPos[2]]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: isActive ? (isCritical ? '#f43f5e' : '#06b6d4') : '#1e293b',
      transparent: true,
      opacity: isActive ? 0.9 : 0.35,
    });
  }, [isActive, isCritical]);

  const lineObj = useMemo(() => {
    return new THREE.Line(geometry, material);
  }, [geometry, material]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <primitive object={lineObj} />;
}
