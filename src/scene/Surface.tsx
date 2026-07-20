import { useEffect, useMemo, useRef } from 'react';
import type { Ref } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import CustomShaderMaterial from 'three-custom-shader-material';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { TIER_SETTINGS } from '../quality/tiers';
import { SURFACE_SIZE, vScaleFor } from './surfaceMapping';
import { FUNCTION_GLSL_INDEX } from './shaders/functionField';
import { surfaceVertexShader, surfaceFragmentShader } from './shaders/surfaceShaders';

/**
 * Shape of the locked uniforms object (one instance, shared with the depth
 * pass). The `[key: string]` index signature makes it assignable to CSM's
 * `uniforms` prop type (`{ [k: string]: { value: unknown } }`) while the named
 * fields keep the LOCKED uniform names documented and type-checked.
 */
interface SurfaceUniforms {
  [key: string]: { value: unknown };
  uFunction: { value: number };
  uVScale: { value: number };
  uParamMin: { value: THREE.Vector2 };
  uParamRange: { value: THREE.Vector2 };
  uContourSpacing: { value: number };
  uColorLow: { value: number };
  uColorHigh: { value: number };
}

/**
 * The CSM material *instance* type for a given base-material constructor `T`.
 * `three-custom-shader-material@6` does not export its `CustomShaderMaterial<T>`
 * class, so we recover it from the default export's `ref` prop (typed
 * `Ref<CustomShaderMaterial<T>>`). Exposes `.uniforms` for imperative reads in
 * later phases. `MatCtor` mirrors CSM's own `MaterialConstructor` (any[] args).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MatCtor = new (...args: any[]) => THREE.Material;
type CSMaterial<T extends MatCtor> =
  Parameters<typeof CustomShaderMaterial<T>>[0] extends { ref?: Ref<infer E> } ? E : never;

/**
 * The GPU-displaced magma cost surface (PRD §5.1 / §6.4). A static plane at the
 * tier's segment count, displaced in the vertex shader (csm_Position.z) with an
 * analytic normal, coloured by the magma ramp + AA contours in the fragment
 * shader. A second CSM serves as the customDepthMaterial so shadows follow the
 * displacement (SMOKE-TEST RISK #1; fallback documented in the plan).
 *
 * ⚠️ SMOKE-TEST RISK #1: CSM's availability map doesn't enumerate
 * MeshDepthMaterial, so the depth-material path below may fail to compile a real
 * GLSL program. The @react-three/test-renderer in Surface.test.tsx uses a MOCK
 * GL (it does NOT compile shaders), so the unit test only proves the React/Three
 * tree is well-formed (Mesh + material + customDepthMaterial, no throw). REAL
 * GLSL-compile verification is deferred to Task 15's live-browser smoke (zero
 * WebGL console errors + screenshot). If the depth CSM fails to compile there,
 * swap it for the Plan-B fallback documented at the bottom of this file.
 */
