import { D, dConst, add, sub, mul, div, pow, neg, sin, cos, exp, log, sqrt, abs } from './dual';

describe('Dual numbers', () => {
  it('constant has zero derivative', () => {
    const c = dConst(5);
    expect(c.re).toBe(5);
    expect(c.du).toBe(0);
  });

  it('sum rule: d/dx[x + x] at x=3 is 2; adding a constant leaves the derivative at 1', () => {
    const x = D(3, 1); // seed x with derivative 1
    const doubled = add(x, x);
    expect(doubled.re).toBe(6);
    expect(doubled.du).toBe(2);
    const shifted = add(x, dConst(10));
    expect(shifted.re).toBe(13);
    expect(shifted.du).toBe(1);
  });

  it('product rule: d/dx[x*x] at x=3 is 2x=6', () => {
    const x = D(3, 1); // seed x with derivative 1
    const r = mul(x, x);
    expect(r.re).toBe(9);
    expect(r.du).toBe(6);
  });

  it('quotient rule: d/dx[1/x] at x=2 is -1/x^2 = -0.25', () => {
    const x = D(2, 1);
    const r = div(dConst(1), x);
    expect(r.re).toBe(0.5);
    expect(r.du).toBeCloseTo(-0.25, 12);
  });

  it('pow with constant exponent: d/dx[x^3] at x=2 is 3x^2=12', () => {
    const x = D(2, 1);
    const r = pow(x, dConst(3));
    expect(r.re).toBe(8);
    expect(r.du).toBeCloseTo(12, 12);
  });

  it('pow with variable exponent: d/dx[x^x] at x=2 is x^x(ln x + 1) = 4(ln2+1)', () => {
    const x = D(2, 1);
    const r = pow(x, x);
    expect(r.re).toBeCloseTo(4, 12);
    expect(r.du).toBeCloseTo(4 * (Math.log(2) + 1), 12);
  });

  it('chain rule through sin: d/dx[sin(x*x)] at x=1 is 2x*cos(x^2)=2cos(1)', () => {
    const x = D(1, 1);
    const r = sin(mul(x, x));
    expect(r.re).toBeCloseTo(Math.sin(1), 12);
    expect(r.du).toBeCloseTo(2 * Math.cos(1), 12);
  });

  it('exp, log, sqrt, neg, sub derivatives at x=4', () => {
    const x = D(4, 1);
    expect(exp(x).du).toBeCloseTo(Math.exp(4), 6);
    expect(log(x).du).toBeCloseTo(1 / 4, 12);       // d/dx ln x = 1/x
    expect(sqrt(x).du).toBeCloseTo(1 / (2 * 2), 12); // d/dx sqrt x = 1/(2 sqrt x) = 1/4
    expect(neg(x).du).toBe(-1);
    expect(sub(x, dConst(1)).du).toBe(1);
  });

  it('cos derivative: d/dx[cos(x)] at x=1 is -sin(1)', () => {
    const x = D(1, 1);
    expect(cos(x).du).toBeCloseTo(-Math.sin(1), 12);
  });

  it('abs subgradient: d/dx|x| is sign(x); at x=-3 is -1, at x=0 is 0', () => {
    expect(abs(D(-3, 1)).du).toBe(-1);
    expect(abs(D(0, 1)).du).toBe(0);
  });
});
