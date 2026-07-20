import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getFunction } from '../engine/functions';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { costToWorldHeight, paramToWorldXZ } from './surfaceMapping';

const AXIS_X = -2.24;
const AXIS_Z = -2.24;
const TICK_COUNT = 5;

export interface WorldHeightRange {
  min: number;
  max: number;
}

/** Sample the rendered landscape so the ruler spans its visible height range. */
export function sampleWorldHeightRange(
  functionId: string,
  samples = 32,
): WorldHeightRange {
  const fn = getFunction(functionId);
  const [xMin, xMax, yMin, yMax] = fn.domain;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let row = 0; row <= samples; row += 1) {
    const y = yMin + (row / samples) * (yMax - yMin);
    for (let column = 0; column <= samples; column += 1) {
      const x = xMin + (column / samples) * (xMax - xMin);
      const height = costToWorldHeight(fn.cost([x, y]), functionId);
      if (!Number.isFinite(height)) continue;
      min = Math.min(min, height);
      max = Math.max(max, height);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (max - min < 0.2) return { min: min - 0.1, max: max + 0.1 };
  return { min, max };
}

function buildAxisGeometry(range: WorldHeightRange): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const low = new THREE.Color('#55e3f1');
  const high = new THREE.Color('#ffb957');
  const muted = new THREE.Color('#748197');

  const addSegment = (
    start: readonly [number, number, number],
    end: readonly [number, number, number],
    startColor: THREE.Color,
    endColor: THREE.Color,
  ) => {
    positions.push(...start, ...end);
    colors.push(
      startColor.r,
      startColor.g,
      startColor.b,
      endColor.r,
      endColor.g,
      endColor.b,
    );
  };

  addSegment([0, range.min, 0], [0, range.max, 0], low, high);

  for (let tick = 0; tick < TICK_COUNT; tick += 1) {
    const progress = tick / (TICK_COUNT - 1);
    const y = THREE.MathUtils.lerp(range.min, range.max, progress);
    const tickColor = muted.clone().lerp(high, progress * 0.35);
    addSegment([-0.075, y, 0], [0.075, y, 0], tickColor, tickColor);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

export default function CostAxis() {
  const functionId = useUIStore((state) => state.functionId);
  const markerRef = useRef<THREE.Group>(null);
  const range = useMemo(() => sampleWorldHeightRange(functionId), [functionId]);
  const axisGeometry = useMemo(() => buildAxisGeometry(range), [range]);
  const levelGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(6), 3),
    );
    return geometry;
  }, []);
  const levelLine = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: '#55e3f1',
      transparent: true,
      opacity: 0.24,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const line = new THREE.Line(levelGeometry, material);
    line.frustumCulled = false;
    line.renderOrder = 4;
    return line;
  }, [levelGeometry]);

  useEffect(() => () => axisGeometry.dispose(), [axisGeometry]);
  useEffect(
    () => () => {
      levelGeometry.dispose();
      (levelLine.material as THREE.Material).dispose();
    },
    [levelGeometry, levelLine],
  );

  useFrame(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const state = simStore.getState();
    const fn = getFunction(functionId);
    const height = THREE.MathUtils.clamp(
      costToWorldHeight(state.cost, functionId),
      range.min,
      range.max,
    );
    const [pointX, pointZ] = paramToWorldXZ(
      state.theta[0],
      state.theta[1],
      fn.domain,
    );

    marker.position.y = height;
    const positions = levelLine.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, AXIS_X, height, AXIS_Z);
    positions.setXYZ(1, pointX, height, pointZ);
    positions.needsUpdate = true;
  });

  return (
    <>
      <group position={[AXIS_X, 0, AXIS_Z]} renderOrder={5}>
        <lineSegments geometry={axisGeometry} frustumCulled={false}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.9}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </lineSegments>
        <mesh position={[0, range.max + 0.075, 0]} renderOrder={5}>
          <coneGeometry args={[0.055, 0.13, 16]} />
          <meshBasicMaterial
            color="#ffb957"
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <group ref={markerRef} renderOrder={7}>
          <mesh>
            <boxGeometry args={[0.19, 0.025, 0.025]} />
            <meshBasicMaterial
              color="#55e3f1"
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation-z={Math.PI / 4}>
            <boxGeometry args={[0.06, 0.06, 0.03]} />
            <meshBasicMaterial
              color="#f4f7fb"
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      <primitive object={levelLine} />
    </>
  );
}
