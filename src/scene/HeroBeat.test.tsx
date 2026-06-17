// @vitest-environment happy-dom
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { createHeroRefs } from './heroRefs';
import HeroBeat from './HeroBeat';

function Host({ refs, emberRef }: { refs: ReturnType<typeof createHeroRefs>; emberRef: React.RefObject<THREE.Mesh | null> }) {
  return <HeroBeat refs={refs} emberRef={emberRef} />;
}

describe('HeroBeat (R3F structure smoke)', () => {
  it('renders nothing and mutates the ball material on arrival without throwing', async () => {
    // Seed an arrived state: sphere at the minimum.
    useUIStore.getState().setFunctionId('sphere');
    useUIStore.getState().setStartPoint([0.02, 0.02]);
    simStore.getState().setTheta([0.02, 0.02]);
    simStore.getState().setCost(0.0008);
    simStore.getState().setDiverged(false);

    const refs = createHeroRefs();
    const ballMat = new THREE.MeshPhysicalMaterial({ emissive: '#00D3F2', emissiveIntensity: 3 });
    refs.ballMaterial.current = ballMat;

    const emberRef = { current: new THREE.Mesh(new THREE.RingGeometry(0.14, 0.2, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })) };

    const renderer = await ReactThreeTestRenderer.create(<Host refs={refs} emberRef={emberRef} />);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0); // controller renders nothing
    // Run through idle→approach(~APPROACH_MS=800ms≈48 frames)→touchdown. 90 frames
    // (~1.5s at 1/60) clears the lead-in and enters the flash with margin.
    await renderer.advanceFrames(90, 1 / 60);
    expect(ballMat.emissiveIntensity).toBeGreaterThan(3); // the flash began
    await renderer.unmount();
  });

  it('dims the ball core on divergence (the visual opposite)', async () => {
    useUIStore.getState().setFunctionId('rosenbrock');
    simStore.getState().setTheta([-1.2, 1]);
    simStore.getState().setCost(1e9);
    simStore.getState().setDiverged(true);

    const refs = createHeroRefs();
    const ballMat = new THREE.MeshPhysicalMaterial({ emissive: '#00D3F2', emissiveIntensity: 3 });
    refs.ballMaterial.current = ballMat;
    const emberRef = { current: null as THREE.Mesh | null };

    const renderer = await ReactThreeTestRenderer.create(<Host refs={refs} emberRef={emberRef} />);
    await renderer.advanceFrames(60, 1 / 60);
    expect(ballMat.emissiveIntensity).toBeLessThan(3); // dimmed, not brightened
    await renderer.unmount();
    simStore.getState().setDiverged(false); // restore
  });
});
