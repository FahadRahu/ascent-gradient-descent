import { surfaceVertexShader, surfaceFragmentShader } from './surfaceShaders';

const LOCKED_UNIFORMS = [
  'uFunction',
  'uVScale',
  'uParamMin',
  'uParamRange',
  'uContourSpacing',
  'uColorLow',
  'uColorHigh',
];

describe('surfaceShaders — vertex + fragment assembly (structure guard)', () => {
  it('exports two non-empty GLSL strings', () => {
    expect(typeof surfaceVertexShader).toBe('string');
    expect(typeof surfaceFragmentShader).toBe('string');
    expect(surfaceVertexShader.length).toBeGreaterThan(0);
    expect(surfaceFragmentShader.length).toBeGreaterThan(0);
  });

  it('vertex shader writes csm_Position and csm_Normal (CSM displacement + analytic normal)', () => {
    expect(surfaceVertexShader).toContain('csm_Position');
    expect(surfaceVertexShader).toContain('csm_Normal');
  });

  it('vertex shader calls both field functions (height + analytic grad)', () => {
    expect(surfaceVertexShader).toContain('surfaceHeight(');
    expect(surfaceVertexShader).toContain('surfaceGrad(');
  });

  it('vertex shader applies the per-axis Jacobian (uParamRange / SURFACE_SIZE)', () => {
    // The locked normal math divides the param range by the surface size.
    expect(surfaceVertexShader).toMatch(/uParamRange\.[xy]\s*\/\s*/);
  });

  it('fragment shader drives BOTH the albedo and emissive from the magma ramp', () => {
    // The magma ramp must drive csm_DiffuseColor (the surface albedo) — not just
    // emissive — or the default-white PBR albedo floods under the key light and
    // the colormap reads washed-out (PRD §5.2 shading note). Regression tripwire
    // for the Task-15 live-browser fix.
    expect(surfaceFragmentShader).toContain('csm_DiffuseColor');
    expect(surfaceFragmentShader).toContain('csm_Emissive');
    expect(surfaceFragmentShader).toContain('magma(');
  });

  it('fragment shader uses fwidth() for anti-aliased iso-loss contours', () => {
    expect(surfaceFragmentShader).toMatch(/fwidth\s*\(/);
    expect(surfaceFragmentShader).toContain('vHeightN');
    expect(surfaceFragmentShader).toContain('uContourSpacing');
  });

  it('fragment shader applies the soft rolloff e/(1+e) as the LAST emissive op', () => {
    // The emissive is written through a soft rolloff x/(1+x) so it stays < 1.0
    // and never trips the bloom luminance threshold (PRD §5.4). The current form
    // assigns csm_Emissive = <local> / (1.0 + <local>) where <local> is the
    // cost-scaled colour. Match the rolloff assignment generically, then assert
    // it is the FINAL write to csm_Emissive.
    const rolloff = /csm_Emissive\s*=\s*\w+\s*\/\s*\(\s*1\.0\s*\+\s*\w+\s*\)\s*;/;
    const m = surfaceFragmentShader.match(rolloff);
    expect(m, 'rolloff <x>/(1+<x>) assignment to csm_Emissive must be present').not.toBeNull();
    // Nothing may assign csm_Emissive after the rolloff — it is the final op.
    const after = surfaceFragmentShader.slice(m!.index! + m![0].length);
    expect(after).not.toMatch(/csm_Emissive\s*=/);
  });

  it('both shaders declare every locked uniform name', () => {
    for (const u of LOCKED_UNIFORMS) {
      const inVert = surfaceVertexShader.includes(u);
      const inFrag = surfaceFragmentShader.includes(u);
      expect(inVert || inFrag, `uniform ${u} must appear in at least one shader`).toBe(true);
    }
    // The displacement-relevant ones must be in the vertex shader specifically.
    for (const u of ['uFunction', 'uVScale', 'uParamMin', 'uParamRange']) {
      expect(surfaceVertexShader, `${u} must be in the vertex shader`).toContain(u);
    }
    // The colour/contour ones must be in the fragment shader specifically.
    for (const u of ['uColorLow', 'uColorHigh', 'uContourSpacing']) {
      expect(surfaceFragmentShader, `${u} must be in the fragment shader`).toContain(u);
    }
  });

  it('declares SURFACE_SIZE as a GLSL constant matching the TS mapping (4.0)', () => {
    expect(surfaceVertexShader).toMatch(/SURFACE_SIZE\s+4\.0/);
  });
});
