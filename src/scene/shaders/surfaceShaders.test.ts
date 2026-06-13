import { surfaceVertexShader, surfaceFragmentShader } from './surfaceShaders';

const LOCKED_UNIFORMS = [
  'uFunction',
  'uTime',
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

  it('fragment shader writes csm_Emissive and calls magma()', () => {
    expect(surfaceFragmentShader).toContain('csm_Emissive');
    expect(surfaceFragmentShader).toContain('magma(');
  });

  it('fragment shader uses fwidth() for the AA contour and animates by -uTime', () => {
    expect(surfaceFragmentShader).toMatch(/fwidth\s*\(/);
    expect(surfaceFragmentShader).toContain('uTime');
  });

  it('fragment shader applies the soft rolloff e/(1+e) as the LAST emissive op', () => {
    // The rolloff must be the final write to csm_Emissive (keeps values < 1.0).
    const rolloff = /csm_Emissive\s*\/\s*\(\s*1\.0\s*\+\s*csm_Emissive\s*\)/;
    const m = surfaceFragmentShader.match(rolloff);
    expect(m, 'rolloff e/(1+e) must be present').not.toBeNull();
    // Nothing may write csm_Emissive after the rolloff expression — it is the
    // final op. (We anchor on the rolloff itself, not lastIndexOf('csm_Emissive'),
    // because the rolloff reads csm_Emissive on its own RHS.)
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
    for (const u of ['uColorLow', 'uColorHigh', 'uContourSpacing', 'uTime']) {
      expect(surfaceFragmentShader, `${u} must be in the fragment shader`).toContain(u);
    }
  });

  it('declares SURFACE_SIZE as a GLSL constant matching the TS mapping (4.0)', () => {
    expect(surfaceVertexShader).toMatch(/SURFACE_SIZE\s+4\.0/);
  });
});
