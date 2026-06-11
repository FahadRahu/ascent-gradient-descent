/**
 * AmbientDust Component (Phase C5.1)
 * 
 * Floating dust motes that create atmospheric depth.
 * Inspired by Elden Ring / Dark Souls atmosphere.
 * 
 * Features:
 * - Gentle vertical floating motion
 * - Slow horizontal drift
 * - Wrap-around bounds for infinite effect
 * - Theme-aware colors (purple in dark, golden in light)
 * - Additive blending for soft glow
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AmbientDustProps {
  count?: number;
  isDark: boolean;
  bounds?: { x: number; y: number; z: number };
  show?: boolean;
}

export function AmbientDust({ 
  count = 150, 
  isDark, 
  bounds = { x: 10, y: 8, z: 10 },
  show = true
}: AmbientDustProps) {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Generate particle data
  const { positions, phases, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Random starting positions within bounds
      positions[i * 3] = (Math.random() - 0.5) * bounds.x;
      positions[i * 3 + 1] = Math.random() * bounds.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * bounds.z;
      
      // Random phase offset for varied motion
      phases[i] = Math.random() * Math.PI * 2;
      
      // Random speed multiplier
      speeds[i] = 0.3 + Math.random() * 0.7;
    }
    
    return { positions, phases, speeds };
  }, [count, bounds]);
  
  // Store phases and speeds in refs for animation access
  const phasesRef = useRef(phases);
  const speedsRef = useRef(speeds);
  
  // Animate particles
  useFrame(({ clock }) => {
    if (!pointsRef.current || !show) return;
    
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = clock.elapsedTime;
    const phases = phasesRef.current;
    const speeds = speedsRef.current;
    
    for (let i = 0; i < count; i++) {
      const phase = phases[i];
      const speed = speeds[i];
      
      // Gentle vertical float (sine wave)
      posArray[i * 3 + 1] += Math.sin(time * speed + phase) * 0.002;
      
      // Slow horizontal drift
      posArray[i * 3] += Math.sin(time * 0.3 * speed + phase) * 0.001;
      posArray[i * 3 + 2] += Math.cos(time * 0.25 * speed + phase) * 0.001;
      
      // Wrap around Y bounds
      if (posArray[i * 3 + 1] > bounds.y) {
        posArray[i * 3 + 1] = 0;
      } else if (posArray[i * 3 + 1] < 0) {
        posArray[i * 3 + 1] = bounds.y;
      }
      
      // Wrap around X bounds
      if (posArray[i * 3] > bounds.x / 2) {
        posArray[i * 3] = -bounds.x / 2;
      } else if (posArray[i * 3] < -bounds.x / 2) {
        posArray[i * 3] = bounds.x / 2;
      }
      
      // Wrap around Z bounds
      if (posArray[i * 3 + 2] > bounds.z / 2) {
        posArray[i * 3 + 2] = -bounds.z / 2;
      } else if (posArray[i * 3 + 2] < -bounds.z / 2) {
        posArray[i * 3 + 2] = bounds.z / 2;
      }
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Subtle global pulsing effect
    const material = pointsRef.current.material as THREE.PointsMaterial;
    material.opacity = (isDark ? 0.4 : 0.3) + Math.sin(time * 0.5) * 0.05;
  });
  
  if (!show) return null;
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={isDark ? 0.02 : 0.015}
        color={isDark ? '#a78bfa' : '#fcd34d'}
        transparent
        opacity={isDark ? 0.4 : 0.3}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default AmbientDust;
