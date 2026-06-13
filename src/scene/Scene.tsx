import { Canvas } from '@react-three/fiber';

/** In-canvas content (no <Canvas> wrapper) — unit-testable with
 *  @react-three/test-renderer. M0 placeholder: one reference cube + a light, on
 *  the PRD §5.1 void background. The real surface/ball/post-stack arrive in M1. */
export function SceneContents() {
  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#00D3F2" />
      </mesh>
    </>
  );
}

/** App-facing scene: the real Canvas wrapper. */
export function Scene() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }} dpr={[1, 2]}>
      <SceneContents />
    </Canvas>
  );
}
