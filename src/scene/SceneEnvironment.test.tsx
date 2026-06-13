// @vitest-environment happy-dom
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';

// ── Accommodation (see Task 9 brief) ──────────────────────────────────────────
// The plan's test comment assumed drei's procedural <Environment frames={1}> bake
// is "a no-op under test-renderer". In this stack (drei 10.7 / three 0.184 /
// @react-three/test-renderer 9.1) it is NOT a no-op: on mount drei runs a real
// CubeCamera.update() -> WebGLRenderer.setRenderTarget() -> drawBuffers(), which
// throws `TypeError: Invalid value used as weak map key` against test-renderer's
// MOCK WebGL context (the mock GL returns a value that cannot be a WeakMap key).
// That is a limitation of the headless mock renderer, NOT of SceneEnvironment.
//
// Per the brief's guidance ("...it may assert a lighter structural fact, or
// wrap/mock"), we mock drei's <Environment> to render its children — bypassing
// only the GL bake — so the procedural subtree (the three palette-tinted
// <Lightformer> rects) still mounts and is asserted. <Lightformer> stays REAL
// (each renders a three.Mesh), so the structural fact we check is genuine. The
// real reflection/bake check is the live-browser A/B in Task 12.
vi.mock('@react-three/drei', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/drei')>();
  return {
    ...actual,
    Environment: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

// Imported AFTER vi.mock so SceneEnvironment binds to the mocked <Environment>.
const { default: SceneEnvironment } = await import('./SceneEnvironment');

describe('SceneEnvironment (R3F smoke test)', () => {
  it('mounts the procedural rig without throwing', async () => {
    // The procedural <Environment frames={1}> bakes a cube camera; under
    // test-renderer that bake cannot run (mock GL), so it is mocked away above
    // and we assert the subtree — the three Lightformer rects — mounts cleanly
    // (the real reflection check is the live-browser A/B in Task 12).
    const renderer = await ReactThreeTestRenderer.create(<SceneEnvironment mode="procedural" />);
    expect(renderer.scene).toBeTruthy();
    // The rig is a dim white key + cyan rim + ember rim → three Lightformer meshes.
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3);
    await renderer.unmount();
  });

  it('mounts the hdr branch (wrapped in Suspense) without throwing', async () => {
    // No real .hdr fetch happens under test-renderer (Suspense fallback={null});
    // we only assert the component tree is constructable with mode="hdr".
    const renderer = await ReactThreeTestRenderer.create(
      <SceneEnvironment mode="hdr" hdr="/hdri/satara_night_no_lamps_1k.hdr" />,
    );
    expect(renderer.scene).toBeTruthy();
    await renderer.unmount();
  });
});
