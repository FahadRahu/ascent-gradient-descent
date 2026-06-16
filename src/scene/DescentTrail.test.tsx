// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { simStore } from '../state/simStore';

// drei <Trail> portals a mesh into the scene root and resolves its anchor in a
// useEffect (real GL paths the mock lacks). Mock it to a children passthrough so
// the anchor mesh still mounts and the component's own useFrame is exercised.
vi.mock('@react-three/drei', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/drei')>();
  return { ...actual, Trail: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

const { default: DescentTrail } = await import('./DescentTrail');

describe('DescentTrail (R3F structure smoke)', () => {
  it('mounts the invisible anchor mesh and advances without throwing', async () => {
    simStore.getState().setTheta([-1.2, 1]);
    simStore.getState().setCost(24.2);
    const renderer = await ReactThreeTestRenderer.create(<DescentTrail />);
    await renderer.advanceFrames(10, 1 / 60);
    // The anchor mesh exists (Trail mocked to passthrough → its child renders).
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThanOrEqual(1);
    await renderer.unmount();
  });
});
