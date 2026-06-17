import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { extend, useFrame, useThree, type ThreeElement } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { TIER_SETTINGS } from '../quality/tiers';
import { vScaleFor } from './surfaceMapping';
import { FUNCTION_GLSL_INDEX } from './shaders/functionField';
import { bakeFlowField } from './flowField';
import { swarmVertexShader, swarmFragmentShader } from './shaders/swarmShaders';

/**
 * The stateless ambient swarm (spec §5.5, PRD §7). Raw <points> whose count is the
 * tier's ambientParticles. Position is computed entirely in the vertex shader from
 * (aSeed, aSpeed, uTime) flowing over the baked half-float flow texture (RISK #4) —
 * zero simulation state, zero per-frame setState. uTime is mutated on the material
 * ref in useFrame (two-channel rule). ON by default, scaled by tier; the fallback
 * tier (count 0) renders nothing.
 */
const SwarmMaterial = shaderMaterial(
  {
    uTime: 0,
    uSize: 16,
    uVScale: 1,
    uFunction: 0,
    uParamMin: new THREE.Vector2(),
    uParamRange: new THREE.Vector2(),
    uFlow: null as THREE.Texture | null,
    uLifetime: 6.0,
    uFlowStep: 2.0,
  },
  swarmVertexShader,
  swarmFragmentShader,
);

extend({ SwarmMaterial });

// TS JSX augmentation — VERIFIED typecheck-clean under fiber 9.6 / React 19.
declare module '@react-three/fiber' {
  interface ThreeElements {
    swarmMaterial: ThreeElement<typeof SwarmMaterial>;
  }
}

export default function Swarm() {
  const functionId = useUIStore((s) => s.functionId);
  const tier = useUIStore((s) => s.tier);
  const invalidate = useThree((s) => s.invalidate);
  const dpr = useThree((s) => s.viewport.dpr);

  const matRef = useRef<THREE.ShaderMaterial & { uTime: number }>(null);
  const count = TIER_SETTINGS[tier].ambientParticles;

  // Tier-count buffers (re-derived only when the count changes). attributes-position
  // is a DUMMY — the count drives the draw; real positions are computed in the
  // vertex shader. BufferAttribute throws on a plain Array → must be TypedArrays.
  const { posF32, seedF32, speedF32 } = useMemo(() => {
    const n = Math.max(count, 1); // never allocate a 0-length attribute
    const posF32 = new Float32Array(n * 3);
    const seedF32 = new Float32Array(n);
    const speedF32 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      seedF32[i] = Math.random();
      speedF32[i] = 0.5 + Math.random(); // ~0.5..1.5 life-rate spread
    }
    return { posF32, seedF32, speedF32 };
  }, [count]);

  // Bake the flow field once per function (RISK #4). Disposed on change → no leak.
  const flow = useMemo(() => bakeFlowField(functionId), [functionId]);
  useEffect(() => () => flow.dispose(), [flow]);

  // Apply function/tier-dependent uniforms imperatively + force one frame (frameloop
  // may be 'demand' while paused, like the Surface's effect).
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const fn = getFunction(functionId);
    const [xMin, xMax, yMin, yMax] = fn.domain;
    mat.uniforms.uFunction.value = FUNCTION_GLSL_INDEX[functionId] ?? 0;
    mat.uniforms.uVScale.value = vScaleFor(functionId);
    (mat.uniforms.uParamMin.value as THREE.Vector2).set(xMin, yMin);
    (mat.uniforms.uParamRange.value as THREE.Vector2).set(xMax - xMin, yMax - yMin);
    mat.uniforms.uFlow.value = flow;
    mat.uniforms.uSize.value = 16 * Math.min(dpr, 1.5); // cap particle-pass pixelRatio
    invalidate();
  }, [functionId, flow, dpr, invalidate]);

  // Two-channel rule: advance uTime on the material ref only (never setState).
  useFrame((_, delta) => {
    const mat = matRef.current;
    if (mat) mat.uniforms.uTime.value += delta;
  });

  if (count <= 0) return null; // fallback tier

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posF32, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seedF32, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speedF32, 1]} />
      </bufferGeometry>
      <swarmMaterial ref={matRef} transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending} />
    </points>
  );
}
