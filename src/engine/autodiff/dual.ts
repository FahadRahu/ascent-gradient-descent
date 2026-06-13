/**
 * Forward-mode automatic differentiation via dual numbers.
 * A dual number re + du·ε (ε² = 0) carries a value and its first derivative.
 * Each operation applies the exact derivative rule, so composing them
 * gives the exact gradient of any composition — no step-size error.
 */
export interface Dual {
  readonly re: number; // value
  readonly du: number; // derivative w.r.t. the seeded variable
}

/** Construct a dual with explicit value and derivative. */
export const D = (re: number, du: number): Dual => ({ re, du });

/** A constant carries zero derivative. */
export const dConst = (re: number): Dual => ({ re, du: 0 });

export const add = (a: Dual, b: Dual): Dual => ({ re: a.re + b.re, du: a.du + b.du });

export const sub = (a: Dual, b: Dual): Dual => ({ re: a.re - b.re, du: a.du - b.du });

export const mul = (a: Dual, b: Dual): Dual => ({
  re: a.re * b.re,
  du: a.du * b.re + a.re * b.du, // product rule
});

export const div = (a: Dual, b: Dual): Dual => ({
  re: a.re / b.re,
  du: (a.du * b.re - a.re * b.du) / (b.re * b.re), // quotient rule
});

export const neg = (a: Dual): Dual => ({ re: -a.re, du: -a.du });

/**
 * Power rule. When the exponent is constant (b.du === 0) use the cheap
 * monomial rule b·a^(b-1)·a' — this also avoids ln of a non-positive base
 * (e.g. (1-x)^2 where 1-x can be negative). Otherwise use the general rule
 * a^b·(b'·ln(a) + b·a'/a), required for variable exponents like x^y.
 */
export const pow = (a: Dual, b: Dual): Dual => {
  if (b.du === 0) {
    const re = Math.pow(a.re, b.re);
    const du = b.re * Math.pow(a.re, b.re - 1) * a.du;
    return { re, du };
  }
  const re = Math.pow(a.re, b.re);
  const du = re * (b.du * Math.log(a.re) + (b.re * a.du) / a.re);
  return { re, du };
};

export const sin = (a: Dual): Dual => ({ re: Math.sin(a.re), du: Math.cos(a.re) * a.du });

export const cos = (a: Dual): Dual => ({ re: Math.cos(a.re), du: -Math.sin(a.re) * a.du });

export const exp = (a: Dual): Dual => {
  const e = Math.exp(a.re);
  return { re: e, du: e * a.du };
};

/** Natural logarithm (matches mathjs `log`). */
export const log = (a: Dual): Dual => ({ re: Math.log(a.re), du: a.du / a.re });

export const sqrt = (a: Dual): Dual => {
  const s = Math.sqrt(a.re);
  return { re: s, du: a.du / (2 * s) };
};

/** Subgradient of |x|: sign(x); sign(0) = 0 (non-differentiable point). */
export const abs = (a: Dual): Dual => ({ re: Math.abs(a.re), du: Math.sign(a.re) * a.du });
