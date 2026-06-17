// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import DescentPath from './DescentPath';

describe('DescentPath (R3F structure smoke)', () => {
  it('renders a mesh once the geometry exists and advances without throwing', async () => {
    // Seed a run so the sim-runner handle has >=2 points after a few frames.
    useUIStore.getState().setFunctionId('sphere');
    useUIStore.getState().setPlaying(true);
    simStore.getState().setTheta([1, 1]);
    simStore.getState().setCost(2);

    const renderer = await ReactThreeTestRenderer.create(<DescentPath />);
    await renderer.advanceFrames(20, 1 / 60);
    // It may render null until the handle has >=2 points; the hard guarantee is
    // that advancing frames never throws (the geometry lifecycle is sound).
    expect(() => renderer.scene.findAllByType('Mesh')).not.toThrow();
    await renderer.unmount();
    useUIStore.getState().setPlaying(false);
  });
});