export function Surface() {
  const functionId = useUIStore((s) => s.functionId);
  const tier = useUIStore((s) => s.tier);
  const invalidate = useThree((s) => s.invalidate);

  const segments = TIER_SETTINGS[tier].surfaceSegments || 1; // guard 0 (fallback tier never mounts Canvas, so unreachable in practice)

  const matRef = useRef<CSMaterial<typeof THREE.MeshPhysicalMaterial>>(null);
  const depthRef = useRef<CSMaterial<typeof THREE.MeshDepthMaterial>>(null);

  // Create the uniforms ONCE (stable identity). Mutated imperatively below.
  // The SAME object is handed to both the main material and the depth material.
  const uniforms = useMemo<SurfaceUniforms>(() => {
    const fn = getFunction(functionId);
    const [xMin, xMax, yMin, yMax] = fn.domain;
    return {
      uFunction: { value: FUNCTION_GLSL_INDEX[functionId] ?? 0 },
      uVScale: { value: vScaleFor(functionId) },
      uParamMin: { value: new THREE.Vector2(xMin, yMin) },
      uParamRange: { value: new THREE.Vector2(xMax - xMin, yMax - yMin) },
      uContourSpacing: { value: 0.08 },
      uColorLow: { value: 0.12 },
      uColorHigh: { value: 1.0 },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // created once; function changes are applied imperatively in the effect

  // On functionId change, update the displacement uniforms + request one frame.
  useEffect(() => {
    const fn = getFunction(functionId);
    const [xMin, xMax, yMin, yMax] = fn.domain;
    uniforms.uFunction.value = FUNCTION_GLSL_INDEX[functionId] ?? 0;
    uniforms.uVScale.value = vScaleFor(functionId);
    uniforms.uParamMin.value.set(xMin, yMin);
    uniforms.uParamRange.value.set(xMax - xMin, yMax - yMin);
    invalidate(); // frameloop may be 'demand' while paused
  }, [functionId, uniforms, invalidate]);

  // Animate the contour drift only while playing (keeps idle frames cheap).
  // Two-channel rule: ANY uiStore read inside a useFrame MUST be transient via
  // getState() — never the reactive useUIStore(selector) form — or play/pause
  // would re-render Surface every toggle and the frame callback would close over
  // stale render state. (functionId/tier above ARE reactive subscriptions, but
  // only because they drive the useEffect deps + geometry setup, not this loop.)
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow castShadow>
      <planeGeometry args={[SURFACE_SIZE, SURFACE_SIZE, segments, segments]} />
      {/* Main lit material: full PBR via MeshPhysicalMaterial base. */}
      <CustomShaderMaterial
        ref={matRef}
        baseMaterial={THREE.MeshPhysicalMaterial}
        vertexShader={surfaceVertexShader}
        fragmentShader={surfaceFragmentShader}
        uniforms={uniforms}
        roughness={0.5}
        metalness={0.04}
        clearcoat={0.28}
        clearcoatRoughness={0.24}
        dithering
        fog
      />
      {/* Depth material running the SAME displacement so shadows follow it.
          Shares the SAME uniforms object (stable identity). RISK #1: if this
          fails to compile in the browser, swap to the Plan-B fallback below. */}
      <CustomShaderMaterial
        ref={depthRef}
        attach="customDepthMaterial"
        baseMaterial={THREE.MeshDepthMaterial}
        vertexShader={surfaceVertexShader}
        uniforms={uniforms}
        depthPacking={THREE.RGBADepthPacking}
      />
    </mesh>
  );
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PLAN-B FALLBACK for SMOKE-TEST RISK #1 (apply ONLY if the second CSM above —
 * baseMaterial={THREE.MeshDepthMaterial} — fails to compile in the live-browser
 * smoke at Task 15). Replace ONLY the second <CustomShaderMaterial> with a plain
 * THREE.MeshDepthMaterial whose onBeforeCompile injects the same displacement
 * into three's `#include <begin_vertex>` chunk. The main material is unchanged.
 *
 * Requires a direct import:  import { functionFieldGLSL } from './shaders/functionField';
 *
 *   const depthMaterial = useMemo(() => {
 *     const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
 *     m.onBeforeCompile = (shader) => {
 *       // Share the SAME uniform objects so depth tracks the lit displacement.
 *       shader.uniforms.uFunction = uniforms.uFunction;
 *       shader.uniforms.uVScale = uniforms.uVScale;
 *       shader.uniforms.uParamMin = uniforms.uParamMin;
 *       shader.uniforms.uParamRange = uniforms.uParamRange;
 *       // Prepend our consts + uniforms + the field functions, then displace.
 *       shader.vertexShader =
 *         `#define SURFACE_SIZE 4.0\n` +
 *         `uniform int uFunction;\nuniform float uVScale;\nuniform vec2 uParamMin;\nuniform vec2 uParamRange;\n` +
 *         functionFieldGLSL +
 *         shader.vertexShader.replace(
 *           '#include <begin_vertex>',
 *           `#include <begin_vertex>
 *            vec2 p = uParamMin + uv * uParamRange;
 *            transformed.z = uVScale * surfaceHeight(uFunction, p);`,
 *         );
 *     };
 *     return m;
 *   }, [uniforms]);
 *
 * …then change the mesh's depth attachment to:
 *   <primitive object={depthMaterial} attach="customDepthMaterial" />
 *
 * The unit test still passes (the tree still has a customDepthMaterial); record
 * in the commit body which path shipped.
 * ─────────────────────────────────────────────────────────────────────────────
 */
