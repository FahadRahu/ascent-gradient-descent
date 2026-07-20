import { functionFieldGLSL } from './functionField';
import { magmaColormapGLSL } from './colormap';

/**
 * The CSM vertex + fragment shaders for the displaced magma surface.
 *
 * VERTEX: reconstruct the parameter point p from the plane's local XY using
 * uParamMin/uParamRange, displace csm_Position.z = uVScale·height, and write
 * the ANALYTIC csm_Normal with the mesh-space Jacobian (uParamRange/SURFACE_SIZE
 * per axis). The plane is authored in local XY and rotated -90° about X, so
 * local +Z maps to world +Y; the normal is written in local space accordingly.
 *
 * FRAGMENT: colour by normalized height through magma(), overlay fwidth()-AA
 * contour lines animated by -uTime, and write csm_Emissive with the soft
 * rolloff e/(1+e) as the LAST op so highlights stay sub-1.0 (never trip bloom).
 *
 * ⚠️ KEEP IN SYNC WITH surfaceMapping.ts: SURFACE_SIZE here (4.0) mirrors the TS
 * SURFACE_SIZE; uVScale is surfaceMapping.vScaleFor(functionId); uParamMin /
 * uParamRange come from getFunction(id).domain. Task 8 wires the uniforms.
 */

const SURFACE_GLSL_CONSTS = /* glsl */ `
#define SURFACE_SIZE 4.0
`;

const SURFACE_UNIFORMS = /* glsl */ `
uniform int   uFunction;
uniform float uVScale;
uniform vec2  uParamMin;
uniform vec2  uParamRange;
uniform float uContourSpacing;
uniform float uColorLow;
uniform float uColorHigh;
`;

export const surfaceVertexShader = /* glsl */ `
${SURFACE_GLSL_CONSTS}
${SURFACE_UNIFORMS}

${functionFieldGLSL}

varying vec2 vParam;     // parameter-space point, for the fragment shader
varying float vHeightN;  // normalized height (0..1) for colouring

void main() {
  // 'uv' is the plane's built-in [0,1]² UV (CSM/three provide it). Map it to
  // parameter space: p = uParamMin + uv * uParamRange.
  vec2 p = uParamMin + uv * uParamRange;
  vParam = p;

  float h = surfaceHeight(uFunction, p);   // raw cost
  vec2  g = surfaceGrad(uFunction, p);      // analytic [df/dx, df/dy]

  // Displace along local +Z (becomes world +Y after the -90°X plane rotation).
  csm_Position.z = uVScale * h;

  // Per-axis mesh-space Jacobian: param axes are scaled from world XZ by
  // (uParamRange / SURFACE_SIZE). Analytic normal in LOCAL space (pre-rotation).
  float jx = uParamRange.x / SURFACE_SIZE;
  float jz = uParamRange.y / SURFACE_SIZE;
  csm_Normal = normalize(vec3(-uVScale * g.x * jx, -uVScale * g.y * jz, 1.0));

  // Normalized height for the fragment colour ramp. The cost range that maps to
  // ~1.5 world units corresponds to height/uVScale; normalize against that band
  // so the magma ramp fills regardless of function scale. (1.5 = the contract's
  // pleasing peak height in world units.)
  vHeightN = clamp((uVScale * h) / 1.5, 0.0, 1.0);
}
`;

export const surfaceFragmentShader = /* glsl */ `
${SURFACE_UNIFORMS}

${magmaColormapGLSL}

varying vec2 vParam;
varying float vHeightN;

// Approximate sRGB→linear for an albedo/emissive triple. The magma stops are
// authored as sRGB hex (PRD §5.2); three's PBR pipeline works in LINEAR space
// (ColorManagement on), so a colour assigned directly to csm_DiffuseColor /
// csm_Emissive must be linearised first or it reads washed-out and desaturated.
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

void main() {
  // Base colour from the magma ramp (magma() does the [uColorLow,uColorHigh] remap).
  vec3 col = magma(vHeightN);

  // True iso-loss contours: every line joins points with the same cost. This
  // reads like a topographic map instead of an arbitrary parameter-space grid.
  float bands = vHeightN / max(uContourSpacing, 1e-4);
  float contourDistance = abs(fract(bands) - 0.5) / fwidth(bands);
  float contour = 1.0 - min(contourDistance, 1.0);
  vec3 lineColor = mix(col, vec3(0.78, 0.86, 0.94), 0.34);
  col = mix(col, lineColor, contour * 0.72);

  vec3 colLin = toLinear(col);

  // The magma ramp IS the surface albedo (PRD §5.2): the colormap must drive the
  // visible colour, not a default-white albedo that the key light floods. Keep
  // it the diffuse base so clearcoat/env still read as physical shading on top.
  csm_DiffuseColor = vec4(colLin, 1.0);

  // Modest cost-scaled self-illumination (PRD §5.4): a little glow in the valley,
  // more toward the hot peaks, so the ramp reads even on shadowed faces. The soft
  // rolloff e/(1+e) is the LAST op so the surface stays sub-1.0 and never trips
  // the bloom luminance threshold (≤0.4-equivalent; PRD §5.4 surface row).
  vec3 emissive = colLin * (0.18 + 0.30 * vHeightN);
  csm_Emissive = emissive / (1.0 + emissive);
}
`;
