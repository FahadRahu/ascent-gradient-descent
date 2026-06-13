// @vitest-environment happy-dom
import { vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useUIStore } from '../state/uiStore';

// ── Accommodation ─────────────────────────────────────────────────────────────
// SoftShadows patches THREE.ShaderChunk then calls gl.compile(scene, camera)
// and gl.info.programs.length = 0 on mount. Under test-renderer's mock GL,
// gl.compile is not a real function and gl.info.programs is undefined, so these
// calls throw. This is a limitation of the headless mock renderer, NOT of the
// Lights component. We mock SoftShadows to a no-op (returns null) — the
// structural fact asserted (DirectionalLight + AmbientLight exist) is genuine
// because only SoftShadows is mocked; the light primitives stay real.
//
// ContactShadows uses useFrame for its render pass (no mount-time GL calls),
// but its useMemo creates WebGLRenderTarget which can also misbehave under the
// mock. We mock it to an inert group as well, same rationale.
//
// The real visual check of SoftShadows/ContactShadows is the live-browser A/B
// in Task 12.
vi.mock('@react-three/drei', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/drei')>();
  return {
    ...actual,
    SoftShadows: () => null,
    ContactShadows: () => null,
  };
});

// Imported AFTER vi.mock so Lights binds to the mocked drei helpers.
const { default: Lights } = await import('./Lights');

describe('Lights (R3F smoke test)', () => {
  afterEach(() => {
    useUIStore.getState().reset(); // restore tier='high' between cases
  });

  it('renders a DirectionalLight at the default (high) tier', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Lights />);
    const dir = renderer.scene.findAllByType('DirectionalLight');
    expect(dir.length).toBe(1);
    await renderer.unmount();
  });

  it('renders an AmbientLight (the low fill)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Lights />);
    expect(renderer.scene.findAllByType('AmbientLight').length).toBe(1);
    await renderer.unmount();
  });

  it('still renders the DirectionalLight at the low tier (shadowMapSize 0 → no castShadow, light remains)', async () => {
    useUIStore.getState().setTier('low');
    const renderer = await ReactThreeTestRenderer.create(<Lights />);
    expect(renderer.scene.findAllByType('DirectionalLight').length).toBe(1);
    await renderer.unmount();
  });
});
