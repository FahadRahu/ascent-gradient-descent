/**
 * PulsingRings Component
 * 
 * Creates expanding, fading rings around the descent ball.
 * Creates an energy/ripple visual effect when animation is playing.
 * 
 * Features:
 * - 3 concentric rings expanding outward
 * - Opacity fades as rings expand
 * - Rings reset in a staggered pattern
 * - Theme-aware colors
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PulsingRingsProps {
  /** Position of the ball [x, y, z] */
  position: [number, number, number];
  /** Whether animation is playing */
  isPlaying: boolean;
  /** Theme mode */
  isDark: boolean;
}

// Interface kept for potential future use - removed to satisfy TypeScript
// interface RingRef {
//   mesh: THREE.Mesh | null;
//   phase: number;
// }

export function PulsingRings({ position, isPlaying, isDark }: PulsingRingsProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  
  // Ring color based on theme
  const ringColor = isDark ? '#fca5a5' : '#f87171';
  
  useFrame(({ clock }) => {
    if (!isPlaying) {
      // Hide rings when not playing
      [ring1Ref, ring2Ref, ring3Ref].forEach(ref => {
        if (ref.current) {
          (ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      });
      return;
    }
    
    const t = clock.elapsedTime;
    const refs = [ring1Ref, ring2Ref, ring3Ref];
    
    refs.forEach((ref, i) => {
      if (!ref.current) return;
      
      // Stagger the phases of each ring
      const phase = (t * 1.5 + i * 0.33) % 1;
      
      // Scale: 1 -> 3 as phase goes 0 -> 1
      const scale = 1 + phase * 2;
      ref.current.scale.setScalar(scale);
      
      // Opacity: fades out as ring expands
      const opacity = (1 - phase) * 0.5;
      (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    });
  });
  
  return (
    <group position={position}>
      {/* Ring 1 */}
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.12, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Ring 2 - slightly offset phase */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.12, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Ring 3 - another offset phase */}
      <mesh ref={ring3Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.12, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export default PulsingRings;
