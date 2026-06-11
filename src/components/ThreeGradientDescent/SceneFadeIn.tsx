/**
 * SceneFadeIn Component
 * 
 * Wraps scene elements to provide a smooth entrance animation.
 * Elements scale up from 0.9 to 1.0 and rise from below while fading in.
 * 
 * Features:
 * - Smooth ease-out cubic animation
 * - Scale + position + opacity animation combo
 * - Configurable duration
 * - Only runs once on mount
 */

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SceneFadeInProps {
  /** Child elements to animate */
  children: React.ReactNode;
  /** Animation duration in seconds */
  duration?: number;
  /** Initial Y offset (elements rise from this far below) */
  riseDistance?: number;
  /** Initial scale (elements grow from this scale to 1) */
  initialScale?: number;
  /** Delay before animation starts in seconds */
  delay?: number;
}

export function SceneFadeIn({ 
  children, 
  duration = 1.2,
  riseDistance = 0.5,
  initialScale = 0.92,
  delay = 0.1
}: SceneFadeInProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [animationComplete, setAnimationComplete] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  
  // Reset on mount
  useEffect(() => {
    startTimeRef.current = null;
    setAnimationComplete(false);
  }, []);
  
  useFrame(({ clock }) => {
    if (animationComplete || !groupRef.current) return;
    
    // Initialize start time on first frame
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.elapsedTime + delay;
      // Set initial state
      groupRef.current.scale.setScalar(initialScale);
      groupRef.current.position.y = -riseDistance;
    }
    
    const elapsed = clock.elapsedTime - startTimeRef.current;
    
    // Wait for delay
    if (elapsed < 0) return;
    
    // Calculate progress (0 to 1)
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic: 1 - (1 - t)^3
    const eased = 1 - Math.pow(1 - progress, 3);
    
    // Apply scale: initialScale -> 1
    const scale = initialScale + (1 - initialScale) * eased;
    groupRef.current.scale.setScalar(scale);
    
    // Apply Y position: -riseDistance -> 0
    groupRef.current.position.y = -riseDistance * (1 - eased);
    
    // Mark complete when done
    if (progress >= 1) {
      setAnimationComplete(true);
      // Ensure final state is exact
      groupRef.current.scale.setScalar(1);
      groupRef.current.position.y = 0;
    }
  });
  
  return (
    <group ref={groupRef}>
      {children}
    </group>
  );
}

export default SceneFadeIn;
