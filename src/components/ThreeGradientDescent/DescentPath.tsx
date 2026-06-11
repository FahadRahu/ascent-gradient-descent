/**
 * DescentPath Component
 * 
 * Renders an animated line showing the gradient descent path
 * from the starting point to the current position.
 * 
 * Features:
 * - Line grows as descent progresses
 * - Smooth curved path using CatmullRom interpolation
 * - Theme-aware colors
 */

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { GradientDescentPoint } from './types';
import { paramsToThreeCoords } from './utils/costFunction';

interface DescentPathProps {
  /** Full gradient descent path */
  gradientPath: GradientDescentPoint[];
  /** Current step index (line shows up to this point) */
  currentStep: number;
  /** Theme mode */
  isDark: boolean;
}

export function DescentPath({ gradientPath, currentStep, isDark }: DescentPathProps) {
  // Convert visible points to Three.js coordinates
  const linePoints = useMemo(() => {
    // Only show points up to current step
    const visiblePoints = gradientPath.slice(0, currentStep + 1);
    
    if (visiblePoints.length < 2) return null;
    
    // Convert to Three.js Vector3 positions
    const positions = visiblePoints.map(point => 
      new THREE.Vector3(...paramsToThreeCoords(point.w, point.b, point.cost))
    );
    
    // Create a smooth curve if we have enough points
    if (positions.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.3);
      // Get more points for smoother line
      return curve.getPoints(positions.length * 5);
    }
    
    // For fewer points, just return direct positions
    return positions;
  }, [gradientPath, currentStep]);
  
  // Path color - orange to match the warm accent
  const pathColor = isDark ? '#fb923c' : '#f97316'; // Orange
  
  if (!linePoints || linePoints.length < 2) return null;
  
  return (
    <group>
      {/* Main path line */}
      <Line
        points={linePoints}
        color={pathColor}
        lineWidth={3}
        transparent
        opacity={0.9}
      />
      
      {/* Shadow/glow line underneath for depth */}
      <Line
        points={linePoints}
        color={isDark ? '#ea580c' : '#c2410c'}
        lineWidth={5}
        transparent
        opacity={0.3}
      />
    </group>
  );
}

export default DescentPath;
