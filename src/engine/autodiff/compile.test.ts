import { compileGradient } from './compile';

describe('compileGradient', () => {
  it('returns f and grad closures from a parsed-once expression', () => {
    const { f, grad } = compileGradient('x^2 + y^2');
    expect(f(3, 4)).toBe(25);
    const [gx, gy] = grad(3, 4);
    expect(gx).toBeCloseTo(6, 12); // 2x
    expect(gy).toBeCloseTo(8, 12); // 2y
  });

  it('computes the full 2D gradient in two passes (seed x, then y)', () => {
    const { grad } = compileGradient('x^2 * y + y^3');
    // ∂x = 2xy, ∂y = x^2 + 3y^2  at (2,3): ∂x=12, ∂y=4+27=31
    const [gx, gy] = grad(2, 3);
    expect(gx).toBeCloseTo(12, 12);
    expect(gy).toBeCloseTo(31, 12);
  });

  it('parses only once: f is callable many times without re-parsing', () => {
    const { f } = compileGradient('sin(x) + cos(y)');
    expect(f(0, 0)).toBeCloseTo(1, 12);
    expect(f(Math.PI / 2, Math.PI / 2)).toBeCloseTo(1, 12);
  });

  it('throws a useful error on an unparseable expression', () => {
    expect(() => compileGradient('x +* y')).toThrow();
  });
});
