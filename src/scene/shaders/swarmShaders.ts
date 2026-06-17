import { functionFieldGLSL } from './functionField';

/**
 * The stateless ambient-swarm shaders (spec §5.5, PRD §7). Each particle's world
 * position is a PURE function of (aSeed, aSpeed, uTime) — no simulation textures.
 *
 * Reuses `functionFieldGLSL` so the swarm rides the SAME displaced terrain as the
 * surface (surfaceHeight), and maps world↔param identically to surfaceShaders.ts
 * (p = uParamMin + uv·uParamRange ; world XZ = uv·SURFACE_SIZE − SURFACE_SIZE/2).
 * Flow direction / speed / curl come from the baked half-float uFlow texture
 * (RG=dir, B=speed, A=curl), sampled in the VERTEX shader with the GLSL1 texture2D
 * form (drei shaderMaterial is GLSL1; NearestFilter → exact texels).
 */

const SWARM_CONSTS = /* glsl */ `
#define SURFACE_SIZE 4.0
#ifndef PI
#define PI 3.141592653589793
#endif
`;

const SWARM_UNIFORMS = /* glsl */ `
uniform float     uTime;
uniform float     uSize;        // ~16 * pixelRatio (fill-rate; PRD §7.4)
uniform float     uVScale;
uniform int       uFunction;
uniform vec2      uParamMin;
uniform vec2      uParamRange;
uniform sampler2D uFlow;        // RG=normalize(−∇J), B=speed, A=curl
uniform float     uLifetime;    // seconds per spawn→despawn cycle
uniform float     uFlowStep;    // world-units a particle travels downhill over one life
`;

/** Cheap hash so each seed maps to a stable spawn cell + phase (no texture, no state). */
const SWARM_HASH = /* glsl */ `
vec2 hash22(float n) {
  return fract(sin(vec2(n, n + 1.7)) * vec2(43758.5453, 22578.1459));
}
`;

export const swarmVertexShader = /* glsl */ `
${SWARM_CONSTS}
${SWARM_UNIFORMS}
${SWARM_HASH}
${functionFieldGLSL}

attribute float aSeed;   // per-particle [0,1) phase/spawn selector
attribute float aSpeed;  // per-particle life-rate multiplier (~0.5..1.5)

varying float vAlpha;

// world XZ (centred plane) ↔ uv01 ↔ param — IDENTICAL map to surfaceShaders.ts.
vec2 uvToWorldXZ(vec2 uv01) { return uv01 * SURFACE_SIZE - vec2(SURFACE_SIZE * 0.5); }
vec2 worldXZToUv(vec2 wxz)  { return (wxz + vec2(SURFACE_SIZE * 0.5)) / SURFACE_SIZE; }
vec2 uvToParam(vec2 uv01)   { return uParamMin + uv01 * uParamRange; }

void main() {
  // Normalized life 0..1 (stateless: pure function of seed/speed/time).
  float life = fract((uTime * aSpeed + aSeed) / uLifetime);

  // Spawn cell from the seed, kept off the very edge.
  vec2 h = hash22(aSeed * 91.7);
  vec2 spawnUv = clamp(0.05 + 0.9 * h, vec2(0.0), vec2(1.0));

  // Baked flow at the spawn cell (NearestFilter → exact texel).
  vec4 flow = texture2D(uFlow, spawnUv);
  vec2 dir  = flow.rg;   // unit descent direction
  float spd = flow.b;    // soft-normalized speed [0,1)
  float crl = flow.a;    // pseudo-curl (swirl)

  // Advance downhill (closed-form, frame-rate independent): travel ∝ life·speed,
  // plus a curl-rotated perpendicular wiggle so particles spiral into basins.
  float travel = life * uFlowStep * (0.3 + spd);
  vec2 perp = vec2(-dir.y, dir.x);
  float swirl = crl * sin(life * PI * 2.0 + aSeed * 6.28318) * 0.15;
  vec2 curUv = clamp(worldXZToUv(uvToWorldXZ(spawnUv) + dir * travel + perp * swirl),
                     vec2(0.0), vec2(1.0));

  // World XZ + terrain height (REUSE surfaceHeight so we ride the exact surface).
  vec2 wxz = uvToWorldXZ(curUv);
  vec2 p   = uvToParam(curUv);
  float y  = uVScale * surfaceHeight(uFunction, p) + 0.08; // sit just above the crust

  // Plane is authored XY then rotated −90°X (local +Z → world +Y): world = (x,y,z).
  vec3 worldPos = vec3(wxz.x, y, wxz.y);
  vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Fade in/out over the life; dim the whole swarm so it never overpowers the ball.
  vAlpha = sin(life * PI) * 0.55;

  // Fill-rate clamp (PRD §7.4): perspective size, hard-capped to 1..3 px.
  gl_PointSize = clamp(uSize / -mvPosition.z, 1.0, 3.0);
}
`;

export const swarmFragmentShader = /* glsl */ `
precision highp float;
varying float vAlpha;

void main() {
  // Soft circular sprite from gl_PointCoord — NO texture fetch (PRD §7.4).
  float d = distance(gl_PointCoord, vec2(0.5));
  float s = pow(1.0 - d, 3.0);   // soft core, falls to 0 at the rim
  float a = vAlpha * s;
  if (a < 0.01) discard;         // trim the additive halo's faint tail
  vec3 col = vec3(0.55, 0.85, 1.0); // cool cyan-white motes
  gl_FragColor = vec4(col * a, a);  // premultiplied for AdditiveBlending
}
`;
