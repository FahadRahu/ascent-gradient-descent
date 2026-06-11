/**
 * FlowingParticles Component (Enhanced)
 *
 * Decorative particles that flow along the gradient descent path toward the minimum.
 * Creates a visual metaphor for optimization - particles follow the steepest descent
 * just like the gradient descent algorithm.
 *
 * Features:
 * - Particles follow actual gradient direction (not just attraction)
 * - Speed varies based on gradient magnitude (faster on steep slopes)
 * - Trail/afterimage effect via opacity fade
 * - InstancedMesh for O(1) draw calls
 * - Theme-aware colors
 * - Desktop only for performance
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  computeCost,
  computeGradients,
  COST_RANGE,
  OPTIMAL_PARAMS,
  paramsToThreeCoords,
  SURFACE_SIZE,
  HEIGHT_SCALE,
} from './utils/costFunction';
import { getQualitySettings } from './types';

interface FlowingParticlesProps {
  /** Theme mode */
  isDark: boolean;
  /** Whether to show particles */
  show?: boolean;
  /** Number of particles (default: 50) */
  count?: number;
}

// Particle settings
const PARTICLE_SIZE = 0.025;
const BASE_SPEED = 0.8;
const MIN_SPEED = 0.2;
const MAX_SPEED = 2.0;
const SPAWN_HEIGHT_OFFSET = 0.08; // Above surface
const RESPAWN_THRESHOLD = 0.15; // Distance to optimal to respawn
const WOBBLE_AMPLITUDE = 0.015;
const WOBBLE_FREQUENCY = 3;

// Optimal point in 3D space
const OPTIMAL_3D = paramsToThreeCoords(OPTIMAL_PARAMS.w, OPTIMAL_PARAMS.b, OPTIMAL_PARAMS.cost);

/**
 * Particle state structure
 */
interface ParticleState {
  // Parameter space position
  w: number;
  b: number;
  // 3D position (derived from w, b)
  position: THREE.Vector3;
  // Age for lifecycle management
  age: number;
  lifetime: number;
  // Random offset for variation
  phase: number;
  // Trail opacity
  opacity: number;
}

/**
 * Initialize a single particle at a random position on the surface
 */
function initializeParticle(): ParticleState {
  // Random position in parameter space (avoid starting at optimal)
  const w = COST_RANGE.wMin + Math.random() * (COST_RANGE.wMax - COST_RANGE.wMin);
  const b = COST_RANGE.bMin + Math.random() * (COST_RANGE.bMax - COST_RANGE.bMin);
  const cost = computeCost(w, b);

  // Map to 3D
  const x =
    ((w - COST_RANGE.wMin) / (COST_RANGE.wMax - COST_RANGE.wMin) - 0.5) * SURFACE_SIZE.width;
  const z =
    ((b - COST_RANGE.bMin) / (COST_RANGE.bMax - COST_RANGE.bMin) - 0.5) * SURFACE_SIZE.depth;
  const y = cost * HEIGHT_SCALE + SPAWN_HEIGHT_OFFSET;

  return {
    w,
    b,
    position: new THREE.Vector3(x, y, z),
    age: 0,
    lifetime: 4 + Math.random() * 6, // 4-10 seconds
    phase: Math.random() * Math.PI * 2,
    opacity: 0.8,
  };
}

/**
 * Respawn particle at a new random high-cost position
 */
function respawnParticle(particle: ParticleState): void {
  // Spawn at edges of parameter space (high cost regions)
  const edge = Math.floor(Math.random() * 4);
  let w: number, b: number;

  switch (edge) {
    case 0: // Top edge
      w = COST_RANGE.wMin + Math.random() * (COST_RANGE.wMax - COST_RANGE.wMin);
      b = COST_RANGE.bMax - Math.random() * 0.5;
      break;
    case 1: // Right edge
      w = COST_RANGE.wMax - Math.random() * 0.5;
      b = COST_RANGE.bMin + Math.random() * (COST_RANGE.bMax - COST_RANGE.bMin);
      break;
    case 2: // Bottom edge
      w = COST_RANGE.wMin + Math.random() * (COST_RANGE.wMax - COST_RANGE.wMin);
      b = COST_RANGE.bMin + Math.random() * 0.5;
      break;
    default: // Left edge
      w = COST_RANGE.wMin + Math.random() * 0.5;
      b = COST_RANGE.bMin + Math.random() * (COST_RANGE.bMax - COST_RANGE.bMin);
  }

  particle.w = w;
  particle.b = b;

  const cost = computeCost(w, b);
  const x =
    ((w - COST_RANGE.wMin) / (COST_RANGE.wMax - COST_RANGE.wMin) - 0.5) * SURFACE_SIZE.width;
  const z =
    ((b - COST_RANGE.bMin) / (COST_RANGE.bMax - COST_RANGE.bMin) - 0.5) * SURFACE_SIZE.depth;
  const y = cost * HEIGHT_SCALE + SPAWN_HEIGHT_OFFSET;

  particle.position.set(x, y, z);
  particle.age = 0;
  particle.lifetime = 4 + Math.random() * 6;
  particle.phase = Math.random() * Math.PI * 2;
  particle.opacity = 0.8;
}

