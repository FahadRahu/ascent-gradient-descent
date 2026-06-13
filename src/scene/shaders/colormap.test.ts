import { magmaColormapGLSL, MAGMA_STOPS_GLSL } from './colormap';

describe('magma colormap GLSL chunk (structure guard)', () => {
  // The 9 locked stops (PRD §5.2) as normalized-float vec3 literals.
  const EXPECTED_STOPS = [
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

  it('exports a non-empty GLSL string', () => {
    expect(typeof magmaColormapGLSL).toBe('string');
    expect(magmaColormapGLSL.length).toBeGreaterThan(0);
  });

  it('declares the vec3 magma(float t) function signature', () => {
    expect(magmaColormapGLSL).toMatch(/vec3\s+magma\s*\(\s*float\s+t\s*\)/);
  });

  it('contains all 9 locked magma stops in exact normalized-float form', () => {
    for (const stop of EXPECTED_STOPS) {
      expect(magmaColormapGLSL).toContain(stop);
    }
  });

  it('MAGMA_STOPS_GLSL enumerates exactly the 9 stops, in order', () => {
    expect(MAGMA_STOPS_GLSL).toEqual(EXPECTED_STOPS);
  });

  it('remaps the input through [uColorLow, uColorHigh] before sampling', () => {
    // The remap must reference both locked uniform names.
    expect(magmaColormapGLSL).toContain('uColorLow');
    expect(magmaColormapGLSL).toContain('uColorHigh');
  });

  it('clamps t into [0,1] so out-of-range costs do not wrap the LUT', () => {
    expect(magmaColormapGLSL).toMatch(/clamp\s*\(/);
  });
});
