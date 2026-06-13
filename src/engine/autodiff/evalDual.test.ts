import { create, parseDependencies } from 'mathjs';
import { evalDual } from './evalDual';
import { D, dConst } from './dual';

const { parse } = create(parseDependencies);

describe('evalDual — AST walker', () => {
  it('evaluates value and ∂x for a polynomial: f=x^2+y^2 at (3,4), ∂x=2x=6', () => {
    const node = parse('x^2 + y^2');
    const env = { x: D(3, 1), y: D(4, 0) }; // seed x
    const r = evalDual(node, env);
    expect(r.re).toBe(25);
    expect(r.du).toBeCloseTo(6, 12);
  });

  it('handles ParenthesisNode and unaryMinus: f=-(1-x)^2 at x=0, ∂x=2(1-x)=2', () => {
    const node = parse('-(1 - x)^2');
    const r = evalDual(node, { x: D(0, 1) });
    expect(r.re).toBeCloseTo(-1, 12);
    expect(r.du).toBeCloseTo(2, 12); // d/dx[-(1-x)^2] = 2(1-x) = 2 at x=0
  });

  it('resolves pi and e as constants (SymbolNode, not ConstantNode)', () => {
    const node = parse('cos(2*pi*x) + e');
    const r = evalDual(node, { x: dConst(0) });
    expect(r.re).toBeCloseTo(1 + Math.E, 12); // cos(0)+e
  });

  it('handles FunctionNode (name on node.name) — sin/exp/log/sqrt', () => {
    const node = parse('sin(x) * exp(x)');
    const r = evalDual(node, { x: D(0, 1) });
    expect(r.re).toBeCloseTo(0, 12);
    // d/dx[sin x · e^x] = e^x(cos x + sin x) = 1 at x=0
    expect(r.du).toBeCloseTo(1, 12);
  });

  it('handles all binary operators add/sub/mul/div via node.fn dispatch', () => {
    const node = parse('(x + 1) - (x * 2) / (x - 3)');
    // at x=1: (2) - (2)/(-2) = 2 + 1 = 3
    const r = evalDual(node, { x: D(1, 0) });
    expect(r.re).toBeCloseTo(3, 12);
  });

  it('throws on an unknown symbol', () => {
    const node = parse('x + z');
    expect(() => evalDual(node, { x: dConst(1) })).toThrow(/unknown symbol/i);
  });
});
