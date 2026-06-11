/**
 * AxisLabels Component - REDESIGNED
 * 
 * Clean axis system with:
 * - THICK, bright axis lines stretching FULL grid width/depth
 * - Orange = w (weight) axis with "Weight" labels on BOTH ends
 * - Cyan = b (bias) axis with "Bias" labels on BOTH ends
 * - Purple = J(w,b) cost axis (vertical)
 * - Small tick mark numbers along axes
 * - Camera-based scaling for labels (readable but non-occluding)
 */

import { useMemo, useRef } from 'react';
import { Text, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getQualitySettings } from './types';
import { SURFACE_SIZE } from './utils/costFunction';

interface AxisLabelsProps {
  /** Theme mode */
  isDark: boolean;
  /** Whether to show labels */
  show?: boolean;
}

// Computed max height from surface config
// const MAX_HEIGHT = MAX_COST * HEIGHT_SCALE; // Commented out - not currently used

/**
 * ScaledLabel - A billboard label that scales with camera distance
 * Scales SMALLER when close (to avoid occlusion) and larger when far (for readability)
 */
function ScaledLabel({ 
  position, 
  text, 
  color, 
  outlineColor, 
  fontSize = 0.35,
  anchorX = 'center' as const
}: { 
  position: [number, number, number]; 
  text: string; 
  color: string; 
  outlineColor: string;
  fontSize?: number;
  anchorX?: 'left' | 'center' | 'right';
}) {
  const groupRef = useRef<THREE.Group>(null);
  const positionVec = useMemo(() => new THREE.Vector3(...position), [position]);
  
  // Scale based on camera distance - smaller when close, larger when far
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const distance = camera.position.distanceTo(positionVec);
    // Scale: 0.6 at close range (5 units), 1.5 at far range (25 units)
    const scale = Math.max(0.6, Math.min(1.5, distance * 0.07));
    groupRef.current.scale.setScalar(scale);
  });
  
  return (
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef}>
        <Text
          fontSize={fontSize}
          color={color}
          outlineWidth={0.05}
          outlineColor={outlineColor}
          anchorX={anchorX}
          anchorY="middle"
          fontWeight="bold"
        >
          {text}
        </Text>
      </group>
    </Billboard>
  );
}

export function AxisLabels({ isDark, show = true }: AxisLabelsProps) {
  const quality = useMemo(() => getQualitySettings(), []);
  
  // Don't render on mobile for performance
  if (!show || !quality.enableContours) return null;
  
  return (
    <group name="axis-labels">
      {/* Thick color-coded axis lines with 3D labels at BOTH ends */}
      <AxisLines isDark={isDark} />
    </group>
  );
}

/**
 * Color-coded axis reference lines with numeric tick marks
 * 
 * Phase 2 Enhancement: Added numeric labels at key positions
 * - W axis: -2, 0, 2, 4
 * - B axis: -2, 0, 2, 4, 6
 * - Cost axis: 0, 5, 10, 15, 20
 */
