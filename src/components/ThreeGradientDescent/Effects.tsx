/**
 * Effects Component
 * 
 * Custom visual effects for the gradient descent visualization.
 * Instead of post-processing bloom (which requires newer dependencies),
 * we use emissive materials with additional glow meshes for a similar effect.
 * 
 * This approach is:
 * - Lighter weight (no extra post-processing pass)
 * - More compatible (no dependency conflicts)
 * - Still visually appealing
 * 
 * Features:
 * - Ambient glow around key elements
 * - Theme-aware colors
 * - Desktop only for performance
 */

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { getQualitySettings } from './types';

interface EffectsProps {
  /** Theme mode */
  isDark: boolean;
  /** Whether effects are enabled */
  show?: boolean;
}

/**
 * Main Effects component - adds ambient visual enhancements
 * This acts as a container for various effect layers
 */
export function Effects({ isDark, show = true }: EffectsProps) {
  const quality = useMemo(() => getQualitySettings(), []);
  
  // Don't render on mobile
  if (!show || !quality.enableContours) return null;
  
  return (
    <group name="effects">
      {/* Ambient fog for depth */}
      <AmbientFog isDark={isDark} />
      
      {/* Ground glow at the optimal point */}
      <OptimalGlow isDark={isDark} />
    </group>
  );
}

/**
 * Subtle fog to add depth perception
 */
function AmbientFog({ isDark }: { isDark: boolean }) {
  const fogColor = isDark ? '#0f172a' : '#f1f5f9';
  
  return (
    <fog attach="fog" args={[fogColor, 8, 25]} />
  );
}

/**
 * Animated glow ring at the optimal point
 * Creates a visual "beacon" effect drawing attention to the minimum
 */
function OptimalGlow({ isDark }: { isDark: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  
  // Optimal position - uses correct values from costFunction.ts
  // OPTIMAL_PARAMS = { w: 0, b: 0, cost: 0 } - center of the bowl
  const position: [number, number, number] = useMemo(() => {
    // For J(w,b) = w² + b², minimum is at origin (0, 0)
    // In Three.js coordinates, this maps to (0, 0, 0) since the surface is centered
    return [0, 0.01, 0];
  }, []);
  
  // Animation
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    
    if (ringRef.current) {
      // Pulsing scale
      const scale = 1 + Math.sin(time * 1.5) * 0.15;
      ringRef.current.scale.set(scale, scale, 1);
      
      // Subtle rotation
      ringRef.current.rotation.z = time * 0.2;
    }
    
    if (outerRingRef.current) {
      // Counter-rotating outer ring
      const scale = 1.2 + Math.sin(time * 1.2 + Math.PI) * 0.1;
      outerRingRef.current.scale.set(scale, scale, 1);
      outerRingRef.current.rotation.z = -time * 0.15;
    }
  });
  
  // Colors
  const glowColor = isDark ? '#22c55e' : '#16a34a';
  const outerColor = isDark ? '#4ade80' : '#22c55e';
  
  return (
    <group position={position}>
      {/* Inner glow ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.25, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Outer glow ring */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.38, 32]} />
        <meshBasicMaterial
          color={outerColor}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Ground spot light projection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
      
      {/* Vertical beam effect (very subtle) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.15, 1, 8, 1, true]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Glow effect for any object using layered transparent spheres
 * Can be attached to any group to add a glow effect
 */
interface ObjectGlowProps {
  color: string;
  size?: number;
  intensity?: number;
}

export function ObjectGlow({ color, size = 0.2, intensity = 0.3 }: ObjectGlowProps) {
  return (
    <group>
      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[size * 1.2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={intensity}
          depthWrite={false}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[size * 1.6, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={intensity * 0.4}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default Effects;
