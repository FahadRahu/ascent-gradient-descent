import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Vec2 } from '../engine/types';
import { getFunction } from '../engine/functions';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getSimRunnerHandle } from './useSimRunner';
import {
  SURFACE_SIZE,
  costToWorldHeight,
  paramToWorldXZ,
  vScaleFor,
} from './surfaceMapping';

const CUE_LIFT = 0.11;
const ARROW_LENGTH = 0.58;
const MAX_STEP_MARKERS = 96;

export interface DescentArrowPose {
  origin: readonly [number, number, number];
  direction: readonly [number, number, number];
  length: number;
}

/** Map the negative gradient onto the surface's world-space tangent. */
export function computeDescentArrowPose(
  functionId: string,
  theta: Vec2,
): DescentArrowPose | null {
  const fn = getFunction(functionId);
  const gradient = fn.grad(theta);
  if (!gradient.every(Number.isFinite)) return null;

  const [xMin, xMax, yMin, yMax] = fn.domain;
  const xRange = xMax - xMin;
  const yRange = yMax - yMin;
  const worldDx = (-gradient[0] * SURFACE_SIZE) / xRange;
  const worldDz = (-gradient[1] * SURFACE_SIZE) / yRange;
  const horizontalLength = Math.hypot(worldDx, worldDz);
  if (horizontalLength < 1e-8) return null;

  const horizontalX = worldDx / horizontalLength;
  const horizontalZ = worldDz / horizontalLength;
  const parameterDx = (horizontalX * xRange) / SURFACE_SIZE;
  const parameterDy = (horizontalZ * yRange) / SURFACE_SIZE;
  const costSlope = gradient[0] * parameterDx + gradient[1] * parameterDy;
  const direction = new THREE.Vector3(
    horizontalX,
    vScaleFor(functionId) * costSlope,
    horizontalZ,
  ).normalize();
  const [worldX, worldZ] = paramToWorldXZ(theta[0], theta[1], fn.domain);
  const cost = fn.cost(theta);
  if (!Number.isFinite(cost)) return null;

  return {
    origin: [worldX, costToWorldHeight(cost, functionId) + CUE_LIFT, worldZ],
    direction: [direction.x, direction.y, direction.z],
    length: ARROW_LENGTH,
  };
}

function worldPoint(functionId: string, theta: Vec2, lift: number): [number, number, number] {
  const fn = getFunction(functionId);
  const [x, z] = paramToWorldXZ(theta[0], theta[1], fn.domain);
  return [x, costToWorldHeight(fn.cost(theta), functionId) + lift, z];
}

function StartMarker({ position }: { position: readonly [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={7}>
        <ringGeometry args={[0.105, 0.132, 48]} />
        <meshBasicMaterial color="#f4f7fb" transparent opacity={0.82} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position-y={0.038} rotation-y={Math.PI / 4} renderOrder={7}>
        <octahedronGeometry args={[0.037, 0]} />
        <meshBasicMaterial color="#f4f7fb" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function TargetMarker({
  position,
  label,
}: {
  position: readonly [number, number, number];
  label: string;
}) {
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={7}>
        <ringGeometry args={[0.12, 0.15, 64]} />
        <meshBasicMaterial color="#ffb957" transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} renderOrder={7}>
        <ringGeometry args={[0.205, 0.214, 64]} />
        <meshBasicMaterial color="#ffb957" transparent opacity={0.48} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position-y={0.055} renderOrder={7}>
        <cylinderGeometry args={[0.012, 0.012, 0.11, 12]} />
        <meshBasicMaterial color="#ffb957" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <Html
        center
        position={[0, 0.22, 0]}
        distanceFactor={6}
        zIndexRange={[3, 1]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="scene-label scene-label-goal" aria-hidden="true">
          {label}
        </span>
      </Html>
    </group>
  );
}

function DescentDirection() {
  const functionId = useUIStore((state) => state.functionId);
  const arrow = useMemo(
    () => new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      ARROW_LENGTH,
      '#ffb957',
      0.15,
      0.085,
    ),
    [],
  );
  const direction = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const lineMaterial = arrow.line.material as THREE.LineBasicMaterial;
    const coneMaterial = arrow.cone.material as THREE.MeshBasicMaterial;
    for (const material of [lineMaterial, coneMaterial]) {
      material.depthTest = false;
      material.depthWrite = false;
      material.transparent = true;
      material.toneMapped = false;
    }
    lineMaterial.opacity = 0.95;
    arrow.line.renderOrder = 8;
    arrow.cone.renderOrder = 8;
    return () => {
      arrow.line.geometry.dispose();
      arrow.cone.geometry.dispose();
      lineMaterial.dispose();
      coneMaterial.dispose();
    };
  }, [arrow]);

  useFrame(() => {
    const state = simStore.getState();
    const pose = state.diverged ? null : computeDescentArrowPose(functionId, state.theta);
    arrow.visible = pose !== null;
    if (!pose) return;
    arrow.position.set(...pose.origin);
    direction.set(...pose.direction);
    arrow.setDirection(direction);
    arrow.setLength(pose.length, 0.15, 0.085);
  });

  return <primitive object={arrow} />;
}

function StepMarkers() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastRunId = useRef(-1);
  const lastHistoryLength = useRef(-1);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    invalidate();
  }, [invalidate]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const handle = getSimRunnerHandle();
    if (
      handle.runId === lastRunId.current &&
      handle.history.length === lastHistoryLength.current
    ) return;

    lastRunId.current = handle.runId;
    lastHistoryLength.current = handle.history.length;
    const { functionId } = useUIStore.getState();
    const fn = getFunction(functionId);
    const stride = Math.max(1, Math.ceil(handle.history.length / MAX_STEP_MARKERS));
    const sampled = handle.history.filter(
      (_, index) => index % stride === 0 || index === handle.history.length - 1,
    );
    const visible = Math.min(sampled.length, MAX_STEP_MARKERS);

    for (let index = 0; index < visible; index += 1) {
      const entry = sampled[index];
      const [x, z] = paramToWorldXZ(entry.theta[0], entry.theta[1], fn.domain);
      const y = costToWorldHeight(entry.cost, functionId) + 0.065;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(index === visible - 1 ? 1.2 : 0.82);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_STEP_MARKERS]} frustumCulled={false} renderOrder={6}>
      <sphereGeometry args={[0.024, 12, 12]} />
      <meshBasicMaterial color="#f4f7fb" transparent opacity={0.76} depthTest={false} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

export default function OptimizationCues() {
  const functionId = useUIStore((state) => state.functionId);
  const startPoint = useUIStore((state) => state.startPoint);
  const target = getFunction(functionId).minima[0];

  return (
    <>
      <StartMarker position={worldPoint(functionId, startPoint, 0.055)} />
      <TargetMarker
        position={worldPoint(functionId, target, 0.045)}
        label={functionId === 'saddle' ? 'Saddle point' : 'Goal: lowest cost'}
      />
      <DescentDirection />
      <StepMarkers />
    </>
  );
}
