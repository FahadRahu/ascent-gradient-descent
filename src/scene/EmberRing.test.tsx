// @vitest-environment happy-dom
import { useRef } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import EmberRing from './EmberRing';

function Host() {
  const ref = useRef<THREE.Mesh>(null);
  return <EmberRing ref={ref} />;
}

describe('EmberRing (R3F structure smoke)', () => {
  it('mounts a flat, bloom-safe ring that starts hidden', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Host />);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(1);
    const mesh = meshes[0].instance as THREE.Mesh;
    expect(mesh.geometry.type).toBe('RingGeometry');
    expect(mesh.visible).toBe(false);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.toneMapped).toBe(false);
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    await renderer.unmount();
  });
});
