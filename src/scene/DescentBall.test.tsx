// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { simStore } from '../state/simStore';
import DescentBall from './DescentBall';

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
    // (real motion is a live-browser check — Task 12).
    simStore.getState().setTheta([-1.2, 1]);
    simStore.getState().setCost(24.2);
    const renderer = await ReactThreeTestRenderer.create(<DescentBall />);
    await renderer.advanceFrames(10, 1 / 60);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1);
    await renderer.unmount();
  });
});
