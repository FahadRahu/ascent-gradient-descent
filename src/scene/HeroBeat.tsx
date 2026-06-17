import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import type { Vec2 } from '../engine/types';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import { evaluateArrival } from './heroTrigger';
import { advanceHero, initialHeroState, heroNeedsFrames, type HeroState } from './heroState';
import type { HeroRefs } from './heroRefs';

/** Locked beat colours (PRD §5.5/§5.4). */
const CORE_CYAN = new THREE.Color('#00D3F2');
const WHITE_HOT = new THREE.Color(6, 6, 4); // ball core flash color={[6,6,4]}
const HALO_CYAN = new THREE.Color('#00D3F2'); // for the live-trail material .color (LDR)
const FUCHSIA = new THREE.Color('#ED6AFF'); // live-trail divergence (LDR)
// HDR halo targets for the PERSISTENT TUBE's uHaloColor uniform (authored ×1.8,
// matching DescentPath's HALO_CYAN so the tube halo stays bloom-bright while easing).
const PATH_HALO_CYAN = new THREE.Color('#00D3F2').multiplyScalar(1.8);
const PATH_HALO_FUCHSIA = new THREE.Color('#ED6AFF').multiplyScalar(1.8);

export interface HeroBeatProps {
  refs: HeroRefs;
  /** The ember ground ring mesh (positioned + animated by the beat). */
  emberRef: RefObject<THREE.Mesh | null>;
}

/** Build the per-run identity string from Channel A (pure; read inside the frame). */
function runIdentity(u: {
  functionId: string;
  optimizerId: string;
  learningRate: number;
  startPoint: readonly [number, number];
}): string {
  return `${u.functionId}|${u.optimizerId}|${u.learningRate}|${u.startPoint.join(',')}`;
}

/**
 * The hero arrival beat controller (spec §5.6). Renders nothing. One useFrame
 * reads simStore TRANSIENTLY, runs the arrival trigger + state machine, and
 * MUTATES the consumer refs — ball material, trail material, bloom, dof.bokehScale
 * (PostStack owns dof.target), vignette, ember ring. Two-channel rule: zero
 * setState (the phase lives in a useRef). Keeps frames flowing via invalidate()
 * for the beat's tail. Divergence is terminal: fuchsia halo + dimming core.
 */
