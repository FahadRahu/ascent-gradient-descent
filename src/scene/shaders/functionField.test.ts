import {
  functionFieldGLSL,
  FUNCTION_GLSL_INDEX,
} from './functionField';
import { FUNCTIONS } from '../../engine/functions';

describe('functionField GLSL chunk (structure guard)', () => {
  it('FUNCTION_GLSL_INDEX matches the engine FUNCTIONS order exactly', () => {
    // The GLSL switch indices MUST equal the registry array order.
    FUNCTIONS.forEach((fn, i) => {
      expect(FUNCTION_GLSL_INDEX[fn.id]).toBe(i);
    });
    // and there are exactly 9 entries (no extras, no gaps).
    expect(Object.keys(FUNCTION_GLSL_INDEX).length).toBe(9);
  });

  it('declares both required GLSL signatures', () => {
    expect(functionFieldGLSL).toMatch(/float\s+surfaceHeight\s*\(\s*int\s+fn\s*,\s*vec2\s+p\s*\)/);
    expect(functionFieldGLSL).toMatch(/vec2\s+surfaceGrad\s*\(\s*int\s+fn\s*,\s*vec2\s+p\s*\)/);
  });

  it('has a switch case for every index 0..8 in BOTH functions', () => {
    // Each function body must branch on all 9 indices. We assert that the
    // literal `case N:` appears at least twice (once per function) for N=0..8.
    for (let i = 0; i < 9; i++) {
      const matches = functionFieldGLSL.match(new RegExp(`case\\s+${i}\\s*:`, 'g')) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('guards the Ackley origin (avoids 0/0 in the GLSL gradient)', () => {
    // The ackley branch divides by r = sqrt(0.5*(x^2+y^2)); must guard r→0.
    expect(functionFieldGLSL).toMatch(/r\s*<\s*1e-/);
  });

  it('references trig for the periodic functions (rastrigin/ackley use cos/sin)', () => {
    expect(functionFieldGLSL).toContain('cos(');
    expect(functionFieldGLSL).toContain('sin(');
  });
});