export function FlowingParticles({ isDark, show = true, count = 50 }: FlowingParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const quality = useMemo(() => getQualitySettings(), []);

  // Initialize particle states
  // ALL hooks must be called before any early returns (Rules of Hooks)
  const particles = useMemo<ParticleState[]>(() => {
    return Array.from({ length: count }, () => initializeParticle());
  }, [count]);

  // Pre-allocate transformation objects
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

  // Determine if we should render (but hooks still run)
  const shouldRender = show && quality.enableParticles;

  // Initialize instance matrices
  useEffect(() => {
    if (!meshRef.current || !shouldRender) return;

    particles.forEach((particle, i) => {
      tempMatrix.setPosition(particle.position);
      meshRef.current!.setMatrixAt(i, tempMatrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [particles, tempMatrix, shouldRender]);

  // Animation loop - update particle positions following gradient
  useFrame((state, delta) => {
    if (!meshRef.current || !shouldRender) return;

    const time = state.clock.elapsedTime;

    particles.forEach((particle, i) => {
      // Update age
      particle.age += delta;

      // Check distance to optimal
      const distToOptimal = particle.position.distanceTo(
        new THREE.Vector3(OPTIMAL_3D[0], OPTIMAL_3D[1], OPTIMAL_3D[2])
      );

      // Check if particle should respawn
      if (distToOptimal < RESPAWN_THRESHOLD || particle.age > particle.lifetime) {
        respawnParticle(particle);
        return;
      }

      // Compute gradient at current position
      const { dw, db } = computeGradients(particle.w, particle.b);
      const gradMagnitude = Math.sqrt(dw * dw + db * db);

      // Speed based on gradient magnitude (steeper = faster)
      const speed = THREE.MathUtils.clamp(BASE_SPEED * gradMagnitude * 0.5, MIN_SPEED, MAX_SPEED);

      // Move in negative gradient direction (descent)
      if (gradMagnitude > 0.001) {
        const stepW = (-dw / gradMagnitude) * speed * delta;
        const stepB = (-db / gradMagnitude) * speed * delta;

        // Add wobble for organic feel
        const wobbleW = Math.sin(time * WOBBLE_FREQUENCY + particle.phase) * WOBBLE_AMPLITUDE;
        const wobbleB = Math.cos(time * WOBBLE_FREQUENCY * 1.3 + particle.phase) * WOBBLE_AMPLITUDE;

        particle.w += stepW + wobbleW * delta;
        particle.b += stepB + wobbleB * delta;

        // Clamp to bounds
        particle.w = THREE.MathUtils.clamp(particle.w, COST_RANGE.wMin, COST_RANGE.wMax);
        particle.b = THREE.MathUtils.clamp(particle.b, COST_RANGE.bMin, COST_RANGE.bMax);

        // Update 3D position
        const cost = computeCost(particle.w, particle.b);
        const x =
          ((particle.w - COST_RANGE.wMin) / (COST_RANGE.wMax - COST_RANGE.wMin) - 0.5) *
          SURFACE_SIZE.width;
        const z =
          ((particle.b - COST_RANGE.bMin) / (COST_RANGE.bMax - COST_RANGE.bMin) - 0.5) *
          SURFACE_SIZE.depth;
        const y = cost * HEIGHT_SCALE + SPAWN_HEIGHT_OFFSET;

        particle.position.set(x, y, z);
      }

      // Fade opacity as particle ages
      particle.opacity = 0.8 * (1 - (particle.age / particle.lifetime) * 0.5);

      // Update instance matrix
      tempMatrix.setPosition(particle.position);
      meshRef.current!.setMatrixAt(i, tempMatrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Particle colors based on theme
  const particleColor = isDark ? '#a78bfa' : '#f97316'; // Purple in dark, orange in light
  const emissiveColor = isDark ? '#8b5cf6' : '#ea580c';

  // Early return AFTER all hooks (Rules of Hooks compliance)
  if (!shouldRender) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={true}>
      <sphereGeometry args={[PARTICLE_SIZE, 8, 6]} />
      <meshStandardMaterial
        color={particleColor}
        emissive={emissiveColor}
        emissiveIntensity={0.6}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export default FlowingParticles;
