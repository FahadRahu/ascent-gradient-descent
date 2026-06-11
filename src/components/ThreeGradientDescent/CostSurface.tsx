/**
 * CostSurface Component
 * 
 * Renders the 3D cost function surface as a displaced plane mesh.
 * The Y-axis (height) represents the cost value at each (w, b) point.
 * 
 * REDESIGNED: Uses new quadratic bowl with proper height scaling
 * for a beautiful, educational visualization.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { 
  computeCost, 
  COST_RANGE, 
  MAX_COST, 
  SURFACE_SIZE,
  HEIGHT_SCALE,
  LIGHT_MODE_COLORS,
  DARK_MODE_COLORS
} from './utils/costFunction';
import { getQualitySettings } from './types';

interface CostSurfaceProps {
  isDark: boolean;
  resolution?: number;
}

export function CostSurface({ isDark, resolution }: CostSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Get quality settings (resolution) based on device
  const quality = useMemo(() => getQualitySettings(), []);
  const actualResolution = resolution ?? quality.surfaceResolution;
  
  // Generate the displaced geometry with vertex colors
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      SURFACE_SIZE.width, 
      SURFACE_SIZE.depth, 
      actualResolution, 
      actualResolution
    );
    
    // Rotate to lie in XZ plane (Y-up)
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position.array as Float32Array;
    const colors = new Float32Array(positions.length); // RGB per vertex
    
    // Displace Y based on cost function and set vertex colors
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      
      // Map mesh coordinates to parameter space
      const w = COST_RANGE.wMin + 
        ((x + SURFACE_SIZE.width / 2) / SURFACE_SIZE.width) * 
        (COST_RANGE.wMax - COST_RANGE.wMin);
      const b = COST_RANGE.bMin + 
        ((z + SURFACE_SIZE.depth / 2) / SURFACE_SIZE.depth) * 
        (COST_RANGE.bMax - COST_RANGE.bMin);
      
      // Compute cost and set Y position with height scaling
      const cost = computeCost(w, b);
      positions[i + 1] = cost * HEIGHT_SCALE;
      
      // Compute color based on normalized cost
      const normalizedCost = Math.min(cost / MAX_COST, 1);
      const color = getVertexColor(normalizedCost, isDark);
      
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    
    // Add vertex colors attribute
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Recompute normals for proper lighting
    geo.computeVertexNormals();
    
    return geo;
  }, [actualResolution, isDark]);
  
  // Optional: subtle animation
  useFrame(() => {
    // Currently disabled - can add subtle effects if desired
  });
  
  return (
    <group>
      {/* Main surface mesh */}
      <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.4}
          metalness={0.2}
          transparent
          opacity={0.92}
          flatShading={false}
        />
      </mesh>
      
      {/* Wireframe overlay for texture/definition */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={isDark ? '#1e293b' : '#64748b'}
          wireframe
          transparent
          opacity={isDark ? 0.15 : 0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Hex color string to RGB object (values 0-1)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Get vertex color based on normalized cost value (0-1)
 * Uses smooth interpolation between color stops
 */
function getVertexColor(normalizedCost: number, isDark: boolean): { r: number; g: number; b: number } {
  const colorStops = isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS;
  const t = Math.max(0, Math.min(1, normalizedCost));
  
  // Find the two color stops to interpolate between
  let lowerIdx = 0;
  let upperIdx = colorStops.length - 1;
  
  for (let i = 0; i < colorStops.length - 1; i++) {
    if (t >= colorStops[i].position && t <= colorStops[i + 1].position) {
      lowerIdx = i;
      upperIdx = i + 1;
      break;
    }
  }
  
  const lower = colorStops[lowerIdx];
  const upper = colorStops[upperIdx];
  
  // Calculate interpolation factor within this segment
  const segmentRange = upper.position - lower.position;
  const segmentT = segmentRange > 0 
    ? (t - lower.position) / segmentRange 
    : 0;
  
  // Apply smooth easing for nicer transitions
  const smoothT = segmentT * segmentT * (3 - 2 * segmentT); // Smoothstep
  
  // Interpolate between the two colors
  const lowerRgb = hexToRgb(lower.color);
  const upperRgb = hexToRgb(upper.color);
  
  return {
    r: lowerRgb.r + (upperRgb.r - lowerRgb.r) * smoothT,
    g: lowerRgb.g + (upperRgb.g - lowerRgb.g) * smoothT,
    b: lowerRgb.b + (upperRgb.b - lowerRgb.b) * smoothT,
  };
}

export default CostSurface;
