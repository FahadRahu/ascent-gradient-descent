/**
 * The TubeGeometry reveal shader (PRD §5.3 / §6.5). The tube's built-in uv.x runs
 * 0 (start) -> 1 (end) along its length (arc-parameterized, closed=false). The
 * fragment reveals the ribbon UP TO uProgress: the whole trail BEHIND the front
 * (vUv.x < uProgress) is drawn, only what's AHEAD (vUv.x > uProgress) is discarded,
 * with a soft uEdge feather + a brighter traveling band right at the front (the
 * leading glow). White-hot HDR core (#FFF4E6, emissive >1) + a colored halo
 * (uHaloColor, default SGD cyan). The material sets toneMapped=false so the >1
 * values survive into the HalfFloat buffer for selective bloom.
 *
 * Reveal math: `reveal = 1 - smoothstep(uProgress, uProgress + uEdge, vPathUv.x)`
 * — i.e. 1 behind the front, feathering to 0 just past it. (An earlier form used
 * `smoothstep(uProgress - uEdge, uProgress, vPathUv.x)`, which inverted it and
 * showed ONLY a thin band at the tip while discarding the whole trail — caught at
 * the live ribbon checkpoint.)
 *
 * Uniform names (LOCKED): uProgress (float 0..1), uEdge (float reveal softness),
 * uHaloColor (vec3 — the halo hue the hero beat eases), uCoreColor (vec3 white-hot).
 */

const PATH_UNIFORMS = /* glsl */ `
uniform float uProgress;
uniform float uEdge;
uniform vec3  uHaloColor;
uniform vec3  uCoreColor;
`;

export const pathVertexShader = /* glsl */ `
${PATH_UNIFORMS}
varying vec2 vPathUv;
void main() {
  // CSM provides 'uv'; the tube's uv.x is the along-length reveal coordinate.
  vPathUv = uv;
}
`;

export const pathFragmentShader = /* glsl */ `
${PATH_UNIFORMS}
varying vec2 vPathUv;

void main() {
  // Reveal mask: 1 BEHIND the front (the drawn trail), feathering to 0 just past
  // it. discard only the not-yet-traveled tube AHEAD of uProgress.
  float reveal = 1.0 - smoothstep(uProgress, uProgress + uEdge, vPathUv.x);
  if (reveal <= 0.001) discard; // un-traveled tube ahead of the front is invisible

  // uv.y wraps the tube circumference (0..1); bias brightest at the spine so it
  // reads as a white-hot filament inside a colored halo.
  float rim = abs(vPathUv.y - 0.5) * 2.0;        // 0 centre -> 1 edges
  float core = 1.0 - smoothstep(0.0, 0.6, rim);   // white-hot down the spine

  // A traveling bright band right at the revealed front (the leading glow): peaks
  // at vUv.x ≈ uProgress and falls off back along the trail.
  float band = smoothstep(uProgress - uEdge * 2.0, uProgress, vPathUv.x) * reveal;

  vec3 col = mix(uHaloColor, uCoreColor, core);
  col += uCoreColor * band * 0.8;                 // brighten the front

  // HDR emissive via the CSM MeshBasicMaterial base: write color directly. Values
  // >1 (uCoreColor is authored HDR) survive into the HalfFloat buffer for bloom.
  csm_DiffuseColor = vec4(col, reveal);
}
`;
