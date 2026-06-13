// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Surface } from './Surface';
import { useUIStore } from '../state/uiStore';

describe('Surface (R3F structure smoke — proxy for CSM compiling)', () => {
  beforeEach(() => {
    useUIStore.getState().reset(); // functionId='rosenbrock', tier='high'
  });

  it('mounts and produces a Mesh with a material and a customDepthMaterial', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Surface />);

    // Find the surface mesh in the tree (there is exactly one).
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);

    // The underlying three.Mesh must have BOTH a material and a customDepthMaterial.
    const mesh = meshes[0].instance as {
      material?: unknown;
      customDepthMaterial?: unknown;
      geometry?: { type?: string };
    };
    expect(mesh.material).toBeTruthy();
    expect(mesh.customDepthMaterial).toBeTruthy();
    expect(mesh.geometry?.type).toBe('PlaneGeometry');

    await renderer.unmount();
  });

  it('mounts and unmounts without throwing', async () => {
    // Structural lifecycle check only: a clean mount (with a Mesh) followed by a
    // clean unmount. The real two-channel / 60fps "no re-render storm" guarantee
    // is verified by the M1c live-browser Playwright smoke, not here —
    // test-renderer uses a mock GL and does not auto-advance frames.
    const renderer = await ReactThreeTestRenderer.create(<Surface />);
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThanOrEqual(1);
    await renderer.unmount();
  });
});
