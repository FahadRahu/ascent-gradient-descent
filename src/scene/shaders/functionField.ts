/**
 * Per-preset cost field as a GLSL chunk: `float surfaceHeight(int fn, vec2 p)`
 * returns f(x,y); `vec2 surfaceGrad(int fn, vec2 p)` returns the ANALYTIC
 * partials [∂f/∂x, ∂f/∂y]. Both switch on `uFunction` (passed as `fn`).
 *
 * Analytic partials — NOT screen-space dFdx (those are flat per-triangle and
 * would kill the clearcoat/env reflections). These forms are the same ones the
 * engine validates against finite differences in M0.
 *
 * ⚠️ The index `fn` MUST equal FUNCTION_GLSL_INDEX[functionId] (exported below),
 * which mirrors the engine FUNCTIONS registry order. Surface.tsx sets
 * uFunction from that map; functionField.test.ts asserts the two agree.
 *
 * AST→GLSL codegen is M3; M1a hand-writes the 9 presets from PRD §4.3.
 */

import { FUNCTIONS } from '../../engine/functions';

/**
 * functionId → GLSL switch index, derived from the registry order so it can
 * never silently drift. (sphere 0, matyas 1, booth 2, rosenbrock 3, beale 4,
 * saddle 5, himmelblau 6, rastrigin 7, ackley 8.)
 */
export const FUNCTION_GLSL_INDEX: Record<string, number> = Object.fromEntries(
  FUNCTIONS.map((fn, i) => [fn.id, i]),
);

export const functionFieldGLSL = /* glsl */ `
// PI for the periodic presets (rastrigin / ackley).
#ifndef PI
#define PI 3.141592653589793
#endif

// --- Cost f(x,y) for each preset (index = uFunction) ----------------------
float surfaceHeight(int fn, vec2 p) {
  float x = p.x;
  float y = p.y;
  switch (fn) {
    case 0: // sphere: x^2 + y^2
      return x * x + y * y;
    case 1: // matyas: 0.26(x^2+y^2) - 0.48xy
      return 0.26 * (x * x + y * y) - 0.48 * x * y;
    case 2: { // booth: (x+2y-7)^2 + (2x+y-5)^2
      float a = x + 2.0 * y - 7.0;
      float b = 2.0 * x + y - 5.0;
      return a * a + b * b;
    }
    case 3: { // rosenbrock: (1-x)^2 + 100(y-x^2)^2
      float a = 1.0 - x;
      float b = y - x * x;
      return a * a + 100.0 * b * b;
    }
    case 4: { // beale
      float A = 1.5 - x + x * y;
      float B = 2.25 - x + x * y * y;
      float C = 2.625 - x + x * y * y * y;
      return A * A + B * B + C * C;
    }
    case 5: // saddle: x^2 - y^2
      return x * x - y * y;
    case 6: { // himmelblau: (x^2+y-11)^2 + (x+y^2-7)^2
      float U = x * x + y - 11.0;
      float V = x + y * y - 7.0;
      return U * U + V * V;
    }
    case 7: // rastrigin: 20 + x^2+y^2 - 10(cos2πx + cos2πy)
      return 20.0 + x * x + y * y - 10.0 * (cos(2.0 * PI * x) + cos(2.0 * PI * y));
    case 8: { // ackley
      float r = sqrt(0.5 * (x * x + y * y));
      float c = 0.5 * (cos(2.0 * PI * x) + cos(2.0 * PI * y));
      return -20.0 * exp(-0.2 * r) - exp(c) + 2.718281828459045 + 20.0;
    }
    default: // unreachable (fn is always 0..8); a guaranteed return path
      return 0.0;
  }
}

// --- Analytic gradient [∂f/∂x, ∂f/∂y] for each preset ---------------------
vec2 surfaceGrad(int fn, vec2 p) {
  float x = p.x;
  float y = p.y;
  switch (fn) {
    case 0: // sphere
      return vec2(2.0 * x, 2.0 * y);
    case 1: // matyas
      return vec2(0.52 * x - 0.48 * y, 0.52 * y - 0.48 * x);
    case 2: { // booth
      float a = x + 2.0 * y - 7.0;
      float b = 2.0 * x + y - 5.0;
      return vec2(2.0 * a + 4.0 * b, 4.0 * a + 2.0 * b);
    }
    case 3: { // rosenbrock
      float b = y - x * x;
      return vec2(-2.0 * (1.0 - x) - 400.0 * x * b, 200.0 * b);
    }
    case 4: { // beale
      float A = 1.5 - x + x * y;
      float B = 2.25 - x + x * y * y;
      float C = 2.625 - x + x * y * y * y;
      float dx = 2.0 * A * (y - 1.0) + 2.0 * B * (y * y - 1.0) + 2.0 * C * (y * y * y - 1.0);
      float dy = 2.0 * A * x + 2.0 * B * (2.0 * x * y) + 2.0 * C * (3.0 * x * y * y);
      return vec2(dx, dy);
    }
    case 5: // saddle
      return vec2(2.0 * x, -2.0 * y);
    case 6: { // himmelblau
      float U = x * x + y - 11.0;
      float V = x + y * y - 7.0;
      return vec2(4.0 * x * U + 2.0 * V, 2.0 * U + 4.0 * y * V);
    }
    case 7: // rastrigin
      return vec2(
        2.0 * x + 20.0 * PI * sin(2.0 * PI * x),
        2.0 * y + 20.0 * PI * sin(2.0 * PI * y)
      );
    case 8: { // ackley (guarded at the origin cusp, like the engine)
      float r = sqrt(0.5 * (x * x + y * y));
      if (r < 1e-6) return vec2(0.0, 0.0);
      float cosTerm = exp(0.5 * (cos(2.0 * PI * x) + cos(2.0 * PI * y)));
      float gx = 4.0 * exp(-0.2 * r) * (0.5 * x / r) + cosTerm * PI * sin(2.0 * PI * x);
      float gy = 4.0 * exp(-0.2 * r) * (0.5 * y / r) + cosTerm * PI * sin(2.0 * PI * y);
      return vec2(gx, gy);
    }
    default: // unreachable (fn is always 0..8); a guaranteed return path
      return vec2(0.0, 0.0);
  }
}
`;
