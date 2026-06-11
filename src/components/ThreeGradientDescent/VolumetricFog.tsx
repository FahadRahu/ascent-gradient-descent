/**
 * VolumetricFog Component (Phase C4.3)
 * 
 * Atmospheric fog that accumulates at the bottom of the cost surface bowl.
 * Creates a mystical, ethereal feel at the optimization minimum.
 * 
 * Features:
 * - Positioned at the optimal point (minimum cost)
 * - Animated swirling motion
 * - Gradient fade from bottom to top
 * - Theme-aware coloring
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OPTIMAL_PARAMS, paramsToThreeCoords, computeCost } from './utils/costFunction';

interface VolumetricFogProps {
  isDark: boolean;
  intensity?: number;
  show?: boolean;
}

export function VolumetricFog({ 
  isDark, 
  intensity = 0.4,
  show = true
}: VolumetricFogProps) {
  const fogRef = useRef<THREE.Mesh>(null);
  
  // Calculate fog position (at the minimum point)
  const fogPosition = useMemo<[number, number, number]>(() => {
    const minCost = computeCost(OPTIMAL_PARAMS.w, OPTIMAL_PARAMS.b);
    const coords = paramsToThreeCoords(OPTIMAL_PARAMS.w, OPTIMAL_PARAMS.b, minCost);
    return [coords[0], coords[1] + 0.3, coords[2]]; // Slightly above the surface
  }, []);
  
  // Shader uniforms
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(isDark ? '#1e1b4b' : '#bfdbfe') },
    uGlowColor: { value: new THREE.Color(isDark ? '#22d3ee' : '#10b981') },
    uIntensity: { value: intensity },
  }), [isDark, intensity]);
  
  // Update uniforms when theme changes
  useMemo(() => {
    uniforms.uColor.value.set(isDark ? '#1e1b4b' : '#bfdbfe');
    uniforms.uGlowColor.value.set(isDark ? '#22d3ee' : '#10b981');
  }, [isDark, uniforms]);
  
  // Animate fog
  useFrame(({ clock }) => {
    if (!fogRef.current || !show) return;
    
    const material = fogRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = clock.elapsedTime;
    
    // Gentle breathing scale
    const scale = 1 + Math.sin(clock.elapsedTime * 0.5) * 0.05;
    fogRef.current.scale.setScalar(scale);
    
    // Slow rotation
    fogRef.current.rotation.y = clock.elapsedTime * 0.1;
  });
  
  if (!show) return null;
  
  return (
    <mesh ref={fogRef} position={fogPosition}>
      <cylinderGeometry args={[0.6, 0.8, 0.6, 32, 8, true]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying float vHeight;
          
          void main() {
            vUv = uv;
            vHeight = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          uniform vec3 uGlowColor;
          uniform float uIntensity;
          
          varying vec2 vUv;
          varying float vHeight;
          
          // Simple noise function
          float noise(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
          }
          
          void main() {
            // Height-based fade (denser at bottom)
            float heightFade = 1.0 - smoothstep(-0.3, 0.3, vHeight);
            
            // Animated swirl pattern
            float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
            float swirl = sin(angle * 3.0 + uTime * 0.5) * 0.15 + 0.85;
            
            // Add noise for organic look
            float n = noise(vUv * 5.0 + uTime * 0.2) * 0.2;
            
            // Mix base color with glow color
            vec3 color = mix(uColor, uGlowColor, heightFade * 0.6);
            
            // Final alpha calculation
            float alpha = heightFade * swirl * uIntensity * (0.5 + n);
            alpha = clamp(alpha, 0.0, 0.6);
            
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
}

export default VolumetricFog;