function AxisLines({ isDark }: { isDark: boolean }) {
  const wColor = isDark ? '#f97316' : '#fb923c';
  const bColor = isDark ? '#22d3ee' : '#22d3ee';
  const costColor = isDark ? '#a855f7' : '#a855f7';
  
  // Import cost function parameters for proper scaling
  const { wMin, wMax, bMin, bMax } = { wMin: -2, wMax: 4, bMin: -2, bMax: 6 };
  
  // W axis tick values
  const wTicks = [-2, 0, 2, 4];
  // B axis tick values
  const bTicks = [-2, 0, 2, 4, 6];
  // Cost axis tick values (visual height = cost * HEIGHT_SCALE)
  const costTicks = [0, 5, 10, 15, 20];
  
  // Helper to convert w value to X position
  const wToX = (w: number) => ((w - wMin) / (wMax - wMin) - 0.5) * SURFACE_SIZE.width;
  // Helper to convert b value to Z position
  const bToZ = (b: number) => ((b - bMin) / (bMax - bMin) - 0.5) * SURFACE_SIZE.depth;
  // Helper to convert cost value to Y position (using HEIGHT_SCALE = 0.08)
  const costToY = (cost: number) => cost * 0.08;
  
  // Grid half dimensions - axis lines span the FULL grid
  const halfWidth = SURFACE_SIZE.width / 2;  // 5 units
  const halfDepth = SURFACE_SIZE.depth / 2;  // 6.5 units
  const labelOffset = 0.8; // How far past line end the label sits
  
  return (
    <group name="axis-lines">
      {/* X-axis (w) - Orange - SPANS FULL GRID WIDTH */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[SURFACE_SIZE.width, 0.05, 0.05]} />
        <meshStandardMaterial 
          color={wColor}
          emissive={wColor}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* "Weight" labels on BOTH ends of w-axis */}
      <ScaledLabel
        position={[halfWidth + labelOffset, 0.15, 0]}
        text="Weight"
        color={isDark ? '#fed7aa' : '#c2410c'}
        outlineColor={isDark ? '#431407' : '#fff7ed'}
        fontSize={0.4}
        anchorX="left"
      />
      <ScaledLabel
        position={[-halfWidth - labelOffset, 0.15, 0]}
        text="Weight"
        color={isDark ? '#fed7aa' : '#c2410c'}
        outlineColor={isDark ? '#431407' : '#fff7ed'}
        fontSize={0.4}
        anchorX="right"
      />
      
      {/* W-axis tick marks and labels */}
      {wTicks.map((w) => {
        const x = wToX(w);
        return (
          <group key={`w-tick-${w}`}>
            {/* Tick mark */}
            <mesh position={[x, 0.02, -0.08]}>
              <boxGeometry args={[0.02, 0.015, 0.12]} />
              <meshStandardMaterial color={wColor} emissive={wColor} emissiveIntensity={0.2} />
            </mesh>
            {/* Numeric label */}
            <Billboard position={[x, 0.02, -0.35]} follow lockX={false} lockY={false} lockZ={false}>
              <Text
                fontSize={0.15}
                color={isDark ? '#fed7aa' : '#c2410c'}
                outlineWidth={0.02}
                outlineColor={isDark ? '#431407' : '#fff7ed'}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {w}
              </Text>
            </Billboard>
          </group>
        );
      })}
      
      {/* Z-axis (b) - Cyan - SPANS FULL GRID DEPTH */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.05, 0.05, SURFACE_SIZE.depth]} />
        <meshStandardMaterial 
          color={bColor}
          emissive={bColor}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* "Bias" labels on BOTH ends of b-axis */}
      <ScaledLabel
        position={[0, 0.15, halfDepth + labelOffset]}
        text="Bias"
        color={isDark ? '#a5f3fc' : '#0e7490'}
        outlineColor={isDark ? '#083344' : '#ecfeff'}
        fontSize={0.4}
      />
      <ScaledLabel
        position={[0, 0.15, -halfDepth - labelOffset]}
        text="Bias"
        color={isDark ? '#a5f3fc' : '#0e7490'}
        outlineColor={isDark ? '#083344' : '#ecfeff'}
        fontSize={0.4}
      />
      
      {/* B-axis tick marks and labels */}
      {bTicks.map((b) => {
        const z = bToZ(b);
        return (
          <group key={`b-tick-${b}`}>
            {/* Tick mark */}
            <mesh position={[-0.08, 0.02, z]}>
              <boxGeometry args={[0.12, 0.015, 0.02]} />
              <meshStandardMaterial color={bColor} emissive={bColor} emissiveIntensity={0.2} />
            </mesh>
            {/* Numeric label */}
            <Billboard position={[-0.35, 0.02, z]} follow lockX={false} lockY={false} lockZ={false}>
              <Text
                fontSize={0.15}
                color={isDark ? '#a5f3fc' : '#0e7490'}
                outlineWidth={0.02}
                outlineColor={isDark ? '#083344' : '#ecfeff'}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {b}
              </Text>
            </Billboard>
          </group>
        );
      })}
      
      {/* Y-axis (J) - Purple - THICK and prominent, positioned at edge of surface */}
      <mesh position={[-SURFACE_SIZE.width / 2 - 0.3, costToY(12.5), 0]}>
        <boxGeometry args={[0.05, costToY(25) + 0.5, 0.05]} />
        <meshStandardMaterial 
          color={costColor}
          emissive={costColor}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Y-axis arrow tip - LARGER */}
      <mesh position={[-SURFACE_SIZE.width / 2 - 0.3, costToY(25) + 0.35, 0]}>
        <coneGeometry args={[0.08, 0.2, 12]} />
        <meshStandardMaterial 
          color={costColor}
          emissive={costColor}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Cost-axis tick marks and labels */}
      {costTicks.map((cost) => {
        const y = costToY(cost);
        // Color gradient from cyan (low) to red (high)
        const t = cost / 25;
        const tickColor = new THREE.Color().lerpColors(
          new THREE.Color('#22d3ee'),
          new THREE.Color('#ef4444'),
          t
        );
        return (
          <group key={`cost-tick-${cost}`}>
            {/* Tick mark */}
            <mesh position={[-SURFACE_SIZE.width / 2 - 0.5, y, 0]}>
              <boxGeometry args={[0.25, 0.03, 0.05]} />
              <meshStandardMaterial color={tickColor} emissive={tickColor} emissiveIntensity={0.3} />
            </mesh>
            {/* Numeric label - consistent size */}
            <Billboard position={[-SURFACE_SIZE.width / 2 - 1.0, y, 0]} follow lockX={false} lockY={false} lockZ={false}>
              <Text
                fontSize={0.15}
                color={isDark ? '#e9d5ff' : '#7c3aed'}
                outlineWidth={0.025}
                outlineColor={isDark ? '#2e1065' : '#faf5ff'}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {cost}
              </Text>
            </Billboard>
          </group>
        );
      })}
      
      {/* Origin marker */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

export default AxisLabels;
