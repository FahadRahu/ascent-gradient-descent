import { create, parseDependencies, type MathNode } from 'mathjs';
import { evalDual } from './evalDual';
import { D } from './dual';

// Modular parse-only import (PRD §4.4) — keeps the Vite bundle lean by pulling
// in only the parser, not all of mathjs.
const { parse } = create(parseDependencies);

export interface CompiledFunction {
  /** Cost value f(x, y). */
  f: (x: number, y: number) => number;
  /** Exact gradient [∂f/∂x, ∂f/∂y] via two forward-mode autodiff passes. */
  grad: (x: number, y: number) => [number, number];
  /** The parsed AST (exposed for KaTeX rendering / introspection in later milestones). */
  node: MathNode;
}

/**
 * Parse an expression in x and y ONCE and return reusable closures. The
 * descent loop calls f/grad thousands of times; the parser is never touched
 * again after this call (PRD §4.4: ~24× faster than re-parsing per step).
 */
export function compileGradient(expr: string): CompiledFunction {
  const node = parse(expr); // throws on syntax error — let it propagate

  const f = (x: number, y: number): number =>
    evalDual(node, { x: D(x, 0), y: D(y, 0) }).re;

  const grad = (x: number, y: number): [number, number] => {
    const gx = evalDual(node, { x: D(x, 1), y: D(y, 0) }).du; // seed x
    const gy = evalDual(node, { x: D(x, 0), y: D(y, 1) }).du; // seed y
    return [gx, gy];
  };

  return { f, grad, node };
}
