/**
 * DivergenceEffect Component
 * 
 * Visual feedback for when gradient descent is diverging.
 * Creates dramatic effects to help users understand that
 * something is going wrong with their parameters.
 * 
 * Effects:
 * - Camera shake (screen trembles)
 * - Red warning overlay
 * - Surface color shift to red
 * - Particles scatter outward
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface DivergenceEffectProps {
  /** Whether divergence is active */
  isDiverging: boolean;
  /** Intensity of the effect (0-1) */
  intensity?: number;
  /** Whether to enable camera shake */
  enableShake?: boolean;
}

// Shake settings
const SHAKE_INTENSITY = 0.03;
// const SHAKE_DECAY = 0.95; // Commented out - not currently used
const SHAKE_FREQUENCY = 20;

export function DivergenceEffect({ 
  isDiverging, 
  intensity = 1,
  enableShake = true 
}: DivergenceEffectProps) {
  const { camera } = useThree();
  const originalPosition = useRef(new THREE.Vector3());
  const shakeOffset = useRef(new THREE.Vector3());
  const shakeTime = useRef(0);
  const isShaking = useRef(false);
  
  // Store original camera position when divergence starts
  useEffect(() => {
    if (isDiverging && !isShaking.current) {
      originalPosition.current.copy(camera.position);
      isShaking.current = true;
      shakeTime.current = 0;
    } else if (!isDiverging && isShaking.current) {
      // Reset camera position when divergence ends
      camera.position.copy(originalPosition.current);
      isShaking.current = false;
    }
  }, [isDiverging, camera]);
  
  // Camera shake animation
  useFrame((state, delta) => {
    if (!isDiverging || !enableShake || !isShaking.current) return;
    
    shakeTime.current += delta;
    
    // Decaying shake intensity
    const currentIntensity = SHAKE_INTENSITY * intensity * Math.exp(-shakeTime.current * 0.5);
    
    if (currentIntensity < 0.001) {
      // Shake has decayed, stop
      camera.position.copy(originalPosition.current);
      return;
    }
    
    // Random shake offset
    const time = state.clock.elapsedTime * SHAKE_FREQUENCY;
    shakeOffset.current.set(
      Math.sin(time * 1.1) * Math.cos(time * 0.9) * currentIntensity,
      Math.sin(time * 1.3) * Math.cos(time * 0.7) * currentIntensity * 0.5,
      Math.sin(time * 0.8) * Math.cos(time * 1.2) * currentIntensity
    );
    
    // Apply shake
    camera.position.copy(originalPosition.current).add(shakeOffset.current);
  });
  
  // Warning overlay effect
  if (!isDiverging) return null;
  
  return (
    <>
      {/* Red warning point light that pulses */}
      <pointLight
        position={[0, 5, 0]}
        color="#ff0000"
        intensity={2 * intensity * (0.5 + Math.sin(Date.now() * 0.01) * 0.5)}
        distance={15}
        decay={2}
      />
      
      {/* Ambient red warning tint */}
      <ambientLight color="#ff4444" intensity={0.3 * intensity} />
    </>
  );
}

/**
 * Warning Overlay Component (for use outside R3F Canvas)
 * 
 * This creates a red pulsing border effect around the visualization
 * to indicate divergence.
 */
interface WarningOverlayProps {
  isDiverging: boolean;
  isDark: boolean;
}

export function WarningOverlay({ isDiverging, isDark }: WarningOverlayProps) {
  if (!isDiverging) return null;
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-20 animate-pulse"
      style={{
        boxShadow: `inset 0 0 30px ${isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`,
        borderRadius: 'inherit',
      }}
    />
  );
}

export default DivergenceEffect;
