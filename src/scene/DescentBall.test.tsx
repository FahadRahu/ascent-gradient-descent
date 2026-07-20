// @vitest-environment happy-dom
import { createRef } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { simStore } from '../state/simStore';
import DescentBall, { shouldShowCurrentLabel } from './DescentBall';

describe('current-point label priority', () => {
  const domain = [-5, 5, -5, 5] as const;

  it('shows the label during descent and suppresses it near the goal', () => {
    expect(shouldShowCurrentLabel([3, 3], [0, 0], domain)).toBe(true);
    expect(shouldShowCurrentLabel([0.2, 0.2], [0, 0], domain)).toBe(false);
  });
});

describe('DescentBall (R3F smoke test)', () => {
  it('renders a mesh carrying a physical material', async () => {
    const renderer = await ReactThreeTestRenderer.create(<DescentBall />);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(1);
    // The orb is a MeshPhysicalMaterial (clearcoat lacquer).
    const inst = meshes[0].instance as unknown as { material: { type: string; clearcoat: number } };
    const mat = inst.material;
    expect(mat.type).toBe('MeshPhysicalMaterial');
    expect(mat.clearcoat).toBe(1);
    await renderer.unmount();
  });

  it('advances frames without throwing when the sim store has a point', async () => {
    // Put a real param-space point into the sim store, then pump frames; the
    // useFrame reads it transiently and damps position. We only assert no throw
    // (real motion is a live-browser check — Task 19 (M1b live smoke)).
    simStore.getState().setTheta([-1.2, 1]);
    simStore.getState().setCost(24.2);
    const renderer = await ReactThreeTestRenderer.create(<DescentBall />);
    await renderer.advanceFrames(10, 1 / 60);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1);
    await renderer.unmount();
  });

  it('populates an external materialRef when provided', async () => {
    const matRef = createRef<THREE.MeshPhysicalMaterial>();
    const renderer = await ReactThreeTestRenderer.create(<DescentBall materialRef={matRef} />);
    expect(matRef.current).not.toBeNull();
    expect(matRef.current?.type).toBe('MeshPhysicalMaterial');
    await renderer.unmount();
  });
});
