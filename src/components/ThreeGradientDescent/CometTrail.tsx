/**
 * CometTrail Component
 * 
 * A smooth, glowing trail that follows the descent ball.
 * Uses multiple layers for a neon/comet-like effect.
 * 
 * Features:
 * - Smooth CatmullRom spline interpolation
 * - Multi-layer glow (core, middle, outer)
 * - Gradient fade from tail to head
 * - Theme-aware colors
 */

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { GradientDescentPoint } from './types';
import { paramsToThreeCoords } from './utils/costFunction';

interface CometTrailProps {
  /** Points to create the trail from */
  points: GradientDescentPoint[];
  /** Current ball position (head of trail) */
  currentPosition: [number, number, number] | null;
  /** Theme mode */
  isDark: boolean;
  /** Maximum number of trail points */
  maxLength?: number;
  /** Whether to show the trail */
  visible?: boolean;
}

export function CometTrail({ 
  points, 
  currentPosition, 
  isDark,
  maxLength = 10,
  visible = true
}: CometTrailProps) {
  // Build smooth trail from recent points
  const trailData = useMemo(() => {
    if (points.length < 2 || !currentPosition) return null;
    
    // Get recent points
    const recentPoints = points.slice(-maxLength);
    
    // Convert to Vector3 positions
    const positions: THREE.Vector3[] = recentPoints.map(p => 
      new THREE.Vector3(...paramsToThreeCoords(p.w, p.b, p.cost))
    );
    
    // Add current position at the end (head of trail)
    positions.push(new THREE.Vector3(...currentPosition));
    
    // Need at least 2 points for a curve
    if (positions.length < 2) return null;
    
    // Create smooth curve
    const curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.3);
    
    // Get interpolated points for smooth line
    const numInterpolatedPoints = Math.max(positions.length * 8, 20);
    const curvePoints = curve.getPoints(numInterpolatedPoints);
    
    return { curvePoints, totalPoints: positions.length };
  }, [points, currentPosition, maxLength]);
  
  if (!visible || !trailData || trailData.curvePoints.length < 2) return null;
  
  // Colors based on theme
  const coreColor = isDark ? '#ff6b6b' : '#ef4444';    // Bright red
  const middleColor = isDark ? '#fca5a5' : '#f87171';  // Light red
  const outerColor = isDark ? '#fef2f2' : '#fee2e2';   // Very light red/white
  
  return (
    <group>
      {/* Core line - brightest, thinnest */}
      <Line
        points={trailData.curvePoints}
        color={coreColor}
        lineWidth={2.5}
        transparent
        opacity={0.9}
      />
      
      {/* Middle glow layer */}
      <Line
        points={trailData.curvePoints}
        color={middleColor}
        lineWidth={5}
        transparent
        opacity={0.4}
      />
      
      {/* Outer glow layer - widest, most faded */}
      <Line
        points={trailData.curvePoints}
        color={outerColor}
        lineWidth={8}
        transparent
        opacity={0.15}
      />
    </group>
  );
}

export default CometTrail;
