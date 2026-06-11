/**
 * NeonPath Component (Phase C3.1)
 * 
 * Enhanced path visualization with neon tube effect and energy pulse animation.
 * Replaces the basic DescentPath with a more dynamic, eye-catching design.
 * 
 * Features:
 * - Multi-layer glow effect (core + middle + outer glow)
 * - Animated energy pulse traveling along the path
 * - Smooth CatmullRom curve interpolation
 * - Theme-aware coloring
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { GradientDescentPoint } from './types';
import { paramsToThreeCoords } from './utils/costFunction';

interface NeonPathProps {
  /** Full gradient descent path */
  gradientPath: GradientDescentPoint[];
  /** Current step index (path shows up to this point) */
  currentStep: number;
  /** Theme mode */
  isDark: boolean;
  /** Whether to animate the energy pulse */
  animate?: boolean;
}

export function NeonPath({ 
  gradientPath, 
  currentStep, 
  isDark,
  animate = true 
}: NeonPathProps) {
  const pulseRef = useRef(0);
  
  // Animate energy pulse position
  useFrame(({ clock }) => {
    if (animate) {
      pulseRef.current = (clock.elapsedTime * 0.3) % 1;
    }
  });
  
  // Generate smooth curve points
  const pathData = useMemo(() => {
    const visiblePoints = gradientPath.slice(0, currentStep + 1);
    
    if (visiblePoints.length < 2) return null;
    
    // Convert to Three.js coordinates
    const positions = visiblePoints.map(point => 
      new THREE.Vector3(...paramsToThreeCoords(point.w, point.b, point.cost))
    );
    
    // Create smooth curve
    if (positions.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.3);
      const curvePoints = curve.getPoints(Math.max(positions.length * 8, 50));
      return curvePoints;
    }
    
    return positions;
  }, [gradientPath, currentStep]);
  
  if (!pathData || pathData.length < 2) return null;
  
  // Colors based on theme
  const coreColor = isDark ? '#ff6b6b' : '#ef4444';     // Bright red core
  const midColor = isDark ? '#fca5a5' : '#fca5a5';      // Light red mid glow
  const outerColor = isDark ? '#fee2e2' : '#fee2e2';    // Very light red outer
  const pulseColor = isDark ? '#ffffff' : '#fff7ed';    // White pulse
  
  return (
    <group>
      {/* Outer glow - widest, most transparent */}
      <Line
        points={pathData}
        color={outerColor}
        lineWidth={8}
        transparent
        opacity={0.15}
      />
      
      {/* Middle glow */}
      <Line
        points={pathData}
        color={midColor}
        lineWidth={5}
        transparent
        opacity={0.3}
      />
      
      {/* Core line - brightest */}
      <Line
        points={pathData}
        color={coreColor}
        lineWidth={2.5}
        transparent
        opacity={0.9}
      />
      
      {/* Energy pulse highlight - moves along path */}
      <PulseHighlight 
        pathPoints={pathData} 
        pulsePosition={pulseRef.current}
        color={pulseColor}
        animate={animate}
      />
    </group>
  );
}

/**
 * PulseHighlight - Animated bright spot that travels along the path
 */
interface PulseHighlightProps {
  pathPoints: THREE.Vector3[];
  pulsePosition: number;
  color: string;
  animate: boolean;
}

function PulseHighlight({ pathPoints, pulsePosition: _pulsePosition, color, animate }: PulseHighlightProps) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (!animate || !sphereRef.current || pathPoints.length < 2) return;
    
    // Calculate position along the path
    const t = (clock.elapsedTime * 0.3) % 1;
    const index = Math.floor(t * (pathPoints.length - 1));
    const nextIndex = Math.min(index + 1, pathPoints.length - 1);
    const localT = (t * (pathPoints.length - 1)) % 1;
    
    // Interpolate between points
    const pos = new THREE.Vector3().lerpVectors(
      pathPoints[index],
      pathPoints[nextIndex],
      localT
    );
    
    sphereRef.current.position.copy(pos);
    if (glowRef.current) {
      glowRef.current.position.copy(pos);
      
      // Pulsing glow scale
      const pulse = 1 + Math.sin(clock.elapsedTime * 8) * 0.2;
      glowRef.current.scale.setScalar(pulse);
    }
  });
  
  if (!animate || pathPoints.length < 2) return null;
  
  return (
    <group>
      {/* Core bright spot */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.9}
        />
      </mesh>
      
      {/* Glow around the pulse */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default NeonPath;
