/**
 * CostLabel Component
 * 
 * A floating 3D badge that displays the current cost value
 * above the descent ball. Updates in real-time during animation.
 * 
 * Features:
 * - Dynamic scaling based on camera distance (always readable)
 * - Color-coded by cost level (red→yellow→green)
 * - Leader line connecting to ball
 * - Modern pill badge design
 * - Billboard effect (always faces camera)
 */

import { useMemo, useRef } from 'react';
import { Text, Billboard, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GradientDescentPoint } from './types';
import { paramsToThreeCoords } from './utils/costFunction';

interface CostLabelProps {
  /** Current point in the gradient descent */
  currentPoint: GradientDescentPoint | null;
  /** Whether to show the label */
  show: boolean;
  /** Theme mode */
  isDark: boolean;
}

/**
 * Format cost value for display
 * Handles very large, very small, and normal numbers
 */
function formatCost(cost: number): string {
  if (!isFinite(cost)) return cost > 0 ? '∞' : '-∞';
  
  if (Math.abs(cost) >= 1000) {
    return cost.toExponential(1);
  }
  
  if (Math.abs(cost) >= 10) {
    return cost.toFixed(2);
  }
  
  if (Math.abs(cost) < 0.001 && cost !== 0) {
    return cost.toExponential(2);
  }
  
  return cost.toFixed(4);
}

/**
 * Get color scheme based on cost value
 * High cost = red, medium = orange, low = green
 */
function getCostColors(cost: number, isDark: boolean) {
  // Define thresholds
  if (cost > 8) {
    // High cost - red/danger
    return {
      bg: isDark ? '#450a0a' : '#fef2f2',
      border: isDark ? '#dc2626' : '#ef4444',
      text: isDark ? '#fca5a5' : '#b91c1c',
      glow: '#ef4444',
      icon: '📈',
    };
  } else if (cost > 2) {
    // Medium cost - orange/warning
    return {
      bg: isDark ? '#431407' : '#fff7ed',
      border: isDark ? '#f97316' : '#fb923c',
      text: isDark ? '#fed7aa' : '#c2410c',
      glow: '#f97316',
      icon: '📉',
    };
  } else if (cost > 0.5) {
    // Getting close - yellow
    return {
      bg: isDark ? '#422006' : '#fefce8',
      border: isDark ? '#eab308' : '#facc15',
      text: isDark ? '#fef08a' : '#a16207',
      glow: '#eab308',
      icon: '✨',
    };
  } else {
    // Near optimal - green/success
    return {
      bg: isDark ? '#052e16' : '#f0fdf4',
      border: isDark ? '#22c55e' : '#4ade80',
      text: isDark ? '#bbf7d0' : '#166534',
      glow: '#22c55e',
      icon: '🎯',
    };
  }
}

export function CostLabel({ currentPoint, show, isDark }: CostLabelProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Calculate positions and data
  const labelData = useMemo(() => {
    if (!currentPoint) return null;
    
    const ballPosition = paramsToThreeCoords(currentPoint.w, currentPoint.b, currentPoint.cost);
    
    // Position the label well above the ball (increased offset)
    const labelPosition: [number, number, number] = [
      ballPosition[0],
      ballPosition[1] + 0.6, // Increased offset for visibility
      ballPosition[2],
    ];
    
    // Line points for leader line (from label bottom to ball top)
    const lineStart: [number, number, number] = [
      ballPosition[0],
      ballPosition[1] + 0.45,
      ballPosition[2],
    ];
    const lineEnd: [number, number, number] = [
      ballPosition[0],
      ballPosition[1] + 0.12, // Just above ball
      ballPosition[2],
    ];
    
    return {
      labelPosition,
      lineStart,
      lineEnd,
      cost: currentPoint.cost,
    };
  }, [currentPoint]);
  
  // Store position for distance calculation
  const positionVec = useMemo(() => {
    if (!labelData) return new THREE.Vector3();
    return new THREE.Vector3(...labelData.labelPosition);
  }, [labelData]);
  
  // Dynamic scaling based on camera distance
  useFrame(({ camera }) => {
    if (!groupRef.current || !labelData) return;
    
    const distance = camera.position.distanceTo(positionVec);
    // Scale formula: further = larger (stays readable when zoomed out)
    // Base scale at distance 10 = 1.0
    const scale = Math.max(0.8, Math.min(2.5, distance * 0.1));
    groupRef.current.scale.setScalar(scale);
  });
  
  if (!show || !labelData || !currentPoint) return null;
  
  const colors = getCostColors(labelData.cost, isDark);
  const costText = `J = ${formatCost(labelData.cost)}`;
  
  return (
    <>
      {/* Leader line connecting label to ball */}
      <Line
        points={[labelData.lineStart, labelData.lineEnd]}
        color={colors.border}
        lineWidth={2}
        dashed
        dashSize={0.05}
        gapSize={0.03}
        transparent
        opacity={0.7}
      />
      
      {/* Main label billboard */}
      <Billboard
        follow
        lockX={false}
        lockY={false}
        lockZ={false}
        position={labelData.labelPosition}
      >
        <group ref={groupRef}>
          {/* Outer glow effect */}
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[0.85, 0.35]} />
            <meshBasicMaterial
              color={colors.glow}
              transparent
              opacity={0.15}
            />
          </mesh>
          
          {/* Main background (slightly rounded via texture would be ideal, using simple plane) */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[0.75, 0.25]} />
            <meshBasicMaterial
              color={colors.bg}
              transparent
              opacity={0.95}
            />
          </mesh>
          
          {/* Border highlight line at bottom */}
          <mesh position={[0, -0.1, 0]}>
            <planeGeometry args={[0.75, 0.03]} />
            <meshBasicMaterial
              color={colors.border}
              transparent
              opacity={0.9}
            />
          </mesh>
          
          {/* Cost value text - large and bold */}
          <Text
            fontSize={0.12}
            color={colors.text}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            outlineWidth={0.01}
            outlineColor={colors.bg}
          >
            {costText}
          </Text>
          
          {/* Small "Cost" label above the value */}
          <Text
            position={[0, 0.08, 0.001]}
            fontSize={0.04}
            color={colors.border}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            COST
          </Text>
        </group>
      </Billboard>
      
      {/* Small connecting dot at the ball */}
      <mesh position={labelData.lineEnd}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color={colors.border} />
      </mesh>
    </>
  );
}

export default CostLabel;
