/**
 * Markers Component
 * 
 * Renders visual markers for important positions on the cost surface:
 * - Start marker: Where gradient descent begins
 * - Optimal marker: The global minimum (target)
 * 
 * Features:
 * - Distinct shapes for each marker type
 * - Theme-aware colors
 * - Subtle animations for visibility
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { paramsToThreeCoords, OPTIMAL_PARAMS } from './utils/costFunction';
import { GradientDescentPoint } from './types';

interface MarkersProps {
  /** Starting point of the gradient descent */
  startPoint: GradientDescentPoint;
  /** Theme mode */
  isDark: boolean;
  /** Whether to show the optimal marker */
  showOptimal?: boolean;
}

export function Markers({ startPoint, isDark, showOptimal = true }: MarkersProps) {
  return (
    <group>
      {/* Start Position Marker */}
      <StartMarker 
        point={startPoint} 
        isDark={isDark} 
      />
      
      {/* Optimal Position Marker */}
      {showOptimal && (
        <OptimalMarker isDark={isDark} />
      )}
    </group>
  );
}

/**
 * Start Marker - Purple diamond shape
 */
interface StartMarkerProps {
  point: GradientDescentPoint;
  isDark: boolean;
}

function StartMarker({ point, isDark }: StartMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  const position = paramsToThreeCoords(point.w, point.b, point.cost);
  
  // Gentle rotation animation
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.5;
    }
    if (glowRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2) * 0.1;
      glowRef.current.scale.setScalar(pulse);
    }
  });
  
  // Purple colors for start
  const markerColor = isDark ? '#a855f7' : '#9333ea';
  const glowColor = isDark ? '#c084fc' : '#a855f7';
  
  return (
    <group position={position}>
      {/* Diamond shape (octahedron) */}
      <mesh ref={meshRef} castShadow>
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial
          color={markerColor}
          emissive={markerColor}
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
      
      {/* Glow effect */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
      
      {/* Vertical line indicator */}
      <mesh position={[0, -position[1] / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, position[1], 8]} />
        <meshBasicMaterial
          color={markerColor}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Educational label: START - slightly offset to avoid clipping, but close to marker */}
      <Billboard position={[-0.3, 0.5, -0.3]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.28}
          color={isDark ? '#c084fc' : '#9333ea'}
          outlineWidth={0.05}
          outlineColor={isDark ? '#1e1b4b' : '#faf5ff'}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          START
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Optimal Marker - Green star/diamond at the minimum
 */
function OptimalMarker({ isDark }: { isDark: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  // Position at the optimal minimum
  const position = paramsToThreeCoords(
    OPTIMAL_PARAMS.w, 
    OPTIMAL_PARAMS.b, 
    OPTIMAL_PARAMS.cost
  );
  
  // Subtle animations
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.8;
      const float = Math.sin(clock.elapsedTime * 1.5) * 0.02;
      meshRef.current.position.y = float;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * 0.3;
      const pulse = 1 + Math.sin(clock.elapsedTime * 2) * 0.15;
      ringRef.current.scale.setScalar(pulse);
    }
  });
  
  // DARK Green colors for optimal - high contrast against cyan surface
  const markerColor = isDark ? '#166534' : '#14532d';  // Much darker green
  const glowColor = isDark ? '#15803d' : '#166534';    // Dark glow
  
  return (
    <group position={position}>
      {/* Star/diamond shape */}
      <mesh ref={meshRef} castShadow>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial
          color={markerColor}
          emissive={markerColor}
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
      
      {/* Rotating ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.015, 8, 24]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.5}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
      
      {/* Point light */}
      <pointLight
        color={markerColor}
        intensity={0.4}
        distance={1.5}
        decay={2}
      />
      
      {/* Ground indicator - vertical line to surface base */}
      <mesh position={[0, -position[1] / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, position[1], 8]} />
        <meshBasicMaterial
          color={markerColor}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* Educational label: MINIMUM - DARK green for contrast against cyan surface */}
      <Billboard position={[0, 0.5, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.3}
          color={isDark ? '#166534' : '#14532d'}  // Much darker green
          outlineWidth={0.06}
          outlineColor={isDark ? '#dcfce7' : '#f0fdf4'}  // Light outline for contrast
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          MINIMUM
        </Text>
      </Billboard>
      
      {/* Educational sublabel: lowest cost - also dark */}
      <Billboard position={[0, 0.25, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.15}
          color={isDark ? '#15803d' : '#166534'}  // Darker green
          outlineWidth={0.03}
          outlineColor={isDark ? '#dcfce7' : '#f0fdf4'}  // Light outline
          anchorX="center"
          anchorY="middle"
        >
          (lowest cost)
        </Text>
      </Billboard>
    </group>
  );
}

export default Markers;
