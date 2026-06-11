/**
 * DynamicCostGrid Component
 *
 * A vertical grid that sits along one edge of the floor grid (like an "L" shape).
 * The grid moves to different edges based on camera position for visibility.
 *
 * Imagine looking at a 3D graph - floor grid is the XZ plane,
 * this height grid is like a wall on one side.
 *
 * Features:
 * - 22 units wide × height tall (matches floor grid)
 * - Moves to one of 4 edges of floor grid based on camera
 * - Simple cost labels (0, 10, 20, 30)
 * - Tracking line for current ball cost
 */

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard, Line } from '@react-three/drei';
import * as THREE from 'three';
import { HEIGHT_SCALE } from './utils/costFunction';

interface DynamicCostGridProps {
  isDark: boolean;
  show?: boolean;
  currentCost?: number | null;
  maxCostInPath?: number | null; // Highest cost in the gradient path
}

// Grid configuration - matches floor grid
const GRID_SIZE = 22;
const GRID_DIVISIONS = 22;
const DEFAULT_MAX_COST = 30;

// Four possible edges of the floor grid
// Each edge has a position, rotation, and direction for labels
interface GridEdge {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  labelOffset: [number, number, number]; // Where to put labels relative to grid
}

const GRID_EDGES: GridEdge[] = [
  // Back edge (negative Z) - grid faces +Z
  {
    name: 'back',
    position: [0, 0, -GRID_SIZE / 2],
    rotation: [0, 0, 0],
    labelOffset: [-GRID_SIZE / 2 - 1, 0, 0],
  },
  // Front edge (positive Z) - grid faces -Z
  {
    name: 'front',
    position: [0, 0, GRID_SIZE / 2],
    rotation: [0, Math.PI, 0],
    labelOffset: [GRID_SIZE / 2 + 1, 0, 0],
  },
  // Left edge (negative X) - grid faces +X
  {
    name: 'left',
    position: [-GRID_SIZE / 2, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    labelOffset: [0, 0, -GRID_SIZE / 2 - 1],
  },
  // Right edge (positive X) - grid faces -X
  {
    name: 'right',
    position: [GRID_SIZE / 2, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    labelOffset: [0, 0, GRID_SIZE / 2 + 1],
  },
];

export function DynamicCostGrid({
  isDark,
  show = true,
  currentCost = null,
  maxCostInPath = null,
}: DynamicCostGridProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Calculate max cost (round up to nearest 10)
  const maxCost = useMemo(() => {
    if (maxCostInPath && maxCostInPath > DEFAULT_MAX_COST) {
      // Round up to nearest 10
      return Math.ceil(maxCostInPath / 10) * 10;
    }
    return DEFAULT_MAX_COST;
  }, [maxCostInPath]);

  const maxHeight = maxCost * HEIGHT_SCALE;

  // Generate cost labels dynamically (every 10)
  const costLabels = useMemo(() => {
    const labels: number[] = [];
    for (let i = 0; i <= maxCost; i += 10) {
      labels.push(i);
    }
    return labels;
  }, [maxCost]);

  // Current and target edge indices
  const currentEdgeIndex = useRef(0);
  const targetEdgeIndex = useRef(0);
  const transitionProgress = useRef(1);

  // Colors
  const gridColor1 = isDark ? '#475569' : '#94a3b8';
  const gridColor2 = isDark ? '#334155' : '#cbd5e1';
  const textColor = isDark ? '#e9d5ff' : '#7c3aed';
  const outlineColor = isDark ? '#2e1065' : '#faf5ff';
  const trackingColor = isDark ? '#fbbf24' : '#f59e0b';

  // Tracking Y position
  const trackingY = useMemo(() => {
    if (currentCost === null || currentCost === undefined) return null;
    return Math.min(currentCost * HEIGHT_SCALE, maxHeight);
  }, [currentCost, maxHeight]);

  // Generate grid lines (in local space, grid is flat on XY plane)
  // Moved BEFORE the early return to comply with Rules of Hooks
  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    const halfSize = GRID_SIZE / 2;

    // Horizontal lines (cost levels)
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const y = (i / GRID_DIVISIONS) * maxHeight;
      const isMajor = i % 5 === 0;
      lines.push(
        <Line
          key={`h-${i}`}
          points={[
            [-halfSize, y, 0],
            [halfSize, y, 0],
          ]}
          color={isMajor ? gridColor1 : gridColor2}
          lineWidth={isMajor ? 1.5 : 0.5}
          transparent
          opacity={isMajor ? 0.6 : 0.3}
        />
      );
    }

    // Vertical lines
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const x = (i / GRID_DIVISIONS - 0.5) * GRID_SIZE;
      const isMajor = i % 5 === 0;
      lines.push(
        <Line
          key={`v-${i}`}
          points={[
            [x, 0, 0],
            [x, maxHeight, 0],
          ]}
          color={isMajor ? gridColor1 : gridColor2}
          lineWidth={isMajor ? 1.5 : 0.5}
          transparent
          opacity={isMajor ? 0.6 : 0.3}
        />
      );
    }

    return lines;
  }, [gridColor1, gridColor2, maxHeight]);

  // Determine which edge to use based on camera position
  useFrame(() => {
    if (!groupRef.current) return;

    const camX = camera.position.x;
    const camZ = camera.position.z;

    // Choose the edge that is furthest from camera (so it's visible behind the surface)
    // Camera at (+X, +Z) → show grid at back-left corner → use 'back' or 'left'
    // We want the edge that faces the camera
    let bestEdgeIndex = 0;

    if (Math.abs(camZ) >= Math.abs(camX)) {
      // Camera is more in front/back
      bestEdgeIndex = camZ > 0 ? 0 : 1; // back if cam is in front, front if cam is in back
    } else {
      // Camera is more left/right
      bestEdgeIndex = camX > 0 ? 2 : 3; // left if cam is on right, right if cam is on left
    }

    // Check if we need to transition
    if (targetEdgeIndex.current !== bestEdgeIndex) {
      currentEdgeIndex.current = targetEdgeIndex.current;
      targetEdgeIndex.current = bestEdgeIndex;
      transitionProgress.current = 0;
    }

    // Smooth transition
    if (transitionProgress.current < 1) {
      transitionProgress.current = Math.min(1, transitionProgress.current + 0.06);
      const t = 1 - Math.pow(1 - transitionProgress.current, 3); // Ease out

      const fromEdge = GRID_EDGES[currentEdgeIndex.current];
      const toEdge = GRID_EDGES[targetEdgeIndex.current];

      // Lerp position
      const x = THREE.MathUtils.lerp(fromEdge.position[0], toEdge.position[0], t);
      const z = THREE.MathUtils.lerp(fromEdge.position[2], toEdge.position[2], t);
      groupRef.current.position.set(x, 0, z);

      // Lerp rotation (use quaternion for smooth rotation)
      const fromQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...fromEdge.rotation));
      const toQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...toEdge.rotation));
      const currentQuat = new THREE.Quaternion().slerpQuaternions(fromQuat, toQuat, t);
      groupRef.current.quaternion.copy(currentQuat);
    }
  });

  // Early return AFTER all hooks (Rules of Hooks compliance)
  if (!show) return null;

  // Initial edge
  const initialEdge = GRID_EDGES[0];

  return (
    <group ref={groupRef} position={initialEdge.position} rotation={initialEdge.rotation}>
      {/* Grid lines */}
      {gridLines}

      {/* Cost labels along left edge */}
      {costLabels.map((cost) => {
        const y = cost * HEIGHT_SCALE;
        return (
          <Billboard
            key={`label-${cost}`}
            position={[-GRID_SIZE / 2 - 1, y, 0]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <Text
              fontSize={0.8}
              color={textColor}
              outlineWidth={0.1}
              outlineColor={outlineColor}
              anchorX="right"
              anchorY="middle"
              fontWeight="bold"
            >
              {cost}
            </Text>
          </Billboard>
        );
      })}

      {/* "Cost" label at top */}
      <Billboard
        position={[-GRID_SIZE / 2 - 1, maxHeight + 0.8, 0]}
        follow
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Text
          fontSize={0.6}
          color={textColor}
          outlineWidth={0.08}
          outlineColor={outlineColor}
          anchorX="right"
          anchorY="middle"
          fontWeight="bold"
        >
          Cost
        </Text>
      </Billboard>

      {/* Tracking line for current cost */}
      {trackingY !== null && trackingY > 0 && (
        <>
          <Line
            points={[
              [-GRID_SIZE / 2, trackingY, 0],
              [GRID_SIZE / 2, trackingY, 0],
            ]}
            color={trackingColor}
            lineWidth={3}
            dashed
            dashSize={0.4}
            gapSize={0.2}
          />
          {/* Tracking label */}
          <Billboard
            position={[GRID_SIZE / 2 + 1, trackingY, 0]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <Text
              fontSize={0.5}
              color={trackingColor}
              outlineWidth={0.06}
              outlineColor={isDark ? '#451a03' : '#fffbeb'}
              anchorX="left"
              anchorY="middle"
              fontWeight="bold"
            >
              {currentCost?.toFixed(1)}
            </Text>
          </Billboard>
        </>
      )}
    </group>
  );
}

export default DynamicCostGrid;
