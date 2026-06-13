// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneContents } from './Scene';

describe('Scene (R3F smoke test)', () => {
  it('mounts the empty scene and renders a mesh without errors', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneContents />);
    // The placeholder scene has one mesh (a reference cube) and a light.
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);
    await renderer.unmount();
  });
});
