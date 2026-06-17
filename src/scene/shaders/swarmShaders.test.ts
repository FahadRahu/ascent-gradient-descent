import { swarmVertexShader, swarmFragmentShader } from './swarmShaders';

describe('swarmShaders — GLSL structure guards', () => {
  it('vertex reuses the surface field + declares the flow/param uniforms', () => {
    expect(swarmVertexShader).toContain('surfaceHeight(uFunction'); // rides the same terrain
    for (const u of ['uTime', 'uSize', 'uVScale', 'uFunction', 'uParamMin', 'uParamRange', 'uFlow']) {
      expect(swarmVertexShader).toContain(u);
    }
    expect(swarmVertexShader).toContain('#define SURFACE_SIZE 4.0');
  });

  it('vertex samples the flow with the GLSL1 texture2D form (not GLSL3 texture)', () => {
    expect(swarmVertexShader).toContain('texture2D(uFlow');
    expect(swarmVertexShader).not.toMatch(/[^2]texture\(uFlow/); // no bare texture(uFlow
  });

  it('vertex applies the fill-rate point-size clamp (PRD §7.4)', () => {
    expect(swarmVertexShader).toContain('gl_PointSize = clamp(');
  });

  it('fragment makes a soft circular sprite from gl_PointCoord with NO texture fetch', () => {
    expect(swarmFragmentShader).toContain('gl_PointCoord');
    expect(swarmFragmentShader).toContain('discard');
    expect(swarmFragmentShader).not.toContain('sampler'); // no texture in the fragment
  });
});
