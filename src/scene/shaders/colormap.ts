/**
 * Magma colormap as a GLSL chunk (PRD §5.2). Implements `vec3 magma(float t)`
 * by piecewise-linear interpolation over the 9 locked stops. The incoming t
 * (a normalized cost in [0,1]) is first remapped into the visible band
 * [uColorLow, uColorHigh] — uColorLow defaults to 0.12 so the surface floor
 * starts in deep purple, never pure black (PRD §5.2 "sampled t∈[0.12,1]").
 *
 * ⚠️ The uniforms uColorLow / uColorHigh are declared by the fragment shader
 * (surfaceShaders.ts), NOT here — this chunk is concatenated into a program
 * that already declares them.
 *
 * GLSL can't run in Vitest; colormap.test.ts guards the stop literals + the
 * signature as a regression tripwire. Visual correctness is the Task-8 browser
 * smoke test.
 */

/** The 9 locked magma stops (PRD §5.2 hex → normalized float), in order. */
export const MAGMA_STOPS_GLSL: readonly string[] = [
  'vec3(0.082353, 0.054902, 0.215686)', // #150E37
  'vec3(0.231373, 0.058824, 0.439216)', // #3B0F70
  'vec3(0.392157, 0.101961, 0.501961)', // #641A80
  'vec3(0.549020, 0.160784, 0.505882)', // #8C2981
  'vec3(0.717647, 0.215686, 0.474510)', // #B73779
  'vec3(0.866667, 0.317647, 0.227451)', // #DD513A
  'vec3(0.972549, 0.462745, 0.360784)', // #F8765C
  'vec3(0.988235, 0.647059, 0.039216)', // #FCA50A
  'vec3(0.988235, 0.992157, 0.749020)', // #FCFDBF
];

export const magmaColormapGLSL = /* glsl */ `
// --- Magma colormap (9-stop piecewise-linear; PRD §5.2) -------------------
// 8 segments between 9 stops; segment i spans t in [i/8, (i+1)/8].
vec3 magma(float t) {
  // Remap the normalized cost into the visible band, then clamp.
  t = clamp((t - uColorLow) / max(uColorHigh - uColorLow, 1e-5), 0.0, 1.0);

  vec3 c0 = ${MAGMA_STOPS_GLSL[0]};
  vec3 c1 = ${MAGMA_STOPS_GLSL[1]};
  vec3 c2 = ${MAGMA_STOPS_GLSL[2]};
  vec3 c3 = ${MAGMA_STOPS_GLSL[3]};
  vec3 c4 = ${MAGMA_STOPS_GLSL[4]};
  vec3 c5 = ${MAGMA_STOPS_GLSL[5]};
  vec3 c6 = ${MAGMA_STOPS_GLSL[6]};
  vec3 c7 = ${MAGMA_STOPS_GLSL[7]};
  vec3 c8 = ${MAGMA_STOPS_GLSL[8]};

  // Chained mix over 8 segments: at parameter s∈[0,8], clamp(s-i,0,1) is the
  // local fraction within segment i, so each mix blends in the next stop exactly
  // over its [i, i+1] span. Branch-free piecewise-linear interpolation.
  float s = t * 8.0; // 0..8
  vec3 col = c0;
  col = mix(col, c1, clamp(s - 0.0, 0.0, 1.0));
  col = mix(col, c2, clamp(s - 1.0, 0.0, 1.0));
  col = mix(col, c3, clamp(s - 2.0, 0.0, 1.0));
  col = mix(col, c4, clamp(s - 3.0, 0.0, 1.0));
  col = mix(col, c5, clamp(s - 4.0, 0.0, 1.0));
  col = mix(col, c6, clamp(s - 5.0, 0.0, 1.0));
  col = mix(col, c7, clamp(s - 6.0, 0.0, 1.0));
  col = mix(col, c8, clamp(s - 7.0, 0.0, 1.0));
  return col;
}
`;
