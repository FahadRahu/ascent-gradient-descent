// @vitest-environment happy-dom
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';

// ── Accommodation (established Tasks 9 & 10 pattern) ──────────────────────────
// SceneContents now renders the REAL composed scene, which pulls in three drei
// helpers that touch the WebGL context on mount and THROW under
// @react-three/test-renderer's MOCK GL (this is a limitation of the headless
// mock renderer, NOT of our components):
//
//   • <Environment frames={1}> (via <SceneEnvironment mode="procedural">) runs a
//     real CubeCamera.update() -> gl.setRenderTarget() -> drawBuffers() bake →
//     `TypeError: Invalid value used as weak map key` (Task 9 finding).
//   • <SoftShadows> (mounted by <Lights/> at the default 'high' tier) patches
//     THREE.ShaderChunk then calls gl.compile() / reads gl.info.programs, neither
//     of which exists on the mock GL (Task 10 finding). <ContactShadows> (medium
//     tier) builds a WebGLRenderTarget that can also misbehave under the mock.
//   • <OrbitControls> (mounted by <Scene>, not SceneContents — stubbed defensively
//     so the mock stays robust if the test ever mounts the full <Scene>).
//
// We spread the REAL drei module and override ONLY these GL-crashing helpers:
// Environment becomes a children passthrough so its real <Lightformer> rects
// still mount; the rest become no-ops. Crucially, Surface / Lights / DescentBall
// are NOT mocked, so the assertions below verify the GENUINE composition: the
// CSM Surface mesh + the lacquered DescentBall mesh (≥2 Mesh) and the real
// DirectionalLight from <Lights/>. The real GL render (env bake, shadows, shaders)
// is verified in the live browser at Task 15.
vi.mock('@react-three/drei', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/drei')>();
  return {
    ...actual,
    Environment: ({ children }: { children?: ReactNode }) => <>{children}</>,
    SoftShadows: () => null,
    ContactShadows: () => null,
    OrbitControls: () => null,
  };
});

// M1b: <PostStack> pulls in @react-three/postprocessing, whose <EffectComposer>
// touches real GL on mount (throws under the test-renderer mock GL, exactly like
// the drei helpers above). Neutralize it to a children passthrough + no-op effects
// so the composed-tree assertions still verify the genuine M1a content; the real
// post-stack is proven in the live browser (Task 4 / Task 19).
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children?: ReactNode }) => <>{children}</>,
  N8AO: () => null,
  Bloom: () => null,
  DepthOfField: () => null,
  SMAA: () => null,
  ChromaticAberration: () => null,
  Vignette: () => null,
  Noise: () => null,
  ToneMapping: () => null,
}));

// Imported AFTER vi.mock so SceneContents' subtree binds to the mocked drei helpers.
const { SceneContents } = await import('./Scene');

describe('Scene (R3F smoke test)', () => {
  it('mounts the composed scene: surface + ball meshes and a key light', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneContents />);

    // The placeholder cube is gone. The real scene has at least two meshes:
    // the CSM displaced Surface and the lacquered DescentBall.
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(2);

    // <Lights/> mounts a directional key light.
    const dirLights = renderer.scene.findAllByType('DirectionalLight');
    expect(dirLights.length).toBeGreaterThanOrEqual(1);

    await renderer.unmount();
  });
});
