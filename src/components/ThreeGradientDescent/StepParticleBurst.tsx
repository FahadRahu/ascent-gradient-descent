/**
 * StepParticleBurst Component
 * 
 * Creates a burst of particles when the gradient descent takes a step.
 * Particles explode outward and fade away, creating an energy release effect.
 * 
 * Features:
 * - Burst triggered on step change
 * - Physics-based particle movement (gravity, velocity)
 * - Fade out over time
 * - Theme-aware colors
 */

import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StepParticleBurstProps {
  /** Current position [x, y, z] */
  position: [number, number, number];
  /** Step count - burst triggers when this changes */
  trigger: number;
  /** Theme mode */
  isDark: boolean;
  /** Number of particles to emit */
  particleCount?: number;
  /** Whether animation is playing */
  isPlaying: boolean;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  size: number;
}

export function StepParticleBurst({ 
  position, 
  trigger, 
  isDark, 
  particleCount = 15,
  isPlaying
}: StepParticleBurstProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastTrigger = useRef(trigger);
  
  // Create particle geometry data
  const { positions, sizes, opacities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);
    
    // Initialize all particles at origin with zero opacity
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      sizes[i] = 0;
      opacities[i] = 0;
    }
    
    return { positions, sizes, opacities };
  }, [particleCount]);
  
  // Trigger burst when step changes
  useEffect(() => {
    if (trigger !== lastTrigger.current && trigger > 0 && isPlaying) {
      lastTrigger.current = trigger;
      
      // Create new burst of particles
      const newParticles: Particle[] = [];
      
      for (let i = 0; i < particleCount; i++) {
        // Random spherical direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 1.5 + Math.random() * 2.5;
        
        // Add upward bias for visual effect
        const vx = Math.sin(phi) * Math.cos(theta) * speed;
        const vy = Math.abs(Math.cos(phi)) * speed + 1.5; // Bias upward
        const vz = Math.sin(phi) * Math.sin(theta) * speed;
        
        newParticles.push({
          position: new THREE.Vector3(position[0], position[1], position[2]),
          velocity: new THREE.Vector3(vx, vy, vz),
          lifetime: 1.0,
          maxLifetime: 0.6 + Math.random() * 0.4, // 0.6-1.0 seconds
          size: 0.03 + Math.random() * 0.04
        });
      }
      
      setParticles(newParticles);
    }
  }, [trigger, position, particleCount, isPlaying]);
  
  // Animate particles
  useFrame((_, delta) => {
    if (!pointsRef.current || particles.length === 0) return;
    
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const sizeArray = pointsRef.current.geometry.attributes.size.array as Float32Array;
    const opacityArray = pointsRef.current.geometry.attributes.opacity.array as Float32Array;
    
    let anyAlive = false;
    const gravity = -15; // Gravity strength
    
    particles.forEach((particle, i) => {
      if (particle.lifetime > 0) {
        anyAlive = true;
        
        // Update lifetime
        particle.lifetime -= delta / particle.maxLifetime;
        
        // Apply gravity to velocity
        particle.velocity.y += gravity * delta;
        
        // Apply drag
        particle.velocity.multiplyScalar(0.98);
        
        // Update position
        particle.position.add(particle.velocity.clone().multiplyScalar(delta));
        
        // Update geometry data
        posArray[i * 3] = particle.position.x;
        posArray[i * 3 + 1] = particle.position.y;
        posArray[i * 3 + 2] = particle.position.z;
        
        // Size shrinks as particle dies
        sizeArray[i] = particle.size * Math.max(0, particle.lifetime);
        
        // Opacity fades out
        opacityArray[i] = Math.max(0, particle.lifetime) * 0.8;
      } else {
        // Dead particle - hide it
        sizeArray[i] = 0;
        opacityArray[i] = 0;
      }
    });
    
    // Mark attributes as needing update
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.size.needsUpdate = true;
    pointsRef.current.geometry.attributes.opacity.needsUpdate = true;
    
    // Clear particles when all are dead
    if (!anyAlive && particles.length > 0) {
      setParticles([]);
    }
  });
  
  // Particle color based on theme
  const particleColor = isDark ? '#fbbf24' : '#f59e0b'; // Amber/yellow
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={particleCount}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={particleCount}
          array={opacities}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={particleColor}
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default StepParticleBurst;
