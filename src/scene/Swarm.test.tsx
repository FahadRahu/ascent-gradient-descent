// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import Swarm from './Swarm';

describe('Swarm (R3F structure smoke)', () => {
  afterEach(() => useUIStore.getState().setTier('high'));

  it('mounts one Points with three buffer attributes at the tier count', async () => {
    useUIStore.getState().setTier('high'); // 30000 ambient particles
    const renderer = await ReactThreeTestRenderer.create(<Swarm />);
    const points = renderer.scene.findAllByType('Points');
    expect(points.length).toBe(1);
    const geom = (points[0].instance as THREE.Points).geometry;
    expect(geom.getAttribute('position').count).toBe(30000);
    expect(geom.getAttribute('aSeed').count).toBe(30000);
    expect(geom.getAttribute('aSpeed').count).toBe(30000);
    const mat = (points[0].instance as THREE.Points).material as THREE.Material;
    expect((mat as THREE.Material & { transparent: boolean }).transparent).toBe(true);
    expect((mat as THREE.Material & { blending: number }).blending).toBe(THREE.AdditiveBlending);
    await renderer.unmount();
  });

  it('renders no points at the fallback tier (count 0)', async () => {
    useUIStore.getState().setTier('fallback');
    const renderer = await ReactThreeTestRenderer.create(<Swarm />);
    expect(renderer.scene.findAllByType('Points').length).toBe(0);
    await renderer.unmount();
  });
});
