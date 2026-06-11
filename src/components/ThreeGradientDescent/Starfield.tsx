/**
 * Starfield Component (Phase C5.2)
 * 
 * Subtle twinkling stars in the background for dark mode.
 * Creates a sense of vastness and cosmic scale.
 * 
 * Features:
 * - Stars distributed on a large sphere around the scene
 * - Subtle twinkling animation (opacity variation)
 * - Only visible in dark mode
 * - Performance-friendly (simple points rendering)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarfieldProps {
  count?: number;
  show?: boolean;
  isDark?: boolean;
  radius?: number;
}

export function Starfield({ 
  count = 300, 
  show = true,
  isDark = true,
  radius = 40
}: StarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Generate star positions on a sphere
  const { positions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const twinklePhases = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Distribute on a large sphere using spherical coordinates
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      // Randomize radius slightly for depth
      const r = radius + (Math.random() - 0.5) * 10;
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      
      // Random twinkle phase
      twinklePhases[i] = Math.random() * Math.PI * 2;
      
      // Random twinkle speed (some stars twinkle faster)
      twinkleSpeeds[i] = 0.5 + Math.random() * 2;
    }
    
    return { positions, twinklePhases, twinkleSpeeds };
  }, [count, radius]);
  
  // Animation data available via twinklePhases and twinkleSpeeds from useMemo
  // Could be used in future for per-star twinkling animation
  
  // Animate twinkling
  useFrame(({ clock }) => {
    if (!pointsRef.current || !show || !isDark) return;
    
    const time = clock.elapsedTime;
    const material = pointsRef.current.material as THREE.PointsMaterial;
    
    // Global subtle opacity variation (simulates atmospheric twinkling)
    material.opacity = 0.5 + Math.sin(time * 0.3) * 0.15;
    
    // Very slow rotation to give sense of cosmic motion
    pointsRef.current.rotation.y = time * 0.005;
    pointsRef.current.rotation.x = Math.sin(time * 0.003) * 0.02;
  });
  
  // Don't render in light mode or when hidden
  if (!show || !isDark) return null;
  
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
        size={0.08}
        color="#ffffff"
        transparent
        opacity={0.5}
        sizeAttenuation={false} // Stars stay same size regardless of distance
        depthWrite={false}
      />
    </points>
  );
}

export default Starfield;
