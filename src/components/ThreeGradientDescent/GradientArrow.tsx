/**
 * GradientArrow Component
 * 
 * An animated arrow showing the gradient descent direction
 * at the current position. This helps users understand WHY
 * the ball moves in that particular direction.
 * 
 * Features:
 * - Points in the negative gradient direction (descent)
 * - Pulsing animation when playing
 * - Educational: shows the "downhill" direction
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GradientDescentPoint } from './types';
import { paramsToThreeCoords, computeGradients } from './utils/costFunction';

interface GradientArrowProps {
  /** Current point in the gradient descent */
  currentPoint: GradientDescentPoint | null;
  /** Whether animation is playing */
  isPlaying: boolean;
  /** Whether to show the arrow */
  show: boolean;
  /** Theme mode */
  isDark: boolean;
}

export function GradientArrow({ currentPoint, isPlaying, show, isDark }: GradientArrowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const arrowRef = useRef<THREE.Group>(null);
  
  // Calculate arrow position and direction
  const arrowData = useMemo(() => {
    if (!currentPoint) return null;
    
    // Get current position in 3D space
    const position = paramsToThreeCoords(currentPoint.w, currentPoint.b, currentPoint.cost);
    
    // Compute gradient at current point
    const gradient = computeGradients(currentPoint.w, currentPoint.b);
    
    // The descent direction is the negative gradient
    // We need to map this to 3D space
    // X axis = w, Z axis = b
    const descentDirection = new THREE.Vector3(
      -gradient.dw,
      0, // We don't move directly in Y, Y is determined by the cost
      -gradient.db
    ).normalize();
    
    // Scale the arrow length based on gradient magnitude
    const gradientMagnitude = Math.sqrt(gradient.dw * gradient.dw + gradient.db * gradient.db);
    const arrowLength = Math.min(Math.max(gradientMagnitude * 0.3, 0.15), 0.5);
    
    return {
      position,
      direction: descentDirection,
      length: arrowLength,
    };
  }, [currentPoint]);
  
  // Pulsing animation
  useFrame(({ clock }) => {
    if (arrowRef.current && show) {
      if (isPlaying) {
        // Active pulsing
        const pulse = 0.85 + Math.sin(clock.elapsedTime * 5) * 0.15;
        arrowRef.current.scale.setScalar(pulse);
      } else {
        // Gentle idle pulse
        const idlePulse = 0.95 + Math.sin(clock.elapsedTime * 2) * 0.05;
        arrowRef.current.scale.setScalar(idlePulse);
      }
    }
  });
  
  if (!show || !arrowData || !currentPoint) return null;
  
  // Calculate rotation to point arrow in descent direction
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4();
  
  // Create rotation matrix to orient arrow along descent direction
  matrix.lookAt(
    new THREE.Vector3(0, 0, 0),
    arrowData.direction,
    up
  );
  quaternion.setFromRotationMatrix(matrix);
  
  // Colors
  const arrowColor = isDark ? '#22c55e' : '#16a34a'; // Green
  const glowColor = isDark ? '#4ade80' : '#22c55e';
  
  return (
    <group ref={groupRef} position={arrowData.position}>
      <group ref={arrowRef} quaternion={quaternion}>
        {/* Arrow shaft */}
        <mesh position={[0, 0, arrowData.length / 2]}>
          <cylinderGeometry args={[0.015, 0.015, arrowData.length, 8]} />
          <meshStandardMaterial
            color={arrowColor}
            emissive={arrowColor}
            emissiveIntensity={0.4}
            roughness={0.3}
          />
        </mesh>
        
        {/* Arrow head (cone) */}
        <mesh position={[0, 0, arrowData.length + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.04, 0.1, 8]} />
          <meshStandardMaterial
            color={arrowColor}
            emissive={arrowColor}
            emissiveIntensity={0.5}
            roughness={0.2}
          />
        </mesh>
        
        {/* Glow around arrow */}
        <mesh position={[0, 0, arrowData.length / 2]}>
          <cylinderGeometry args={[0.03, 0.03, arrowData.length, 8]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.2}
            depthWrite={false}
          />
        </mesh>
      </group>
      
      {/* Small label - "∇" symbol indicator */}
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

export default GradientArrow;
