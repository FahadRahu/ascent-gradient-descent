/**
 * GradientSky Component
 * 
 * Creates an immersive gradient sky dome that responds to theme changes.
 * Uses a large inverted sphere with a canvas texture for smooth gradients.
 * 
 * Features:
 * - Theme-aware gradient (warm sunset for light, deep space for dark)
 * - Subtle rotation animation for dynamic feel
 * - Performant canvas-based texture generation
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GradientSkyProps {
  /** Theme mode */
  isDark: boolean;
  /** Enable subtle rotation animation */
  animate?: boolean;
}

export function GradientSky({ isDark, animate = true }: GradientSkyProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Generate gradient texture based on theme
  const gradientTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Create radial gradient from center
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 512);
    
    if (isDark) {
      // Dark mode: Deep space feel with purple/blue tones
      gradient.addColorStop(0, '#1e1b4b');    // Deep purple center (zenith)
      gradient.addColorStop(0.2, '#312e81');  // Indigo
      gradient.addColorStop(0.4, '#1e3a5f');  // Dark blue
      gradient.addColorStop(0.6, '#0f172a');  // Very dark blue
      gradient.addColorStop(0.8, '#020617');  // Near black
      gradient.addColorStop(1, '#000000');    // Black edge (horizon)
    } else {
      // Light mode: Warm sunrise/sunset feel
      gradient.addColorStop(0, '#e0f2fe');    // Light sky blue center (zenith)
      gradient.addColorStop(0.2, '#bae6fd');  // Sky blue
      gradient.addColorStop(0.4, '#93c5fd');  // Lighter blue
      gradient.addColorStop(0.6, '#ddd6fe');  // Lavender hint
      gradient.addColorStop(0.8, '#fde68a');  // Warm yellow near horizon
      gradient.addColorStop(1, '#fed7aa');    // Soft orange edge (horizon)
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [isDark]);
  
  // Subtle rotation animation for atmosphere
  useFrame(({ clock }) => {
    if (meshRef.current && animate) {
      // Very slow rotation for subtle movement
      meshRef.current.rotation.y = clock.elapsedTime * 0.008;
      // Slight wobble for organic feel
      meshRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.05) * 0.02;
    }
  });
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      {/* Large sphere surrounding the scene */}
      <sphereGeometry args={[50, 32, 32]} />
      <meshBasicMaterial 
        map={gradientTexture} 
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

export default GradientSky;
