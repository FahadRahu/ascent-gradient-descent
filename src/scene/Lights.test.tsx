// @vitest-environment happy-dom
import { vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useUIStore } from '../state/uiStore';

// ── Accommodation ─────────────────────────────────────────────────────────────
// Lights no longer mounts drei <SoftShadows> (removed at M1b — incompatible with
// three 0.184's sampler2DShadow shadow shader; see Lights.tsx). The remaining
// drei helper, <ContactShadows> (medium tier), builds a WebGLRenderTarget in a
// useMemo that misbehaves under test-renderer's MOCK GL, so we mock it to a no-op.
// Only ContactShadows is mocked — the light primitives stay real, so the asserted
// structure (DirectionalLight + AmbientLight) is genuine. The real visual shadow
// check is the live-browser checkpoint.
vi.mock('@react-three/drei', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/drei')>();
  return {
    ...actual,
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