export default function HeroBeat({ refs, emberRef }: HeroBeatProps) {
  const invalidate = useThree((s) => s.invalidate);

  const heroRef = useRef<HeroState>(initialHeroState(''));
  const prevCostRef = useRef<number>(NaN);
  const convergedRunRef = useRef<number>(0);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const emberTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const dtMs = delta * 1000;
    const { theta, cost, diverged } = simStore.getState();
    const u = useUIStore.getState();
    const fn = getFunction(u.functionId);
    const runId = runIdentity(u);

    // Run change resets the convergence trackers.
    if (runId !== heroRef.current.runId) {
      convergedRunRef.current = 0;
      prevCostRef.current = NaN;
    }

    // Trigger evaluation (skipped while diverged — the machine handles that).
    let arrived = false;
    if (!diverged) {
      const res = evaluateArrival({
        theta: theta as Vec2,
        cost,
        prevCost: prevCostRef.current,
        minima: fn.minima as readonly Vec2[],
        domain: fn.domain,
        convergedRun: convergedRunRef.current,
      });
      arrived = res.arrived;
      convergedRunRef.current = res.converging ? convergedRunRef.current + 1 : 0;
    }
    prevCostRef.current = cost;

    // Advance the machine.
    const next = advanceHero(heroRef.current, { arrived, diverged, runId }, dtMs);
    heroRef.current = next;

    // Drive the visuals by ref mutation (all null-guarded → tier-graceful).
    const ballMat = refs.ballMaterial.current;
    const trailMat = refs.trailMaterial.current;
    const pathHalo = refs.pathHalo.current; // persistent tube halo (survives Trail NO-GO)
    const bloom = refs.bloom.current;
    const dof = refs.dof.current;
    const vignette = refs.vignette.current;
    const ember = emberRef.current;

    switch (next.phase) {
      case 'idle':
        if (ballMat) {
          easing.damp(ballMat, 'emissiveIntensity', 3.0, 0.2, delta);
          easing.dampC(ballMat.emissive, CORE_CYAN, 0.2, delta);
        }
        if (bloom) easing.damp(bloom, 'intensity', 1.2, 0.3, delta);
        if (vignette) easing.damp(vignette, 'darkness', 0.55, 0.3, delta);
        if (dof) easing.damp(dof, 'bokehScale', 3.0, 0.3, delta);
        break;
      case 'approach':
        // Halo bleeds toward cyan on BOTH the live trail (if present) and the
        // persistent tube (always present) → the cue survives a Trail NO-GO.
        if (trailMat) easing.dampC(trailMat.color, HALO_CYAN, 0.25, delta);
        if (pathHalo) easing.dampC(pathHalo.uHaloColor.value, PATH_HALO_CYAN, 0.25, delta);
        break;
      case 'touchdown': {
        const t = next.t; // 0..1 over TOUCHDOWN_MS
        if (ballMat) {
          ballMat.emissiveIntensity = THREE.MathUtils.lerp(3.0, 5.0, t);
          tmpColor.copy(CORE_CYAN).lerp(WHITE_HOT, t);
          ballMat.emissive.copy(tmpColor);
        }
        if (trailMat) trailMat.color.copy(HALO_CYAN);
        if (pathHalo) pathHalo.uHaloColor.value.copy(PATH_HALO_CYAN);
        if (bloom) bloom.intensity = THREE.MathUtils.lerp(1.2, 2.6, t);
        if (vignette) vignette.darkness = THREE.MathUtils.lerp(0.55, 0.72, t);
        if (dof) dof.bokehScale = THREE.MathUtils.lerp(3.0, 1.6, t); // sharpen the rack
        break;
      }
      case 'settle':
        if (ballMat) {
          easing.damp(ballMat, 'emissiveIntensity', 2.2, 0.4, delta);
          easing.dampC(ballMat.emissive, CORE_CYAN, 0.4, delta);
        }
        if (bloom) easing.damp(bloom, 'intensity', 1.4, 0.5, delta);
        if (vignette) easing.damp(vignette, 'darkness', 0.55, 0.5, delta);
        if (dof) easing.damp(dof, 'bokehScale', 3.0, 0.5, delta);
        if (ember) {
          const [wx, wz] = paramToWorldXZ(theta[0], theta[1], fn.domain);
          const wy = costToWorldHeight(cost, u.functionId) + 0.002; // hair above surface
          emberTarget.set(wx, wy, wz);
          easing.damp3(ember.position, emberTarget, 0.3, delta);
          ember.visible = true;
          easing.damp3(ember.scale, 1, 0.4, delta);
          const mat = ember.material as THREE.MeshBasicMaterial;
          easing.damp(mat, 'opacity', 0.9, 0.45, delta);
        }
        break;
      case 'diverged':
        if (trailMat) easing.dampC(trailMat.color, FUCHSIA, 0.3, delta);
        if (pathHalo) easing.dampC(pathHalo.uHaloColor.value, PATH_HALO_FUCHSIA, 0.3, delta);
        if (ballMat) {
          easing.damp(ballMat, 'emissiveIntensity', 1.0, 0.4, delta); // dim, not white
          easing.dampC(ballMat.emissive, CORE_CYAN, 0.4, delta);
        }
        if (bloom) easing.damp(bloom, 'intensity', 0.8, 0.4, delta);
        if (ember) {
          const mat = ember.material as THREE.MeshBasicMaterial;
          easing.damp(mat, 'opacity', 0, 0.3, delta); // no ember on failure
        }
        break;
    }

    // Keep frames flowing for the beat's tail even if isPlaying flipped to demand.
    if (heroNeedsFrames(next)) invalidate();
  });

  return null;
}
