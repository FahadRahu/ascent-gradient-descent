/**
 * DescentBall Component
 * 
 * A glowing animated sphere that represents the current position
 * in the gradient descent optimization.
 * 
 * Features:
 * - Smooth position interpolation using spring physics
 * - Pulsing glow effect when animation is playing
 * - Squash-stretch deformation based on velocity
 * - Ghost trail showing recent positions
 * - Point light for ambient glow effect
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { GradientDescentPoint } from './types';
import { paramsToThreeCoords } from './utils/costFunction';

interface DescentBallProps {
  /** Current point in the gradient descent */
  currentPoint: GradientDescentPoint | null;
  /** Previous points for ghost trail (last 5-8 positions) */
  trailPoints: GradientDescentPoint[];
  /** Whether animation is currently playing */
  isPlaying: boolean;
  /** Theme mode */
  isDark: boolean;
}

// Ball visual constants - INCREASED for visibility
const BALL_RADIUS = 0.35;  // Much larger ball (was 0.12)
const GLOW_RADIUS = 0.5;   // Bigger glow (was 0.18)
const TRAIL_COUNT = 6;

// Squash-stretch constants
const MAX_STRETCH = 1.4;
const MIN_SQUASH = 0.7;
const VELOCITY_SCALE = 3.0;
const RETURN_SPEED = 0.15;

export function DescentBall({ currentPoint, trailPoints, isPlaying, isDark }: DescentBallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Track previous position for velocity calculation
  const lastPosition = useRef(new THREE.Vector3(0, 2, 0));
  const currentScale = useRef(new THREE.Vector3(1, 1, 1));
  const currentRotation = useRef(new THREE.Quaternion());
  
  // Calculate target position from current point
  const targetPosition = useMemo(() => {
    if (!currentPoint) return [0, 2, 0] as [number, number, number];
    return paramsToThreeCoords(currentPoint.w, currentPoint.b, currentPoint.cost);
  }, [currentPoint]);
  
  // Spring animation for smooth position changes
  const { position } = useSpring({
    position: targetPosition,
    config: { 
      tension: 120, 
      friction: 14,
      mass: 1
    }
  });
  
  // Pulsing glow animation and squash-stretch
  useFrame(({ clock }, _delta) => {
    if (glowRef.current && isPlaying) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    } else if (glowRef.current) {
      // Gentle idle pulse when paused
      const idlePulse = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.05;
      glowRef.current.scale.setScalar(idlePulse);
    }
    
    // Animate light intensity
    if (lightRef.current) {
      const intensity = isPlaying 
        ? 0.8 + Math.sin(clock.elapsedTime * 4) * 0.3
        : 0.6;
      lightRef.current.intensity = intensity;
    }
    
    // Squash-stretch animation based on velocity
    if (groupRef.current && meshRef.current) {
      // Get current animated position
      const currentPos = new THREE.Vector3(
        targetPosition[0],
        targetPosition[1],
        targetPosition[2]
      );
      
      // Calculate velocity
      const velocity = currentPos.clone().sub(lastPosition.current);
      const speed = velocity.length();
      lastPosition.current.copy(currentPos);
      
      if (isPlaying && speed > 0.001) {
        // Calculate stretch factor based on speed
        const stretchFactor = Math.min(1 + speed * VELOCITY_SCALE, MAX_STRETCH);
        // Squash to preserve volume (approximate)
        const squashFactor = Math.max(1 / Math.sqrt(stretchFactor), MIN_SQUASH);
        
        // Target scale: stretched along movement direction
        const targetScale = new THREE.Vector3(squashFactor, stretchFactor, squashFactor);
        
        // Smoothly interpolate to target scale
        currentScale.current.lerp(targetScale, 0.3);
        
        // Calculate rotation to align Y-axis with movement direction
        if (speed > 0.01) {
          const moveDir = velocity.normalize();
          const up = new THREE.Vector3(0, 1, 0);
          const targetQuat = new THREE.Quaternion();
          targetQuat.setFromUnitVectors(up, moveDir);
          currentRotation.current.slerp(targetQuat, 0.3);
        }
        
        // Apply transformation to the mesh
        meshRef.current.scale.copy(currentScale.current);
        meshRef.current.quaternion.copy(currentRotation.current);
      } else {
        // Return to sphere when stationary
        currentScale.current.lerp(new THREE.Vector3(1, 1, 1), RETURN_SPEED);
        currentRotation.current.slerp(new THREE.Quaternion(), RETURN_SPEED);
        
        meshRef.current.scale.copy(currentScale.current);
        meshRef.current.quaternion.copy(currentRotation.current);
      }
    }
  });
  
  // Colors based on theme - BRIGHT contrasting colors
  // Using bright yellow/orange for maximum visibility against the surface
  const ballColor = isDark ? '#fbbf24' : '#f59e0b'; // Amber/yellow - high contrast!
  const glowColor = isDark ? '#fef3c7' : '#fde68a'; // Light amber glow
  const lightColor = isDark ? '#fbbf24' : '#f59e0b';
  
  if (!currentPoint) return null;
  
  return (
    <>
      {/* Ghost Trail */}
      <GhostTrail 
        points={trailPoints} 
        isDark={isDark}
        ballColor={ballColor}
      />
      
      {/* Main Ball Group - Animated Position */}
      <animated.group position={position as unknown as THREE.Vector3}>
        {/* Core sphere - bright and prominent */}
        <mesh ref={meshRef} castShadow>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshStandardMaterial
            color={ballColor}
            emissive={ballColor}
            emissiveIntensity={0.8}  // Increased glow
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>
        
        {/* Outer glow sphere - larger and more visible */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[GLOW_RADIUS, 16, 16]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.35}  // More visible
            depthWrite={false}
          />
        </mesh>
        
        {/* Inner glow layer */}
        <mesh>
          <sphereGeometry args={[BALL_RADIUS + 0.05, 16, 16]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.5}  // More visible
            depthWrite={false}
          />
        </mesh>
        
        {/* Point light for ambient glow - stronger */}
        <pointLight
          ref={lightRef}
          color={lightColor}
          intensity={1.5}   // Much brighter (was 0.6)
          distance={5}      // Larger glow range (was 2)
          decay={2}
        />
      </animated.group>
    </>
  );
}

/**
 * Ghost Trail Component
 * 
 * Renders semi-transparent spheres at previous positions
 * to show the path the ball has taken.
 */
interface GhostTrailProps {
  points: GradientDescentPoint[];
  isDark: boolean;
  ballColor: string;
}

function GhostTrail({ points, isDark: _isDark, ballColor }: GhostTrailProps) {
  // Only show the last TRAIL_COUNT points
  const trailPoints = useMemo(() => {
    return points.slice(-TRAIL_COUNT);
  }, [points]);
  
  if (trailPoints.length === 0) return null;
  
  return (
    <group>
      {trailPoints.map((point, index) => {
        const position = paramsToThreeCoords(point.w, point.b, point.cost);
        // Fade out older positions
        const opacity = ((index + 1) / trailPoints.length) * 0.4;
        const scale = 0.6 + (index / trailPoints.length) * 0.3;
        
        return (
          <mesh 
            key={`trail-${point.iteration}`} 
            position={position}
            scale={scale}
          >
            <sphereGeometry args={[BALL_RADIUS * 0.7, 12, 12]} />
            <meshBasicMaterial
              color={ballColor}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default DescentBall;
