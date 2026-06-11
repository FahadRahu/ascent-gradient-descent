/**
 * RimLightEffect Component (Phase C3.3)
 * 
 * Adds fresnel-based rim lighting effect to enhance the surface edges.
 * Creates a glowing edge effect that makes the surface pop visually.
 * 
 * Features:
 * - Fresnel-based edge glow
 * - Glow at minimum (bowl bottom)
 * - Theme-aware coloring
 * - Desktop-only for performance
 */

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  SURFACE_SIZE, 
  COST_RANGE, 
  HEIGHT_SCALE, 
  computeCost 
} from './utils/costFunction';

interface RimLightEffectProps {
  /** Theme mode */
  isDark: boolean;
  /** Rim light intensity */
  intensity?: number;
  /** Resolution of the effect mesh */
  resolution?: number;
}

export function RimLightEffect({ 
  isDark, 
  intensity = 0.6,
  resolution = 40 
}: RimLightEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();
  
  // Generate geometry that matches the cost surface
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      SURFACE_SIZE.width,
      SURFACE_SIZE.depth,
      resolution,
      resolution
    );
    
    const positions = geo.attributes.position.array as Float32Array;
    
    // Displace Y based on cost function (same as CostSurface)
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      
      // Convert mesh position to parameter space
      const w = COST_RANGE.wMin + 
        ((x + SURFACE_SIZE.width / 2) / SURFACE_SIZE.width) * 
        (COST_RANGE.wMax - COST_RANGE.wMin);
      const b = COST_RANGE.bMin + 
        ((z + SURFACE_SIZE.depth / 2) / SURFACE_SIZE.depth) * 
        (COST_RANGE.bMax - COST_RANGE.bMin);
      
      const cost = computeCost(w, b);
      positions[i + 1] = cost * HEIGHT_SCALE + 0.001; // Slight offset above main surface
    }
    
    geo.computeVertexNormals();
    return geo;
  }, [resolution]);
  
  // Custom shader material for fresnel rim lighting
  const shaderMaterial = useMemo(() => {
    const rimColor = isDark ? '#06b6d4' : '#f472b6'; // Cyan in dark, pink in light
    const minGlowColor = isDark ? '#22d3ee' : '#10b981'; // Cyan/emerald at minimum
    
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uCameraPosition: { value: new THREE.Vector3() },
        uRimColor: { value: new THREE.Color(rimColor) },
        uMinGlowColor: { value: new THREE.Color(minGlowColor) },
        uRimPower: { value: 2.5 },
        uRimIntensity: { value: intensity },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vCost;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vCost = position.y; // Y is the height (cost * scale)
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uCameraPosition;
        uniform vec3 uRimColor;
        uniform vec3 uMinGlowColor;
        uniform float uRimPower;
        uniform float uRimIntensity;
        uniform float uTime;
        
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vCost;
        
        void main() {
          // Calculate view direction
          vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
          
          // Fresnel calculation
          float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uRimPower);
          
          // Rim glow
          vec3 rimGlow = uRimColor * fresnel * uRimIntensity;
          
          // Glow at minimum (bowl bottom) - stronger when cost is low
          float minGlowStrength = exp(-vCost * 15.0) * 0.4;
          vec3 minGlow = uMinGlowColor * minGlowStrength;
          
          // Subtle pulse animation at minimum
          minGlow *= 0.8 + sin(uTime * 2.0) * 0.2;
          
          // Combined glow
          vec3 finalColor = rimGlow + minGlow;
          
          // Alpha based on effect strength
          float alpha = (fresnel * uRimIntensity * 0.5) + (minGlowStrength * 0.3);
          alpha = clamp(alpha, 0.0, 0.6);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });
  }, [isDark, intensity]);
  
  // Update uniforms every frame
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uCameraPosition.value.copy(camera.position);
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });
  
  return (
    <mesh 
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}

export default RimLightEffect;
