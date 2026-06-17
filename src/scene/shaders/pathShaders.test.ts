import { pathVertexShader, pathFragmentShader } from './pathShaders';

describe('pathShaders — GLSL structure guards', () => {
  it('vertex passes the tube uv through', () => {
    expect(pathVertexShader).toContain('vPathUv = uv');
  });

  it('fragment reveals the trail behind the front and discards ahead', () => {
    expect(pathFragmentShader).toContain('smoothstep(uProgress, uProgress + uEdge, vPathUv.x)');
    expect(pathFragmentShader).toContain('discard');
  });

  it('fragment writes csm_DiffuseColor and uses the locked uniforms', () => {
    expect(pathFragmentShader).toContain('csm_DiffuseColor');
    for (const u of ['uProgress', 'uEdge', 'uHaloColor', 'uCoreColor']) {
      expect(pathFragmentShader).toContain(u);
    }
  });
});
