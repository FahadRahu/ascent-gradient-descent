# ASCENT M0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the stack to the modern R3F/React 19 versions, clear the legacy `src/`, and build a fully unit-tested pure-TypeScript `engine/` (cost-function registry with dual-number autodiff, all 9 optimizers, fixed-timestep stepper) plus the Zustand two-channel state skeleton — with every gradient validated against finite differences to ~1e-6 and an empty scene rendering.

**Architecture:** A pure-TS `engine/` module (no React/Three imports) holds all math: a cost-function registry where each function carries an autodiff-derived gradient, a forward-mode dual-number autodiff layer that walks the math.js AST (parse-once, compile-once), 9 optimizers each implemented as a stateful `step()` behind one uniform interface that accepts a *gradient function* (so Nesterov's look-ahead and Newton's Hessian fit the same signature), and a fixed-timestep accumulator stepper. A thin `state/` layer wires Zustand 5 stores following the two-channel rule (§8.2): slow UI state via reactive selectors, fast sim state via refs + `getState()`/`subscribe()`. A minimal `scene/` mounts an empty R3F Canvas to prove the upgraded stack renders. A `quality/` stub holds the tier type. Everything in `engine/` is testable in isolation under Vitest with no DOM.

**Tech Stack:** React 19.2 · @react-three/fiber 9.6 · @react-three/drei 10.7 · @react-three/postprocessing 3.0 · three ~0.184 · zustand 5.0 · mathjs 15.2 (modular `create()`, parse-only) · Vite 7 · @vitejs/plugin-react 5.2 · Vitest 4.1 · @react-three/test-renderer 9.1 · TypeScript 5.

---

## Context for the implementer

You are building the foundation of ASCENT, a 3D gradient-descent teaching/showpiece app. **Read `PRD.md` at the repo root once before starting** — it is the single source of truth. This M0 plan implements PRD §11 milestone M0 only (the math engine + stack upgrade); it does NOT build the visuals, shaders, UI, or racing mode (those are M1–M4).

### Locked decisions (already made — do not re-litigate)

1. **Clean slate.** The 28 legacy `src/components/ThreeGradientDescent/*` files and `GradientDescentVisualization.tsx` are preserved on the `legacy` git branch. On `main` we delete them and rebuild under the §8.4 module boundaries (`engine/`, `scene/`, `state/`, `ui/`, `quality/`). Task 1 does this deletion.
2. **9th optimizer is Nadam** (constant-β₁ closed form, after Ruder 2016). The PRD enumerates 8 update rules under a "suite of 9" header; Nadam completes the Adam family. See Task 13.
3. **All numeric test values in this plan are execution-verified** — computed by running real Node scripts during planning, not derived by hand. The Rosenbrock gradient is `[0,0]` at (1,1); the Ackley gradient has a genuine 0/0 cusp at the origin (guarded, not asserted there); AdamW step-1 from (1,1) on x²+y² is `0.998990000005` (matches PyTorch exactly); Nadam step-1 is `0.996200000019` (matches Ruder's closed form). Use the values exactly as written.

### Versions (verified against npm on 2026-06-12 — all resolve cleanly)

All PRD §8.1 pins are still valid. The PRD does **not** pin the build/test tooling, so we choose the mature intersection: Vite 7 + `@vitejs/plugin-react@5.2.0` (NOT plugin-react 6, which would force the bleeding-edge rolldown Vite 8) + Vitest 4.1.8. `three` is pinned with a **tilde** (`~0.184.0`) because the `postprocessing` core (a transitive dep of `@react-three/postprocessing@3`) caps its peer at `three <0.185.0`; a caret would let a future 0.185 silently break the post-stack in M1.

### The math.js AST contract (execution-verified against mathjs 15.2.0)

The autodiff walker (Tasks 4–6) depends on these mathjs 15 specifics, all confirmed by running real code:
- **Modular parse-only import works:** `import { create, parseDependencies } from 'mathjs'; const { parse } = create(parseDependencies);` keeps the bundle lean (PRD §4.4).
- **Node types** the walker must handle: `ConstantNode` (`.value`, a JS number), `SymbolNode` (`.name`), `OperatorNode` (`.op`, `.fn`, `.args[]`, `.isUnary()`), `FunctionNode` (`.name`, `.args[]`), `ParenthesisNode` (`.content`).
- **The #1 trap:** `OperatorNode.fn` is a **string** (`'add'`/`'subtract'`/`'multiply'`/`'divide'`/`'pow'`/`'unaryMinus'`) — dispatch on it. `FunctionNode.fn` is an **object** — read its name via `FunctionNode.name` instead.
- `pi` and `e` parse as **SymbolNode** (not ConstantNode) — resolve them to `Math.PI`/`Math.E` with dual `0`.
- `-x` is an `OperatorNode` with `op='-'`, `fn='unaryMinus'`, `args.length===1`, `isUnary()===true` — it shares `op='-'` with binary subtract, which is why you dispatch on `.fn` not `.op`.
- `^` is `OperatorNode` `fn='pow'`. `2x` / `2*pi*x` expand to ordinary `multiply` chains (no special node).
- `ParenthesisNode` must be recursed into via `.content` (it has no `args` array).
- `log` is natural log. The general `pow` rule `a^b·(b'·ln(a) + b·a'/a)` is needed for variable exponents (`x^y`); keep the constant-exponent fast path (`b·a^(b-1)·a'`) only as an optimization that also dodges `ln` of a non-positive base.

---

## File Structure

This is the complete set of files M0 creates or touches, grouped by the §8.4 module boundaries.

**Deleted (Task 1):** all of `src/components/`, `src/utils/costFunction.ts` (the legacy 2-param MSE demo). Kept: `src/utils/cn.ts`, `src/styles/globals.css`, `index.html`, `tailwind.config.js`, `postcss.config.js`.

**Config (Tasks 2–3):**
- `package.json` — modify: deps/devDeps replaced with the modern stack; add test scripts.
- `vite.config.ts` — modify: add the `test` block (Vitest config lives in the Vite config).
- `vitest.setup.ts` — create: WebGL/RAF shims for `@react-three/test-renderer`.
- `tsconfig.json` — modify: add `vitest/globals` + `node` types, add path alias check.

**Engine (Tasks 4–16) — pure TS, no React/Three:**
- `src/engine/types.ts` — create: `Vec2`, `GradFn`, `HessFn`, `CostFunction`, `Optimizer`, `OptimizerState`, `StepResult`, `OptimizerId`, hyperparameter types.
- `src/engine/autodiff/dual.ts` — create: the `Dual` number type + arithmetic.
- `src/engine/autodiff/evalDual.ts` — create: the AST walker that evaluates a math.js node with Dual numbers.
- `src/engine/autodiff/compile.ts` — create: parse-once → `compileGradient(expr)` returning `{ f, grad }`.
- `src/engine/autodiff/index.ts` — create: barrel.
- `src/engine/functions/registry.ts` — create: the 9 curated functions + lookup.
- `src/engine/functions/index.ts` — create: barrel.
- `src/engine/optimizers/sgd.ts`, `momentum.ts`, `nesterov.ts`, `adagrad.ts`, `rmsprop.ts`, `adam.ts`, `adamw.ts`, `nadam.ts`, `newton.ts` — create: one per optimizer.
- `src/engine/optimizers/registry.ts` — create: id → factory map + defaults.
- `src/engine/optimizers/index.ts` — create: barrel.
- `src/engine/stepper.ts` — create: fixed-timestep accumulator.
- `src/engine/index.ts` — create: top-level barrel.

**Engine tests (colocated under Tasks 4–16):**
- `src/engine/autodiff/dual.test.ts`, `evalDual.test.ts`, `compile.test.ts`
- `src/engine/functions/registry.test.ts`
- `src/engine/optimizers/*.test.ts` (one per optimizer) + `registry.test.ts`
- `src/engine/stepper.test.ts`
- `src/engine/finite-difference.test.ts` — the cross-cutting gradient-vs-finite-difference validation over the whole registry (the PRD's headline correctness gate).

**State (Task 17):**
- `src/state/uiStore.ts` — create: Zustand store, Channel A (slow/UI).
- `src/state/simStore.ts` — create: vanilla Zustand store with `subscribeWithSelector`, Channel B (fast/sim).
- `src/state/index.ts` — create: barrel.
- `src/state/uiStore.test.ts` — create.

**Quality (Task 18):**
- `src/quality/tiers.ts` — create: `Tier` type + the tier→settings map (data only; detection wiring is M1).

**Scene + app shell (Task 19):**
- `src/scene/Scene.tsx` — create: empty R3F Canvas.
- `src/App.tsx` — modify: render the empty scene.
- `src/main.tsx` — keep as-is (already React 19 compatible).

**CI (Task 20):**
- `.github/workflows/ci.yml` — create.

---

## Task 1: Clean slate — remove legacy `src/`, branch for the work

**Files:**
- Delete: `src/components/` (entire dir, 29 files), `src/utils/costFunction.ts`
- Keep: `src/utils/cn.ts`, `src/styles/globals.css`, `src/main.tsx`, `index.html`, `tailwind.config.js`, `postcss.config.js`

- [ ] **Step 1: Confirm the legacy branch has everything, then branch for M0**

```bash
git branch -a                      # verify 'legacy' exists
git log legacy --oneline -1        # verify legacy points at the preserved impl
git checkout -b m0-foundation      # do the work on a feature branch off main
```

Expected: `legacy` listed; you are now on `m0-foundation`.

- [ ] **Step 2: Delete the legacy component tree and the legacy cost function**

```bash
git rm -r "src/components"
git rm "src/utils/costFunction.ts"
```

Expected: 30 files staged for deletion. `src/utils/cn.ts` and `src/styles/globals.css` remain.

- [ ] **Step 3: Replace `src/App.tsx` with a placeholder so the build doesn't break**

`src/App.tsx` currently imports the deleted `GradientDescentVisualization`. Replace its entire contents with a minimal placeholder (the real empty scene comes in Task 19):

```tsx
function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <p className="font-mono text-sm opacity-60">ASCENT — engine bootstrapping…</p>
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Verify nothing else references the deleted files**

Run: `grep -rn "ThreeGradientDescent\|GradientDescentVisualization\|costFunction" src/ index.html`
Expected: no matches (App.tsx no longer imports them).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(m0): clear legacy src/, preserve on legacy branch

Legacy 3D demo (28 ThreeGradientDescent components + the MSE costFunction)
is archived on the 'legacy' branch. main is rebuilt under the PRD §8.4
module boundaries (engine/scene/state/ui/quality)."
```

---

## Task 2: Upgrade the stack — package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace `package.json` with the modern stack**

Write the entire file (versions verified against npm 2026-06-12):

```json
{
  "name": "ascent-gradient-descent",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "ASCENT — interactive 3D gradient-descent simulation (teaching tool + showpiece)",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.6.1",
    "@react-three/postprocessing": "^3.0.4",
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "mathjs": "^15.2.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "three": "~0.184.0",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@react-three/test-renderer": "^9.1.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@types/three": "^0.184.0",
    "@vitejs/plugin-react": "^5.2.0",
    "@vitest/coverage-v8": "^4.1.8",
    "@vitest/ui": "^4.1.8",
    "autoprefixer": "^10.4.20",
    "happy-dom": "^20.10.2",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3",
    "vite": "^7.0.0",
    "vitest": "^4.1.8"
  }
}
```

Notes for the implementer:
- `three` uses `~` (tilde, patch-only) on purpose — `postprocessing` (transitive via `@react-three/postprocessing@3`) requires `three <0.185.0`.
- `@react-spring/three`, `three-stdlib`, and the old `@types/node@25` are removed. (drei bundles what it needs.)
- `@types/node` dropped to `^22` to match Vitest 4's peer (`^20 || ^22 || >=24`) and the local Node 22.

- [ ] **Step 2: Install and verify a clean resolution**

```bash
rm -rf node_modules package-lock.json
npm install
```

Expected: install completes with **no peer-dependency errors** (`npm error ERESOLVE` must NOT appear). If it does, stop and report — do not paper over it with `--legacy-peer-deps`.

- [ ] **Step 3: Verify the key versions actually resolved**

```bash
npm ls react @react-three/fiber @react-three/drei @react-three/postprocessing three zustand mathjs vitest vite 2>&1 | grep -E "react@|fiber@|drei@|postprocessing@|three@|zustand@|mathjs@|vitest@|vite@"
```

Expected: `react@19.2.x`, `@react-three/fiber@9.6.x`, `@react-three/drei@10.7.x`, `@react-three/postprocessing@3.0.x`, `three@0.184.x`, `zustand@5.0.x`, `mathjs@15.2.x`, `vitest@4.1.x`, `vite@7.x`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(m0): upgrade to R3F 9 / React 19 / drei 10 / postprocessing 3 / three ~0.184 / zustand 5

Adds mathjs 15 (parse-only), Vitest 4 + @react-three/test-renderer 9.
Vite 7 + plugin-react 5.2 (plugin-react 6 would force rolldown Vite 8).
three pinned ~0.184 (postprocessing core caps at <0.185)."
```

---

## Task 3: Test harness — Vitest config, setup shims, tsconfig

**Files:**
- Modify: `vite.config.ts`
- Create: `vitest.setup.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Add the `test` block to `vite.config.ts`**

Replace the entire file. Engine tests run in the fast `node` environment; only the R3F smoke test needs a DOM, which it gets via a per-file `// @vitest-environment happy-dom` pragma.

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/state/**', 'src/quality/**'],
      reporter: ['text', 'html'],
    },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

The pure-engine tests need nothing, but the R3F smoke test (Task 19) needs `requestAnimationFrame` and a stub WebGL context. Keep the shims minimal and guarded so they're harmless in the `node` environment.

```ts
import { afterEach, vi } from 'vitest';

// requestAnimationFrame / cancelAnimationFrame shims (jsdom/happy-dom + node).
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number);
  globalThis.cancelAnimationFrame = ((id: number): void =>
    clearTimeout(id as unknown as NodeJS.Timeout));
}

afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: Update `tsconfig.json` to know about Vitest globals + node**

Replace the `types` line so `describe`/`it`/`expect` and `process` typecheck without per-file imports:

```jsonc
// in compilerOptions, replace:
//   "types": ["vite/client"],
// with:
    "types": ["vite/client", "vitest/globals", "node"],
```

Leave everything else in `tsconfig.json` unchanged.

- [ ] **Step 4: Smoke-test the harness with a trivial test**

Create `src/engine/sanity.test.ts`:

```ts
describe('vitest harness', () => {
  it('runs and has globals', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed. (`describe`/`it`/`expect` resolve via globals — no imports needed.)

- [ ] **Step 5: Delete the sanity test, commit the harness**

```bash
rm src/engine/sanity.test.ts
git add vite.config.ts vitest.setup.ts tsconfig.json
git commit -m "test(m0): add Vitest 4 harness (node env, happy-dom for R3F, v8 coverage)"
```

---

## Task 4: Dual numbers — the autodiff primitive

**Files:**
- Create: `src/engine/autodiff/dual.ts`
- Test: `src/engine/autodiff/dual.test.ts`

A dual number `a + b·ε` (where `ε² = 0`) carries a value `re` and its derivative `du`. Arithmetic on duals propagates exact derivatives (forward-mode autodiff). This is the ~100-line core the PRD §4.4 describes.

- [ ] **Step 1: Write the failing test**

`src/engine/autodiff/dual.test.ts`:

```ts
import { D, dConst, add, sub, mul, div, pow, neg, sin, cos, exp, log, sqrt, abs } from './dual';

describe('Dual numbers', () => {
  it('constant has zero derivative', () => {
    const c = dConst(5);
    expect(c.re).toBe(5);
    expect(c.du).toBe(0);
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- dual`
Expected: FAIL — `Cannot find module './dual'`.

- [ ] **Step 3: Implement `src/engine/autodiff/dual.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- dual`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/autodiff/dual.ts src/engine/autodiff/dual.test.ts
git commit -m "feat(engine): dual-number autodiff primitive with exact derivative rules"
```

---

## Task 5: AST evaluator — walk a math.js node with dual numbers

**Files:**
- Create: `src/engine/autodiff/evalDual.ts`
- Test: `src/engine/autodiff/evalDual.test.ts`

This walks a parsed math.js AST, evaluating it with `Dual` numbers from an environment that maps variable names to duals. Seeding `x`'s dual to 1 (and `y`'s to 0) yields `∂f/∂x` in one pass.

- [ ] **Step 1: Write the failing test**

`src/engine/autodiff/evalDual.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- evalDual`
Expected: FAIL — `Cannot find module './evalDual'`.

- [ ] **Step 3: Implement `src/engine/autodiff/evalDual.ts`**

```ts
import type { MathNode } from 'mathjs';
import { Dual, D, dConst, add, sub, mul, div, pow, neg, sin, cos, exp, log, sqrt, abs } from './dual';

/** Environment: variable name → its dual (seeded value + derivative). */
export type DualEnv = Record<string, Dual>;

/** Named constants that parse as SymbolNode in math.js. */
const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

/** Elementary single-argument functions (FunctionNode). */
const UNARY_FNS: Record<string, (a: Dual) => Dual> = {
  sin,
  cos,
  exp,
  log,
  sqrt,
  abs,
};

/**
 * Recursively evaluate a parsed math.js AST node with dual-number arithmetic.
 * Dispatch is on node.type, and for OperatorNode on node.fn (a STRING:
 * 'add'/'subtract'/'multiply'/'divide'/'pow'/'unaryMinus'). Note the asymmetry:
 * OperatorNode.fn is a string, but FunctionNode.fn is an object — read its name
 * via FunctionNode.name. pi/e/tau are SymbolNodes resolved as constants.
 */
export function evalDual(node: MathNode, env: DualEnv): Dual {
  switch (node.type) {
    case 'ConstantNode':
      return dConst((node as unknown as { value: number }).value);

    case 'SymbolNode': {
      const name = (node as unknown as { name: string }).name;
      if (name in env) return env[name];
      if (name in CONSTANTS) return dConst(CONSTANTS[name]);
      throw new Error(`Unknown symbol: ${name}`);
    }

    case 'ParenthesisNode':
      return evalDual((node as unknown as { content: MathNode }).content, env);

    case 'OperatorNode': {
      const op = node as unknown as { fn: string; args: MathNode[] };
      if (op.fn === 'unaryMinus') {
        return neg(evalDual(op.args[0], env));
      }
      const a = evalDual(op.args[0], env);
      const b = evalDual(op.args[1], env);
      switch (op.fn) {
        case 'add':
          return add(a, b);
        case 'subtract':
          return sub(a, b);
        case 'multiply':
          return mul(a, b);
        case 'divide':
          return div(a, b);
        case 'pow':
          return pow(a, b);
        default:
          throw new Error(`Unsupported operator: ${op.fn}`);
      }
    }

    case 'FunctionNode': {
      const fn = node as unknown as { name: string; args: MathNode[] };
      const impl = UNARY_FNS[fn.name];
      if (!impl) throw new Error(`Unsupported function: ${fn.name}`);
      if (fn.args.length !== 1) {
        throw new Error(`Function ${fn.name} expects 1 argument, got ${fn.args.length}`);
      }
      return impl(evalDual(fn.args[0], env));
    }

    default:
      throw new Error(`Unsupported node type: ${node.type}`);
  }
}
```

Implementer note: the `as unknown as {...}` casts are because mathjs's TS types model the node union loosely; we narrow by the runtime `node.type` discriminant (verified to match these property shapes against mathjs 15.2.0).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- evalDual`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/autodiff/evalDual.ts src/engine/autodiff/evalDual.test.ts
git commit -m "feat(engine): dual-number AST evaluator over math.js nodes"
```

---

## Task 6: Compile — parse-once → reusable {f, grad}

**Files:**
- Create: `src/engine/autodiff/compile.ts`
- Create: `src/engine/autodiff/index.ts`
- Test: `src/engine/autodiff/compile.test.ts`

PRD §4.4: parse-and-compile **once** on submit; never touch the parser inside the descent loop. `compileGradient(expr)` parses once and returns closures: `f(x,y) → number` and `grad(x,y) → Vec2`, each just walking the cached AST with duals.

- [ ] **Step 1: Write the failing test**

`src/engine/autodiff/compile.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- compile`
Expected: FAIL — `Cannot find module './compile'`.

- [ ] **Step 3: Implement `src/engine/autodiff/compile.ts`**

```ts
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
```

- [ ] **Step 4: Create the barrel `src/engine/autodiff/index.ts`**

```ts
export * from './dual';
export * from './evalDual';
export * from './compile';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- compile`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/autodiff/compile.ts src/engine/autodiff/index.ts src/engine/autodiff/compile.test.ts
git commit -m "feat(engine): compileGradient — parse-once autodiff compiler (f + exact grad)"
```

---

## Task 7: Engine types — the shared interfaces

**Files:**
- Create: `src/engine/types.ts`

Defines every type the registry, optimizers, and stepper share. No tests (pure type declarations); it's exercised by every later task.

- [ ] **Step 1: Create `src/engine/types.ts`**

```ts
/** A point or vector in the 2-parameter (x, y) space. */
export type Vec2 = readonly [number, number];

/** Gradient of the cost at an arbitrary point — passed to optimizers so that
 *  Nesterov can evaluate at a look-ahead point and others at the current one. */
export type GradFn = (theta: Vec2) => Vec2;

/** Cost value at an arbitrary point (needed by Nesterov bookkeeping & UI). */
export type CostFn = (theta: Vec2) => number;

/** Hessian at a point as a 2×2 matrix [[fxx, fxy], [fyx, fyy]] — Newton only. */
export type Hessian = readonly [readonly [number, number], readonly [number, number]];
export type HessFn = (theta: Vec2) => Hessian;

/** A curated or user-supplied cost function. */
export interface CostFunction {
  readonly id: string;
  readonly name: string;
  /** LaTeX-free human formula, e.g. "x^2 + y^2" (KaTeX rendering is M3). */
  readonly expr: string;
  readonly cost: CostFn;
  readonly grad: GradFn;
  /** Known global minimum/minima (for tests, beacons, "converged" checks). */
  readonly minima: readonly Vec2[];
  /** Suggested domain for surface sampling [xMin, xMax, yMin, yMax]. */
  readonly domain: readonly [number, number, number, number];
  /** One-line teaching role from PRD §4.3. */
  readonly teaches: string;
  /** True if the analytic gradient has a singular point (e.g. Ackley origin). */
  readonly hasSingularity?: boolean;
}

export type OptimizerId =
  | 'sgd'
  | 'momentum'
  | 'nesterov'
  | 'adagrad'
  | 'rmsprop'
  | 'adam'
  | 'adamw'
  | 'nadam'
  | 'newton';

/** Per-optimizer mutable state (velocity, moment buffers, accumulators, t). */
export interface OptimizerState {
  iteration: number;
  // Slots used by subsets of optimizers; undefined until init.
  velocity?: [number, number];      // Momentum, Nesterov
  G?: [number, number];             // AdaGrad (sum of squared grads)
  E?: [number, number];             // RMSProp (decayed avg of squared grads)
  m?: [number, number];             // Adam/AdamW/Nadam (1st moment)
  v?: [number, number];             // Adam/AdamW/Nadam (2nd moment)
}

/** Result of one optimizer step: new point, advanced state, and optional
 *  internal-state values for the M2 visualization (velocity arrow, per-axis
 *  adaptive scaling, bias-corrected moments). */
export interface StepResult {
  theta: Vec2;
  state: OptimizerState;
  aux?: Record<string, Vec2 | number>;
}

/** Uniform optimizer interface. Every optimizer takes a GradFn (not a
 *  precomputed gradient) so Nesterov's look-ahead and Newton's needs fit the
 *  same signature; first-order methods simply call grad(theta) once. */
export interface Optimizer {
  readonly id: OptimizerId;
  readonly name: string;
  /** Fresh zeroed state for a run starting at theta0. */
  init(theta0: Vec2): OptimizerState;
  /** Advance one step. Pure w.r.t. inputs: returns new theta + new state. */
  step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult;
}

/** Optional capabilities an optimizer may need beyond a GradFn. */
export interface OptimizerContext {
  /** Hessian provider — required only by Newton. */
  hess?: HessFn;
}
```

Implementer note: Newton needs a Hessian. To keep the `step` signature uniform across all 9, Newton's factory **closes over** a `HessFn` at construction time (see Task 14) rather than adding a parameter to `step`. The `OptimizerContext` type documents that intent for later milestones.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(engine): shared engine types (Vec2, CostFunction, Optimizer, StepResult)"
```

---

## Task 8: Cost-function registry — the 9 curated landscapes

**Files:**
- Create: `src/engine/functions/registry.ts`
- Create: `src/engine/functions/index.ts`
- Test: `src/engine/functions/registry.test.ts`

Each of the 9 PRD §4.3 functions is registered with its `expr` (so `compileGradient` provides cost+grad — no hand-written gradients to get wrong), its known minima, domain, and teaching role. **Exception: Ackley** uses a hand-written guarded gradient because its autodiff gradient is `NaN` at the origin (0/0 cusp); the guard returns `[0,0]` there.

All test values below are execution-verified.

- [ ] **Step 1: Write the failing test**

`src/engine/functions/registry.test.ts`:

```ts
import { FUNCTIONS, getFunction } from './registry';

describe('cost-function registry', () => {
  it('registers all 9 curated functions', () => {
    expect(FUNCTIONS.map((f) => f.id).sort()).toEqual(
      ['ackley', 'beale', 'booth', 'himmelblau', 'matyas', 'rastrigin', 'rosenbrock', 'saddle', 'sphere'],
    );
  });

  it('getFunction looks up by id and throws on unknown', () => {
    expect(getFunction('rosenbrock').name).toBe('Rosenbrock');
    expect(() => getFunction('nope')).toThrow();
  });

  // --- Values at minima (execution-verified) ---
  it('Sphere: f=0 and grad=[0,0] at (0,0)', () => {
    const f = getFunction('sphere');
    expect(f.cost([0, 0])).toBe(0);
    expect(f.grad([0, 0])).toEqual([0, 0]);
  });

  it('Booth: f=0 at (1,3); f=74, grad=[-34,-38] at (0,0)', () => {
    const f = getFunction('booth');
    expect(f.cost([1, 3])).toBeCloseTo(0, 10);
    expect(f.cost([0, 0])).toBeCloseTo(74, 10);
    const [gx, gy] = f.grad([0, 0]);
    expect(gx).toBeCloseTo(-34, 10);
    expect(gy).toBeCloseTo(-38, 10);
  });

  it('Rosenbrock ANCHOR: grad=[0,0] at (1,1); grad=[-215.6,-88] at (-1.2,1)', () => {
    const f = getFunction('rosenbrock');
    const [gx, gy] = f.grad([1, 1]);
    expect(gx).toBeCloseTo(0, 8);
    expect(gy).toBeCloseTo(0, 8);
    const [hx, hy] = f.grad([-1.2, 1]);
    expect(hx).toBeCloseTo(-215.6, 6);
    expect(hy).toBeCloseTo(-88, 6);
  });

  it('Beale: f=0 at (3,0.5); grad=[0,27.75] at (1,1)', () => {
    const f = getFunction('beale');
    expect(f.cost([3, 0.5])).toBeCloseTo(0, 8);
    const [gx, gy] = f.grad([1, 1]);
    expect(gx).toBeCloseTo(0, 8);
    expect(gy).toBeCloseTo(27.75, 8);
  });

  it('Himmelblau: f=0 at all four minima', () => {
    const f = getFunction('himmelblau');
    for (const m of [[3, 2], [-2.805118, 3.131312], [-3.779310, -3.283186], [3.584428, -1.848127]] as const) {
      expect(f.cost(m)).toBeLessThan(1e-3);
    }
  });

  it('Matyas: grad=[1.52,-1.48] at (2,-1)', () => {
    const [gx, gy] = getFunction('matyas').grad([2, -1]);
    expect(gx).toBeCloseTo(1.52, 10);
    expect(gy).toBeCloseTo(-1.48, 10);
  });

  it('Saddle: grad=[0,0] at (0,0) but it is a saddle, not a min', () => {
    const f = getFunction('saddle');
    expect(f.grad([0, 0])).toEqual([0, 0]);
    expect(f.cost([0, 1])).toBeLessThan(f.cost([0, 0])); // descends in y
  });

  it('Rastrigin: f=0 at (0,0); grad≈[60.357,-37.732] at (0.3,-0.4)', () => {
    const f = getFunction('rastrigin');
    expect(f.cost([0, 0])).toBeCloseTo(0, 10);
    const [gx, gy] = f.grad([0.3, -0.4]);
    expect(gx).toBeCloseTo(60.35664329483112, 6);
    expect(gy).toBeCloseTo(-37.73163660980914, 6);
  });

  it('Ackley: f≈0 at origin; gradient GUARDED to [0,0] there (cusp), not NaN', () => {
    const f = getFunction('ackley');
    expect(f.cost([0, 0])).toBeCloseTo(0, 10);
    const [gx, gy] = f.grad([0, 0]);
    expect(Number.isFinite(gx)).toBe(true);
    expect(Number.isFinite(gy)).toBe(true);
    expect(gx).toBe(0);
    expect(gy).toBe(0);
  });

  it('Ackley: gradient is correct at a non-singular point (0.5,0.5)≈1.80967', () => {
    const [gx, gy] = getFunction('ackley').grad([0.5, 0.5]);
    expect(gx).toBeCloseTo(1.8096748360719193, 6);
    expect(gy).toBeCloseTo(1.8096748360719193, 6);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- functions/registry`
Expected: FAIL — `Cannot find module './registry'`.

- [ ] **Step 3: Implement `src/engine/functions/registry.ts`**

Eight functions get cost+grad from `compileGradient`. Ackley is special-cased with a guarded analytic gradient (the autodiff gradient is `NaN` at the origin because of the `sqrt(0.5(x²+y²))` cusp).

```ts
import type { CostFunction, Vec2 } from '../types';
import { compileGradient } from '../autodiff';

/** Build a CostFunction whose cost+grad come from autodiff over `expr`. */
function fromExpr(
  meta: Omit<CostFunction, 'cost' | 'grad'>,
): CostFunction {
  const { f, grad } = compileGradient(meta.expr);
  return {
    ...meta,
    cost: (theta: Vec2) => f(theta[0], theta[1]),
    grad: (theta: Vec2) => grad(theta[0], theta[1]),
  };
}

// --- Ackley: hand-guarded gradient (autodiff yields NaN at the 0/0 cusp). ---
const ackleyExpr =
  '-20*exp(-0.2*sqrt(0.5*(x^2+y^2))) - exp(0.5*(cos(2*pi*x)+cos(2*pi*y))) + e + 20';

function ackleyCost(theta: Vec2): number {
  const [x, y] = theta;
  return (
    -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y))) -
    Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y))) +
    Math.E +
    20
  );
}

function ackleyGrad(theta: Vec2): Vec2 {
  const [x, y] = theta;
  const r = Math.sqrt(0.5 * (x * x + y * y));
  const cosTerm = Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)));
  // At r=0 the sqrt term's derivative (0.5*x/r) is 0/0; the function has a cusp.
  // Guard: return a finite [0,0] (the cosine term's derivative is also 0 there
  // since sin(0)=0), so the descent loop never sees NaN (PRD §4.4 robustness).
  if (r === 0) return [0, 0];
  const gx = 4 * Math.exp(-0.2 * r) * (0.5 * x / r) + cosTerm * Math.PI * Math.sin(2 * Math.PI * x);
  const gy = 4 * Math.exp(-0.2 * r) * (0.5 * y / r) + cosTerm * Math.PI * Math.sin(2 * Math.PI * y);
  return [gx, gy];
}

export const FUNCTIONS: readonly CostFunction[] = [
  fromExpr({
    id: 'sphere',
    name: 'Sphere',
    expr: 'x^2 + y^2',
    minima: [[0, 0]],
    domain: [-5, 5, -5, 5],
    teaches: 'convex baseline',
  }),
  fromExpr({
    id: 'matyas',
    name: 'Matyas',
    expr: '0.26*(x^2 + y^2) - 0.48*x*y',
    minima: [[0, 0]],
    domain: [-10, 10, -10, 10],
    teaches: 'mild conditioning',
  }),
  fromExpr({
    id: 'booth',
    name: 'Booth',
    expr: '(x + 2*y - 7)^2 + (2*x + y - 5)^2',
    minima: [[1, 3]],
    domain: [-10, 10, -10, 10],
    teaches: 'clean convex',
  }),
  fromExpr({
    id: 'rosenbrock',
    name: 'Rosenbrock',
    expr: '(1 - x)^2 + 100*(y - x^2)^2',
    minima: [[1, 1]],
    domain: [-2, 2, -1, 3],
    teaches: 'narrow curved valley / zig-zag (headline)',
  }),
  fromExpr({
    id: 'beale',
    name: 'Beale',
    expr: '(1.5 - x + x*y)^2 + (2.25 - x + x*y^2)^2 + (2.625 - x + x*y^3)^2',
    minima: [[3, 0.5]],
    domain: [-4.5, 4.5, -4.5, 4.5],
    teaches: 'sharp ill-conditioning',
  }),
  fromExpr({
    id: 'saddle',
    name: 'Saddle',
    expr: 'x^2 - y^2',
    minima: [[0, 0]], // a saddle, not a minimum — see teaches
    domain: [-3, 3, -3, 3],
    teaches: 'momentum vs Adam behavior at saddles',
  }),
  fromExpr({
    id: 'himmelblau',
    name: 'Himmelblau',
    expr: '(x^2 + y - 11)^2 + (x + y^2 - 7)^2',
    minima: [[3, 2], [-2.805118, 3.131312], [-3.77931, -3.283186], [3.584428, -1.848127]],
    domain: [-5, 5, -5, 5],
    teaches: 'four minima — different starts reach different minima',
  }),
  fromExpr({
    id: 'rastrigin',
    name: 'Rastrigin',
    expr: '20 + x^2 + y^2 - 10*(cos(2*pi*x) + cos(2*pi*y))',
    minima: [[0, 0]],
    domain: [-5.12, 5.12, -5.12, 5.12],
    teaches: 'many local minima / escape story',
  }),
  {
    id: 'ackley',
    name: 'Ackley',
    expr: ackleyExpr,
    cost: ackleyCost,
    grad: ackleyGrad,
    minima: [[0, 0]],
    domain: [-5, 5, -5, 5],
    teaches: 'local minima + flat outer region',
    hasSingularity: true,
  },
];

const BY_ID = new Map(FUNCTIONS.map((f) => [f.id, f]));

export function getFunction(id: string): CostFunction {
  const f = BY_ID.get(id);
  if (!f) throw new Error(`Unknown cost function: ${id}`);
  return f;
}
```

- [ ] **Step 4: Create the barrel `src/engine/functions/index.ts`**

```ts
export * from './registry';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- functions/registry`
Expected: PASS (all 12 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/functions/
git commit -m "feat(engine): 9-function cost registry (autodiff grads; Ackley cusp guarded)"
```

---

## Task 9: Finite-difference validation — the headline correctness gate

**Files:**
- Create: `src/engine/finite-difference.test.ts`

This is PRD §12's success metric: 100% of the autodiff gradients match central differences to ~1e-6. It is a pure test (no new source) that sweeps every registry function at multiple points. This task is intentionally separate so the correctness gate is one obvious file.

- [ ] **Step 1: Write the validation test**

`src/engine/finite-difference.test.ts`:

```ts
import { FUNCTIONS, getFunction } from './functions';
import type { CostFunction, Vec2 } from './types';

/** Central-difference gradient: (f(x+h) - f(x-h)) / 2h per axis. */
function centralDiff(fn: CostFunction, theta: Vec2, h = 1e-5): Vec2 {
  const [x, y] = theta;
  const dx = (fn.cost([x + h, y]) - fn.cost([x - h, y])) / (2 * h);
  const dy = (fn.cost([x, y + h]) - fn.cost([x, y - h])) / (2 * h);
  return [dx, dy];
}

/** Pass if absolute OR relative error is within tol (handles big gradients
 *  like Rosenbrock/Beale where absolute error scales with magnitude). */
function agrees(a: number, b: number, tol = 1e-6): boolean {
  const abs = Math.abs(a - b);
  if (abs <= tol) return true;
  const rel = abs / Math.max(Math.abs(a), Math.abs(b), 1e-12);
  return rel <= 1e-6;
}

// A spread of non-singular test points per function (avoid exact minima where
// the gradient is ~0 and finite-diff floating error dominates, and avoid the
// Ackley origin cusp).
const TEST_POINTS: Record<string, Vec2[]> = {
  sphere: [[1.5, -2], [3, 4], [-1, 0.5]],
  matyas: [[2, -1], [1, 3], [-2, -2]],
  booth: [[0, 0], [2, 1], [-3, 4]],
  rosenbrock: [[-1.2, 1], [0.5, 0.5], [2, 2], [-1, -1]],
  beale: [[1, 1], [-2, 0.5], [0, 0], [2, 0.3]],
  saddle: [[2, 3], [-1, 1], [0.5, -0.5]],
  himmelblau: [[0, 0], [1, 1], [-2, 2], [4, -2]],
  rastrigin: [[0.3, -0.4], [1.5, 2.5], [-0.7, 0.2]],
  ackley: [[0.5, 0.5], [1, -1], [2, 3], [-1.5, 0.8]], // origin excluded (cusp)
};

describe('gradient validation — autodiff vs central differences (~1e-6)', () => {
  for (const fn of FUNCTIONS) {
    const points = TEST_POINTS[fn.id];
    it(`${fn.name}: analytic gradient matches finite differences at all test points`, () => {
      for (const p of points) {
        const [ax, ay] = fn.grad(p);
        const [nx, ny] = centralDiff(fn, p);
        expect(agrees(ax, nx), `${fn.name} ∂x at (${p}): analytic ${ax} vs fd ${nx}`).toBe(true);
        expect(agrees(ay, ny), `${fn.name} ∂y at (${p}): analytic ${ay} vs fd ${ny}`).toBe(true);
      }
    });
  }

  it('Rosenbrock gradient is exactly [0,0] at the minimum (1,1) — PRD anchor', () => {
    const [gx, gy] = getFunction('rosenbrock').grad([1, 1]);
    expect(gx).toBeCloseTo(0, 8);
    expect(gy).toBeCloseTo(0, 8);
  });

  it('Ackley gradient is finite (guarded) at the origin cusp', () => {
    const [gx, gy] = getFunction('ackley').grad([0, 0]);
    expect(Number.isFinite(gx) && Number.isFinite(gy)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npm test -- finite-difference`
Expected: PASS — 9 per-function tests + 2 anchor tests, all green.

- [ ] **Step 3: Commit**

```bash
git add src/engine/finite-difference.test.ts
git commit -m "test(engine): gradient-vs-finite-difference validation gate (PRD §12 correctness)"
```

---

## Task 10: SGD + the optimizer test helper

**Files:**
- Create: `src/engine/optimizers/sgd.ts`
- Test: `src/engine/optimizers/sgd.test.ts`

Every optimizer test runs from `theta0 = [1,1]` on `f = x²+y²` (so `grad = [2x,2y]`), recomputing the gradient at the current point before each step. The expected post-step values below are all execution-verified.

- [ ] **Step 1: Write the failing test**

`src/engine/optimizers/sgd.test.ts`:

```ts
import { makeSGD } from './sgd';
import type { GradFn, Vec2 } from '../types';

// Test landscape: f = x^2 + y^2 → grad = [2x, 2y].
const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('SGD', () => {
  it('θ -= η·g with η=0.1: from (1,1) → (0.8,0.8) then (0.64,0.64)', () => {
    const opt = makeSGD({ lr: 0.1 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];

    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.8, 12);
    expect(theta[1]).toBeCloseTo(0.8, 12);

    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.64, 12);
    expect(theta[1]).toBeCloseTo(0.64, 12);
  });

  it('iteration counter advances', () => {
    const opt = makeSGD({ lr: 0.1 });
    let state = opt.init([1, 1]);
    expect(state.iteration).toBe(0);
    ({ state } = opt.step([1, 1], grad, state));
    expect(state.iteration).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- optimizers/sgd`
Expected: FAIL — `Cannot find module './sgd'`.

- [ ] **Step 3: Implement `src/engine/optimizers/sgd.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface SGDHyperparams {
  lr: number;
}

export const SGD_DEFAULTS: SGDHyperparams = { lr: 0.1 };

/** Stochastic gradient descent: θ = θ − η·g. Stateless beyond the iteration count. */
export function makeSGD(hp: SGDHyperparams = SGD_DEFAULTS): Optimizer {
  return {
    id: 'sgd',
    name: 'SGD',
    init: (): OptimizerState => ({ iteration: 0 }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const next: Vec2 = [theta[0] - hp.lr * g[0], theta[1] - hp.lr * g[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1 },
        aux: { gradient: g },
      };
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- optimizers/sgd`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/optimizers/sgd.ts src/engine/optimizers/sgd.test.ts
git commit -m "feat(engine): SGD optimizer"
```

---

## Task 11: Momentum + Nesterov

**Files:**
- Create: `src/engine/optimizers/momentum.ts`, `src/engine/optimizers/nesterov.ts`
- Test: `src/engine/optimizers/momentum.test.ts`, `src/engine/optimizers/nesterov.test.ts`

Nesterov needs the gradient at the look-ahead point `θ − γv`, which is exactly why the interface passes a `GradFn` rather than a precomputed gradient.

- [ ] **Step 1: Write the failing tests**

`src/engine/optimizers/momentum.test.ts`:

```ts
import { makeMomentum } from './momentum';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('Momentum', () => {
  it('v=γv+ηg; θ-=v (γ=0.9,η=0.1): (1,1)→(0.8,0.8)→(0.46,0.46)', () => {
    const opt = makeMomentum({ lr: 0.1, gamma: 0.9 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.8, 12);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.46, 12);
    expect(theta[1]).toBeCloseTo(0.46, 12);
  });
});
```

`src/engine/optimizers/nesterov.test.ts`:

```ts
import { makeNesterov } from './nesterov';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('Nesterov (NAG)', () => {
  it('look-ahead gradient at θ-γv (γ=0.9,η=0.1): (1,1)→(0.8,0.8)→(0.496,0.496)', () => {
    const opt = makeNesterov({ lr: 0.1, gamma: 0.9 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.8, 12); // v0=0 → first step equals SGD
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.496, 12);
    expect(theta[1]).toBeCloseTo(0.496, 12);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- optimizers/momentum optimizers/nesterov`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/engine/optimizers/momentum.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface MomentumHyperparams {
  lr: number;
  gamma: number;
}

export const MOMENTUM_DEFAULTS: MomentumHyperparams = { lr: 0.1, gamma: 0.9 };

/** Classical momentum: v = γv + ηg; θ = θ − v. */
export function makeMomentum(hp: MomentumHyperparams = MOMENTUM_DEFAULTS): Optimizer {
  return {
    id: 'momentum',
    name: 'Momentum',
    init: (): OptimizerState => ({ iteration: 0, velocity: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const v0 = state.velocity ?? [0, 0];
      const v: [number, number] = [
        hp.gamma * v0[0] + hp.lr * g[0],
        hp.gamma * v0[1] + hp.lr * g[1],
      ];
      const next: Vec2 = [theta[0] - v[0], theta[1] - v[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, velocity: v },
        aux: { velocity: v, gradient: g },
      };
    },
  };
}
```

- [ ] **Step 4: Implement `src/engine/optimizers/nesterov.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface NesterovHyperparams {
  lr: number;
  gamma: number;
}

export const NESTEROV_DEFAULTS: NesterovHyperparams = { lr: 0.1, gamma: 0.9 };

/**
 * Nesterov accelerated gradient: evaluate the gradient at the look-ahead point
 * θ − γv (the "prescient" step), then v = γv + η·∇f(θ−γv); θ = θ − v.
 * This is the canonical look-ahead form (Ruder), enabled by taking a GradFn.
 */
export function makeNesterov(hp: NesterovHyperparams = NESTEROV_DEFAULTS): Optimizer {
  return {
    id: 'nesterov',
    name: 'Nesterov',
    init: (): OptimizerState => ({ iteration: 0, velocity: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const v0 = state.velocity ?? [0, 0];
      const lookahead: Vec2 = [theta[0] - hp.gamma * v0[0], theta[1] - hp.gamma * v0[1]];
      const g = grad(lookahead);
      const v: [number, number] = [
        hp.gamma * v0[0] + hp.lr * g[0],
        hp.gamma * v0[1] + hp.lr * g[1],
      ];
      const next: Vec2 = [theta[0] - v[0], theta[1] - v[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, velocity: v },
        aux: { velocity: v, lookahead, gradient: g },
      };
    },
  };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npm test -- optimizers/momentum optimizers/nesterov`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/optimizers/momentum.ts src/engine/optimizers/momentum.test.ts src/engine/optimizers/nesterov.ts src/engine/optimizers/nesterov.test.ts
git commit -m "feat(engine): Momentum + Nesterov (look-ahead gradient via GradFn)"
```

---

## Task 12: AdaGrad + RMSProp

**Files:**
- Create: `src/engine/optimizers/adagrad.ts`, `src/engine/optimizers/rmsprop.ts`
- Test: `src/engine/optimizers/adagrad.test.ts`, `src/engine/optimizers/rmsprop.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/engine/optimizers/adagrad.test.ts`:

```ts
import { makeAdaGrad } from './adagrad';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('AdaGrad', () => {
  it('G+=g²; θ-=η/√(G+ε)·g (η=0.01): (1,1)→≈0.99→≈0.98296', () => {
    const opt = makeAdaGrad({ lr: 0.01, eps: 1e-8 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9900000000125, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9829645540376954, 9);
  });
});
```

`src/engine/optimizers/rmsprop.test.ts`:

```ts
import { makeRMSProp } from './rmsprop';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('RMSProp', () => {
  it('E=0.9E+0.1g²; θ-=η/√(E+ε)·g (η=0.001): (1,1)→≈0.996838→≈0.994547', () => {
    const opt = makeRMSProp({ lr: 0.001, eps: 1e-8, decay: 0.9 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9968377223793601, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9945470101162064, 9);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- optimizers/adagrad optimizers/rmsprop`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/engine/optimizers/adagrad.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface AdaGradHyperparams {
  lr: number;
  eps: number;
}

export const ADAGRAD_DEFAULTS: AdaGradHyperparams = { lr: 0.01, eps: 1e-8 };

/** AdaGrad: G += g²; θ = θ − η/√(G+ε)·g. G grows monotonically (stalls late). */
export function makeAdaGrad(hp: AdaGradHyperparams = ADAGRAD_DEFAULTS): Optimizer {
  return {
    id: 'adagrad',
    name: 'AdaGrad',
    init: (): OptimizerState => ({ iteration: 0, G: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const G0 = state.G ?? [0, 0];
      const G: [number, number] = [G0[0] + g[0] * g[0], G0[1] + g[1] * g[1]];
      const scale: [number, number] = [
        hp.lr / Math.sqrt(G[0] + hp.eps),
        hp.lr / Math.sqrt(G[1] + hp.eps),
      ];
      const next: Vec2 = [theta[0] - scale[0] * g[0], theta[1] - scale[1] * g[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, G },
        aux: { accumulator: G, scaling: scale, gradient: g },
      };
    },
  };
}
```

- [ ] **Step 4: Implement `src/engine/optimizers/rmsprop.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface RMSPropHyperparams {
  lr: number;
  eps: number;
  decay: number;
}

export const RMSPROP_DEFAULTS: RMSPropHyperparams = { lr: 0.001, eps: 1e-8, decay: 0.9 };

/** RMSProp: E = ρE + (1−ρ)g²; θ = θ − η/√(E+ε)·g (ρ=0.9 → 0.9E + 0.1g²). */
export function makeRMSProp(hp: RMSPropHyperparams = RMSPROP_DEFAULTS): Optimizer {
  return {
    id: 'rmsprop',
    name: 'RMSProp',
    init: (): OptimizerState => ({ iteration: 0, E: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const E0 = state.E ?? [0, 0];
      const E: [number, number] = [
        hp.decay * E0[0] + (1 - hp.decay) * g[0] * g[0],
        hp.decay * E0[1] + (1 - hp.decay) * g[1] * g[1],
      ];
      const scale: [number, number] = [
        hp.lr / Math.sqrt(E[0] + hp.eps),
        hp.lr / Math.sqrt(E[1] + hp.eps),
      ];
      const next: Vec2 = [theta[0] - scale[0] * g[0], theta[1] - scale[1] * g[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, E },
        aux: { accumulator: E, scaling: scale, gradient: g },
      };
    },
  };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npm test -- optimizers/adagrad optimizers/rmsprop`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/optimizers/adagrad.ts src/engine/optimizers/adagrad.test.ts src/engine/optimizers/rmsprop.ts src/engine/optimizers/rmsprop.test.ts
git commit -m "feat(engine): AdaGrad + RMSProp (per-axis adaptive scaling)"
```

---

## Task 13: Adam + AdamW + Nadam (the Adam family)

**Files:**
- Create: `src/engine/optimizers/adam.ts`, `src/engine/optimizers/adamw.ts`, `src/engine/optimizers/nadam.ts`
- Test: `src/engine/optimizers/adam.test.ts`, `src/engine/optimizers/adamw.test.ts`, `src/engine/optimizers/nadam.test.ts`

All three share `m`, `v`, and a per-step `t` for bias correction. `eps` is placed **outside** the sqrt (`√v̂ + ε`), matching Ruder/Keras and the PRD. AdamW applies decoupled, lr-scaled decay **first** (`θ −= η·λ·θ`), verified to match PyTorch exactly. Nadam uses the constant-β₁ closed form (Ruder), `η=0.002`. All expected values execution-verified.

- [ ] **Step 1: Write the failing tests**

`src/engine/optimizers/adam.test.ts`:

```ts
import { makeAdam } from './adam';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('Adam', () => {
  it('bias-corrected moments (η=0.001): (1,1)→≈0.999000→≈0.998000', () => {
    const opt = makeAdam({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.999000000005, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9980000262138343, 9);
  });
});
```

`src/engine/optimizers/adamw.test.ts`:

```ts
import { makeAdamW } from './adamw';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('AdamW', () => {
  it('decoupled lr-scaled decay first θ-=η·λ·θ, then Adam (matches PyTorch): (1,1)→≈0.998990→≈0.997980', () => {
    const opt = makeAdamW({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8, weightDecay: 1e-2 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.998990000005, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9979800365772695, 9);
  });
});
```

`src/engine/optimizers/nadam.test.ts`:

```ts
import { makeNadam } from './nadam';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('Nadam (constant-β₁ closed form, after Ruder)', () => {
  it('Nesterov look-ahead numerator (η=0.002): (1,1)→≈0.996200→≈0.993350', () => {
    const opt = makeNadam({ lr: 0.002, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.996200000019, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9933495550544302, 9);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- optimizers/adam optimizers/adamw optimizers/nadam`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/engine/optimizers/adam.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface AdamHyperparams {
  lr: number;
  beta1: number;
  beta2: number;
  eps: number;
}

export const ADAM_DEFAULTS: AdamHyperparams = { lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8 };

/**
 * Adam: m=β₁m+(1−β₁)g; v=β₂v+(1−β₂)g²; bias-correct m̂=m/(1−β₁ᵗ), v̂=v/(1−β₂ᵗ);
 * θ = θ − η·m̂/(√v̂ + ε). eps is OUTSIDE the sqrt (Ruder/Keras convention). t
 * increments per step starting at 1.
 */
export function makeAdam(hp: AdamHyperparams = ADAM_DEFAULTS): Optimizer {
  return {
    id: 'adam',
    name: 'Adam',
    init: (): OptimizerState => ({ iteration: 0, m: [0, 0], v: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const t = state.iteration + 1;
      const m0 = state.m ?? [0, 0];
      const v0 = state.v ?? [0, 0];
      const m: [number, number] = [
        hp.beta1 * m0[0] + (1 - hp.beta1) * g[0],
        hp.beta1 * m0[1] + (1 - hp.beta1) * g[1],
      ];
      const v: [number, number] = [
        hp.beta2 * v0[0] + (1 - hp.beta2) * g[0] * g[0],
        hp.beta2 * v0[1] + (1 - hp.beta2) * g[1] * g[1],
      ];
      const bc1 = 1 - Math.pow(hp.beta1, t);
      const bc2 = 1 - Math.pow(hp.beta2, t);
      const next: Vec2 = [
        theta[0] - (hp.lr * (m[0] / bc1)) / (Math.sqrt(v[0] / bc2) + hp.eps),
        theta[1] - (hp.lr * (m[1] / bc1)) / (Math.sqrt(v[1] / bc2) + hp.eps),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { m, v, gradient: g },
      };
    },
  };
}
```

- [ ] **Step 4: Implement `src/engine/optimizers/adamw.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface AdamWHyperparams {
  lr: number;
  beta1: number;
  beta2: number;
  eps: number;
  weightDecay: number;
}

export const ADAMW_DEFAULTS: AdamWHyperparams = {
  lr: 0.001,
  beta1: 0.9,
  beta2: 0.999,
  eps: 1e-8,
  weightDecay: 1e-2,
};

/**
 * AdamW (Loshchilov & Hutter): decoupled weight decay applied to θ FIRST and
 * scaled by the learning rate — θ = θ − η·λ·θ — then the standard Adam update.
 * The decay is NEVER folded into the gradient g (that would be L2 / Adam+L2,
 * the variant the paper argues against). Matches PyTorch's AdamW exactly.
 */
export function makeAdamW(hp: AdamWHyperparams = ADAMW_DEFAULTS): Optimizer {
  return {
    id: 'adamw',
    name: 'AdamW',
    init: (): OptimizerState => ({ iteration: 0, m: [0, 0], v: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta); // gradient of the loss ONLY
      const t = state.iteration + 1;
      // 1) Decoupled, lr-scaled weight decay applied directly to θ.
      const decayed: Vec2 = [
        theta[0] - hp.lr * hp.weightDecay * theta[0],
        theta[1] - hp.lr * hp.weightDecay * theta[1],
      ];
      // 2) Standard Adam moment update (decay does NOT enter m/v).
      const m0 = state.m ?? [0, 0];
      const v0 = state.v ?? [0, 0];
      const m: [number, number] = [
        hp.beta1 * m0[0] + (1 - hp.beta1) * g[0],
        hp.beta1 * m0[1] + (1 - hp.beta1) * g[1],
      ];
      const v: [number, number] = [
        hp.beta2 * v0[0] + (1 - hp.beta2) * g[0] * g[0],
        hp.beta2 * v0[1] + (1 - hp.beta2) * g[1] * g[1],
      ];
      const bc1 = 1 - Math.pow(hp.beta1, t);
      const bc2 = 1 - Math.pow(hp.beta2, t);
      const next: Vec2 = [
        decayed[0] - (hp.lr * (m[0] / bc1)) / (Math.sqrt(v[0] / bc2) + hp.eps),
        decayed[1] - (hp.lr * (m[1] / bc1)) / (Math.sqrt(v[1] / bc2) + hp.eps),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { m, v, gradient: g },
      };
    },
  };
}
```

- [ ] **Step 5: Implement `src/engine/optimizers/nadam.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface NadamHyperparams {
  lr: number;
  beta1: number;
  beta2: number;
  eps: number;
}

// η=0.002 is the legacy-Keras Nadam default; modern Keras uses 0.001. We keep
// 0.002 paired with the constant-β₁ closed form for teaching (see plan notes).
export const NADAM_DEFAULTS: NadamHyperparams = { lr: 0.002, beta1: 0.9, beta2: 0.999, eps: 1e-8 };

/**
 * Nadam — Nesterov-accelerated Adam, constant-β₁ closed form (Ruder 2016):
 * m, v as in Adam; m̂=m/(1−β₁ᵗ), v̂=v/(1−β₂ᵗ);
 * θ = θ − (η/(√v̂ + ε))·(β₁·m̂ + (1−β₁)·g/(1−β₁ᵗ)).
 * The look-ahead lives in the numerator's blend of m̂ and the current g.
 * (Production Keras uses a momentum schedule; we use the cleaner closed form.)
 */
export function makeNadam(hp: NadamHyperparams = NADAM_DEFAULTS): Optimizer {
  return {
    id: 'nadam',
    name: 'Nadam',
    init: (): OptimizerState => ({ iteration: 0, m: [0, 0], v: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const t = state.iteration + 1;
      const m0 = state.m ?? [0, 0];
      const v0 = state.v ?? [0, 0];
      const m: [number, number] = [
        hp.beta1 * m0[0] + (1 - hp.beta1) * g[0],
        hp.beta1 * m0[1] + (1 - hp.beta1) * g[1],
      ];
      const v: [number, number] = [
        hp.beta2 * v0[0] + (1 - hp.beta2) * g[0] * g[0],
        hp.beta2 * v0[1] + (1 - hp.beta2) * g[1] * g[1],
      ];
      const bc1 = 1 - Math.pow(hp.beta1, t);
      const bc2 = 1 - Math.pow(hp.beta2, t);
      const numer = (i: number): number =>
        hp.beta1 * (m[i] / bc1) + ((1 - hp.beta1) * g[i]) / bc1;
      const next: Vec2 = [
        theta[0] - (hp.lr / (Math.sqrt(v[0] / bc2) + hp.eps)) * numer(0),
        theta[1] - (hp.lr / (Math.sqrt(v[1] / bc2) + hp.eps)) * numer(1),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { m, v, gradient: g },
      };
    },
  };
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npm test -- optimizers/adam optimizers/adamw optimizers/nadam`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/optimizers/adam.ts src/engine/optimizers/adam.test.ts src/engine/optimizers/adamw.ts src/engine/optimizers/adamw.test.ts src/engine/optimizers/nadam.ts src/engine/optimizers/nadam.test.ts
git commit -m "feat(engine): Adam family — Adam, AdamW (PyTorch-exact decay), Nadam (Ruder closed form)"
```

---

## Task 14: Newton (2nd order) with Levenberg–Marquardt damping

**Files:**
- Create: `src/engine/optimizers/newton.ts`
- Test: `src/engine/optimizers/newton.test.ts`

Newton needs the Hessian. To keep the `step(theta, grad, state)` signature uniform, the factory **closes over a `HessFn`** supplied at construction. On `f = x²+y²` (constant Hessian `[[2,0],[0,2]]`) with damping `μ=1e-6`, one step from (1,1) reaches ~`5e-7` (verified). The 2×2 inverse uses the closed-form `(1/det)[[d,−b],[−c,a]]`.

- [ ] **Step 1: Write the failing test**

`src/engine/optimizers/newton.test.ts`:

```ts
import { makeNewton } from './newton';
import type { GradFn, HessFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];
const hess: HessFn = () => [[2, 0], [0, 2]]; // constant Hessian of x^2+y^2

describe('Newton (2nd-order, LM-damped)', () => {
  it('reaches the minimum in ~1 step on a quadratic (μ=1e-6): (1,1)→≈5e-7', () => {
    const opt = makeNewton({ mu: 1e-6 }, hess);
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(4.999997500476638e-7, 12);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(2.4999975007924193e-13, 18);
  });

  it('solves the 2×2 system with off-diagonal Hessian terms', () => {
    // H=[[4,1],[1,3]], g=[1,2], μ=0: solve (H)·d = g, θ' = θ - d.
    const H: HessFn = () => [[4, 1], [1, 3]];
    const g: GradFn = () => [1, 2];
    const opt = makeNewton({ mu: 0 }, H);
    const { theta } = opt.step([0, 0], g, opt.init([0, 0]));
    // det=11; d = (1/11)[[3,-1],[-1,4]]·[1,2] = (1/11)[1, 7] = [0.0909..,0.6363..]
    expect(theta[0]).toBeCloseTo(-1 / 11, 10);
    expect(theta[1]).toBeCloseTo(-7 / 11, 10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- optimizers/newton`
Expected: FAIL — `Cannot find module './newton'`.

- [ ] **Step 3: Implement `src/engine/optimizers/newton.ts`**

```ts
import type { GradFn, HessFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface NewtonHyperparams {
  /** Levenberg–Marquardt damping added to the Hessian diagonal (H + μI). */
  mu: number;
}

export const NEWTON_DEFAULTS: NewtonHyperparams = { mu: 1e-6 };

/**
 * Newton's method: θ = θ − (H + μI)⁻¹ g, with a closed-form 2×2 inverse and
 * Levenberg–Marquardt damping μ to survive indefinite/singular Hessians.
 * The Hessian provider is closed over at construction so step() keeps the
 * uniform (theta, grad, state) signature. Newton legitimately diverges and
 * seeks saddles on non-convex landscapes — surfaced as a teaching point (M2).
 */
export function makeNewton(hp: NewtonHyperparams = NEWTON_DEFAULTS, hess?: HessFn): Optimizer {
  if (!hess) throw new Error('Newton requires a Hessian function (HessFn)');
  return {
    id: 'newton',
    name: 'Newton',
    init: (): OptimizerState => ({ iteration: 0 }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const H = hess(theta);
      // Damped Hessian (H + μI).
      const a = H[0][0] + hp.mu;
      const b = H[0][1];
      const c = H[1][0];
      const d = H[1][1] + hp.mu;
      const det = a * d - b * c;
      // Closed-form 2×2 inverse times g → Newton direction.
      // d_vec = (1/det) [[d,-b],[-c,a]] · g
      const dx = (d * g[0] - b * g[1]) / det;
      const dy = (-c * g[0] + a * g[1]) / det;
      const next: Vec2 = [theta[0] - dx, theta[1] - dy];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1 },
        aux: { gradient: g, det },
      };
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- optimizers/newton`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/optimizers/newton.ts src/engine/optimizers/newton.test.ts
git commit -m "feat(engine): Newton optimizer (2x2 closed-form inverse, LM damping)"
```

---

## Task 15: Optimizer registry — id → factory + defaults

**Files:**
- Create: `src/engine/optimizers/registry.ts`
- Create: `src/engine/optimizers/index.ts`
- Test: `src/engine/optimizers/registry.test.ts`

A single place to list all 9, their display names, and default hyperparameters — so Racing mode (M2) can spin up N independent optimizers from one call. Newton is handled specially (needs a Hessian), so the registry exposes a `numericHessian` helper to build a `HessFn` from a `GradFn` via central differences.

- [ ] **Step 1: Write the failing test**

`src/engine/optimizers/registry.test.ts`:

```ts
import { OPTIMIZER_IDS, makeOptimizer, OPTIMIZER_DEFAULTS, numericHessian } from './registry';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('optimizer registry', () => {
  it('lists all 9 optimizer ids', () => {
    expect([...OPTIMIZER_IDS].sort()).toEqual(
      ['adagrad', 'adam', 'adamw', 'momentum', 'nadam', 'nesterov', 'newton', 'rmsprop', 'sgd'],
    );
  });

  it('makeOptimizer builds each by id with defaults', () => {
    for (const id of OPTIMIZER_IDS) {
      const opt = makeOptimizer(id);
      expect(opt.id).toBe(id);
      const state = opt.init([1, 1]);
      const { theta } = opt.step([1, 1], grad, state);
      expect(theta.every(Number.isFinite)).toBe(true);
    }
  });

  it('SGD via registry steps (1,1)→(0.8,0.8)', () => {
    const opt = makeOptimizer('sgd');
    const { theta } = opt.step([1, 1], grad, opt.init([1, 1]));
    expect(theta[0]).toBeCloseTo(0.8, 12);
  });

  it('numericHessian approximates the Hessian of x^2+y^2 as [[2,0],[0,2]]', () => {
    const H = numericHessian(grad)([1, 1]);
    expect(H[0][0]).toBeCloseTo(2, 4);
    expect(H[1][1]).toBeCloseTo(2, 4);
    expect(H[0][1]).toBeCloseTo(0, 4);
  });

  it('every default hyperparam set includes the expected learning rate', () => {
    expect(OPTIMIZER_DEFAULTS.sgd.lr).toBe(0.1);
    expect(OPTIMIZER_DEFAULTS.adam.lr).toBe(0.001);
    expect(OPTIMIZER_DEFAULTS.nadam.lr).toBe(0.002);
    expect(OPTIMIZER_DEFAULTS.adamw.weightDecay).toBe(1e-2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- optimizers/registry`
Expected: FAIL — `Cannot find module './registry'`.

- [ ] **Step 3: Implement `src/engine/optimizers/registry.ts`**

```ts
import type { GradFn, HessFn, Optimizer, OptimizerId, Vec2 } from '../types';
import { makeSGD, SGD_DEFAULTS } from './sgd';
import { makeMomentum, MOMENTUM_DEFAULTS } from './momentum';
import { makeNesterov, NESTEROV_DEFAULTS } from './nesterov';
import { makeAdaGrad, ADAGRAD_DEFAULTS } from './adagrad';
import { makeRMSProp, RMSPROP_DEFAULTS } from './rmsprop';
import { makeAdam, ADAM_DEFAULTS } from './adam';
import { makeAdamW, ADAMW_DEFAULTS } from './adamw';
import { makeNadam, NADAM_DEFAULTS } from './nadam';
import { makeNewton, NEWTON_DEFAULTS } from './newton';

export const OPTIMIZER_IDS: readonly OptimizerId[] = [
  'sgd', 'momentum', 'nesterov', 'adagrad', 'rmsprop', 'adam', 'adamw', 'nadam', 'newton',
];

/** Default hyperparameters per optimizer (single source of truth for the UI). */
export const OPTIMIZER_DEFAULTS = {
  sgd: SGD_DEFAULTS,
  momentum: MOMENTUM_DEFAULTS,
  nesterov: NESTEROV_DEFAULTS,
  adagrad: ADAGRAD_DEFAULTS,
  rmsprop: RMSPROP_DEFAULTS,
  adam: ADAM_DEFAULTS,
  adamw: ADAMW_DEFAULTS,
  nadam: NADAM_DEFAULTS,
  newton: NEWTON_DEFAULTS,
} as const;

/**
 * Build a numeric Hessian function from a gradient function via central
 * differences (for Newton when no analytic Hessian is supplied). H_ij = ∂g_i/∂x_j.
 */
export function numericHessian(grad: GradFn, h = 1e-4): HessFn {
  return (theta: Vec2) => {
    const [x, y] = theta;
    const gxp = grad([x + h, y]);
    const gxm = grad([x - h, y]);
    const gyp = grad([x, y + h]);
    const gym = grad([x, y - h]);
    const fxx = (gxp[0] - gxm[0]) / (2 * h);
    const fyx = (gxp[1] - gxm[1]) / (2 * h);
    const fxy = (gyp[0] - gym[0]) / (2 * h);
    const fyy = (gyp[1] - gym[1]) / (2 * h);
    // Symmetrize the off-diagonal to reduce numeric asymmetry.
    const off = (fxy + fyx) / 2;
    return [[fxx, off], [off, fyy]];
  };
}

/**
 * Build an optimizer by id. Newton needs a Hessian; if none is given, a numeric
 * one is derived from `grad` (which must then be supplied). Hyperparameters are
 * the defaults merged with any overrides.
 */
export function makeOptimizer(
  id: OptimizerId,
  overrides: Record<string, number> = {},
  opts: { grad?: GradFn; hess?: HessFn } = {},
): Optimizer {
  switch (id) {
    case 'sgd':
      return makeSGD({ ...SGD_DEFAULTS, ...overrides });
    case 'momentum':
      return makeMomentum({ ...MOMENTUM_DEFAULTS, ...overrides });
    case 'nesterov':
      return makeNesterov({ ...NESTEROV_DEFAULTS, ...overrides });
    case 'adagrad':
      return makeAdaGrad({ ...ADAGRAD_DEFAULTS, ...overrides });
    case 'rmsprop':
      return makeRMSProp({ ...RMSPROP_DEFAULTS, ...overrides });
    case 'adam':
      return makeAdam({ ...ADAM_DEFAULTS, ...overrides });
    case 'adamw':
      return makeAdamW({ ...ADAMW_DEFAULTS, ...overrides });
    case 'nadam':
      return makeNadam({ ...NADAM_DEFAULTS, ...overrides });
    case 'newton': {
      const hess = opts.hess ?? (opts.grad ? numericHessian(opts.grad) : undefined);
      return makeNewton({ ...NEWTON_DEFAULTS, ...overrides }, hess);
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown optimizer id: ${_exhaustive}`);
    }
  }
}
```

Note: the registry test calls `makeOptimizer(id)` for all ids including `'newton'` without a Hessian — but the test's loop only calls `.step()` on each. For Newton to step it needs a Hessian, so the test must pass one. **Correction to Step 1's loop:** the loop builds Newton via `makeOptimizer('newton', {}, { grad })`. Update the loop test accordingly:

```ts
  it('makeOptimizer builds each by id with defaults', () => {
    for (const id of OPTIMIZER_IDS) {
      const opt = id === 'newton' ? makeOptimizer(id, {}, { grad }) : makeOptimizer(id);
      expect(opt.id).toBe(id);
      const state = opt.init([1, 1]);
      const { theta } = opt.step([1, 1], grad, state);
      expect(theta.every(Number.isFinite)).toBe(true);
    }
  });
```

- [ ] **Step 4: Create the barrel `src/engine/optimizers/index.ts`**

```ts
export * from './types';
export * from './sgd';
export * from './momentum';
export * from './nesterov';
export * from './adagrad';
export * from './rmsprop';
export * from './adam';
export * from './adamw';
export * from './nadam';
export * from './newton';
export * from './registry';
```

Note: remove the `export * from './types'` line if it causes a duplicate — types live in `../types`, not here. Use:

```ts
export * from './sgd';
export * from './momentum';
export * from './nesterov';
export * from './adagrad';
export * from './rmsprop';
export * from './adam';
export * from './adamw';
export * from './nadam';
export * from './newton';
export * from './registry';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- optimizers/registry`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/optimizers/registry.ts src/engine/optimizers/index.ts src/engine/optimizers/registry.test.ts
git commit -m "feat(engine): optimizer registry (9 factories, defaults, numeric Hessian for Newton)"
```

---

## Task 16: Fixed-timestep stepper + engine barrel

**Files:**
- Create: `src/engine/stepper.ts`
- Create: `src/engine/index.ts`
- Test: `src/engine/stepper.test.ts`

PRD §8.3: a fixed-timestep accumulator so the simulation is deterministic and refresh-rate independent. The stepper advances whole optimizer steps when accumulated time crosses the fixed `dt`, and exposes an interpolation `alpha` for render smoothing. It also guards non-finite values (PRD §4.4 robustness): if a step produces NaN/Inf, it flags `diverged` and stops.

- [ ] **Step 1: Write the failing test**

`src/engine/stepper.test.ts`:

```ts
import { createStepper } from './stepper';
import { makeSGD } from './optimizers';
import { getFunction } from './functions';
import type { GradFn, Vec2 } from './types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('fixed-timestep stepper', () => {
  it('advances exactly one step when elapsed >= dt', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, theta0: [1, 1], dt: 0.1 });
    s.advance(0.1); // exactly one dt
    expect(s.iteration).toBe(1);
    expect(s.theta[0]).toBeCloseTo(0.8, 12);
  });

  it('advances multiple steps for a large elapsed time (accumulator)', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, theta0: [1, 1], dt: 0.1 });
    s.advance(0.35); // 3 whole steps, 0.05 left over
    expect(s.iteration).toBe(3);
    expect(s.theta[0]).toBeCloseTo(0.512, 10); // 1·0.8^3
  });

  it('does not step until dt is reached; exposes interpolation alpha', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, theta0: [1, 1], dt: 0.1 });
    s.advance(0.05);
    expect(s.iteration).toBe(0);
    expect(s.alpha).toBeCloseTo(0.5, 6); // halfway to the next step
  });

  it('reset returns to the initial point and clears state', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, theta0: [1, 1], dt: 0.1 });
    s.advance(0.3);
    s.reset();
    expect(s.iteration).toBe(0);
    expect(s.theta).toEqual([1, 1]);
  });

  it('flags divergence and stops when a step produces non-finite values', () => {
    // Huge LR on Rosenbrock from a steep point → overflow to Infinity.
    const opt = makeSGD({ lr: 1e6 });
    const ros = getFunction('rosenbrock');
    const s = createStepper({ optimizer: opt, grad: ros.grad, theta0: [-1.5, -1], dt: 0.1 });
    s.advance(1.0); // would be 10 steps, but it diverges first
    expect(s.diverged).toBe(true);
    expect(s.theta.every(Number.isFinite)).toBe(true); // last finite point retained
  });

  it('records history of points for the scrubber (M1)', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, theta0: [1, 1], dt: 0.1 });
    s.advance(0.2);
    expect(s.history.length).toBe(3); // initial + 2 steps
    expect(s.history[0].theta).toEqual([1, 1]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- stepper`
Expected: FAIL — `Cannot find module './stepper'`.

- [ ] **Step 3: Implement `src/engine/stepper.ts`**

```ts
import type { GradFn, Optimizer, OptimizerState, Vec2 } from './types';

export interface StepperConfig {
  optimizer: Optimizer;
  grad: GradFn;
  theta0: Vec2;
  /** Fixed simulation timestep in seconds (one optimizer step per dt). */
  dt: number;
}

/** A single recorded frame of the descent, for the iteration scrubber (M1). */
export interface HistoryEntry {
  iteration: number;
  theta: Vec2;
  cost?: number;
}

export interface Stepper {
  readonly theta: Vec2;
  readonly iteration: number;
  /** Fractional progress toward the next step (0..1) for render interpolation. */
  readonly alpha: number;
  readonly diverged: boolean;
  readonly history: readonly HistoryEntry[];
  /** Advance simulation time by `elapsed` seconds, taking whole steps. */
  advance(elapsed: number): void;
  /** Reset to the initial point and clear state/history. */
  reset(): void;
}

/**
 * Fixed-timestep accumulator (PRD §8.3): accumulates real elapsed time and
 * takes deterministic whole optimizer steps when it crosses dt, so behavior is
 * refresh-rate independent. Guards non-finite values (PRD §4.4): on NaN/Inf it
 * retains the last finite point, flags `diverged`, and stops stepping.
 */
export function createStepper(config: StepperConfig): Stepper {
  const { optimizer, grad, theta0, dt } = config;

  let theta: Vec2 = theta0;
  let state: OptimizerState = optimizer.init(theta0);
  let accumulator = 0;
  let diverged = false;
  let history: HistoryEntry[] = [{ iteration: 0, theta: theta0 }];

  const isFinitePair = (v: Vec2): boolean => Number.isFinite(v[0]) && Number.isFinite(v[1]);

  return {
    get theta() {
      return theta;
    },
    get iteration() {
      return state.iteration;
    },
    get alpha() {
      return Math.min(accumulator / dt, 1);
    },
    get diverged() {
      return diverged;
    },
    get history() {
      return history;
    },
    advance(elapsed: number) {
      if (diverged) return;
      accumulator += elapsed;
      while (accumulator >= dt) {
        accumulator -= dt;
        const result = optimizer.step(theta, grad, state);
        if (!isFinitePair(result.theta)) {
          diverged = true; // keep the last finite theta; stop
          return;
        }
        theta = result.theta;
        state = result.state;
        history.push({ iteration: state.iteration, theta });
      }
    },
    reset() {
      theta = theta0;
      state = optimizer.init(theta0);
      accumulator = 0;
      diverged = false;
      history = [{ iteration: 0, theta: theta0 }];
    },
  };
}
```

- [ ] **Step 4: Create the top-level barrel `src/engine/index.ts`**

```ts
export * from './types';
export * from './autodiff';
export * from './functions';
export * from './optimizers';
export * from './stepper';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- stepper`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the FULL engine test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all engine tests green (dual, evalDual, compile, functions/registry, finite-difference, all 9 optimizers, optimizers/registry, stepper); no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/stepper.ts src/engine/index.ts src/engine/stepper.test.ts
git commit -m "feat(engine): fixed-timestep stepper (deterministic, divergence-guarded, history) + engine barrel"
```

---

## Task 17: State skeleton — Zustand two-channel stores

**Files:**
- Create: `src/state/uiStore.ts`, `src/state/simStore.ts`, `src/state/index.ts`
- Test: `src/state/uiStore.test.ts`

PRD §8.2: Channel A (slow/UI) is a reactive Zustand store (function choice, optimizer set, learning rate, play/pause, tier). Channel B (fast/sim) is a **vanilla** store with `subscribeWithSelector` read transiently via `getState()`/`subscribe()` — never `setState` per frame. M0 builds the stores and proves the subscription mechanism; the `useFrame` bridge is wired in M1.

- [ ] **Step 1: Write the failing test**

`src/state/uiStore.test.ts`:

```ts
import { useUIStore } from './uiStore';
import { simStore } from './simStore';

describe('UI store (Channel A — slow/reactive)', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  it('has sensible defaults', () => {
    const s = useUIStore.getState();
    expect(s.functionId).toBe('rosenbrock');
    expect(s.optimizerId).toBe('sgd');
    expect(s.isPlaying).toBe(false);
    expect(s.tier).toBe('high');
  });

  it('updates function and optimizer selection', () => {
    useUIStore.getState().setFunctionId('ackley');
    useUIStore.getState().setOptimizerId('adam');
    expect(useUIStore.getState().functionId).toBe('ackley');
    expect(useUIStore.getState().optimizerId).toBe('adam');
  });

  it('toggles play state', () => {
    useUIStore.getState().setPlaying(true);
    expect(useUIStore.getState().isPlaying).toBe(true);
  });

  it('clamps learning-rate override to a positive number', () => {
    useUIStore.getState().setLearningRate(0.05);
    expect(useUIStore.getState().learningRate).toBe(0.05);
  });
});

describe('Sim store (Channel B — fast/transient)', () => {
  it('exposes getState/setState/subscribe for transient ref reads', () => {
    let observed = -1;
    const unsub = simStore.subscribe(
      (s) => s.iteration,
      (it) => {
        observed = it;
      },
    );
    simStore.getState().setIteration(7);
    expect(simStore.getState().iteration).toBe(7);
    expect(observed).toBe(7);
    unsub();
  });

  it('updates the current point transiently', () => {
    simStore.getState().setTheta([1.5, -2]);
    expect(simStore.getState().theta).toEqual([1.5, -2]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- state/uiStore`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/state/uiStore.ts`**

```ts
import { create } from 'zustand';
import type { OptimizerId } from '../engine/types';
import type { Tier } from '../quality/tiers';

/** Channel A — slow, reactive UI state. Changes rarely; may trigger React
 *  re-renders. NEVER written to per simulation frame (that's Channel B). */
export interface UIState {
  functionId: string;
  optimizerId: OptimizerId;
  learningRate: number;
  isPlaying: boolean;
  tier: Tier;
  startPoint: readonly [number, number];

  setFunctionId: (id: string) => void;
  setOptimizerId: (id: OptimizerId) => void;
  setLearningRate: (lr: number) => void;
  setPlaying: (playing: boolean) => void;
  setTier: (tier: Tier) => void;
  setStartPoint: (p: readonly [number, number]) => void;
  reset: () => void;
}

const INITIAL = {
  functionId: 'rosenbrock',
  optimizerId: 'sgd' as OptimizerId,
  learningRate: 0.1,
  isPlaying: false,
  tier: 'high' as Tier,
  startPoint: [-1.2, 1] as const,
};

export const useUIStore = create<UIState>((set) => ({
  ...INITIAL,
  setFunctionId: (functionId) => set({ functionId }),
  setOptimizerId: (optimizerId) => set({ optimizerId }),
  setLearningRate: (learningRate) => set({ learningRate: Math.max(1e-9, learningRate) }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setTier: (tier) => set({ tier }),
  setStartPoint: (startPoint) => set({ startPoint }),
  reset: () => set({ ...INITIAL }),
}));
```

- [ ] **Step 4: Implement `src/state/simStore.ts`**

```ts
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vec2 } from '../engine/types';

/** Channel B — fast, transient simulation state. Read via getState()/subscribe()
 *  into refs inside useFrame (PRD §8.2); the 3D objects are mutated directly.
 *  This is a VANILLA store (not a React hook) so reads/writes never schedule a
 *  React render. */
export interface SimState {
  theta: Vec2;
  iteration: number;
  cost: number;
  diverged: boolean;
  setTheta: (theta: Vec2) => void;
  setIteration: (iteration: number) => void;
  setCost: (cost: number) => void;
  setDiverged: (diverged: boolean) => void;
}

export const simStore = createStore<SimState>()(
  subscribeWithSelector((set) => ({
    theta: [0, 0],
    iteration: 0,
    cost: 0,
    diverged: false,
    setTheta: (theta) => set({ theta }),
    setIteration: (iteration) => set({ iteration }),
    setCost: (cost) => set({ cost }),
    setDiverged: (diverged) => set({ diverged }),
  })),
);
```

- [ ] **Step 5: Create the barrel `src/state/index.ts`**

```ts
export * from './uiStore';
export * from './simStore';
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -- state/uiStore`
Expected: PASS (6 tests). (Note: this test file references `Tier` from `quality/tiers` — Task 18 creates it. If running Task 17 before 18, the import fails; sequence Task 18 first OR create the `quality/tiers.ts` stub now. The plan orders 17 before 18 but the `uiStore` imports `Tier`, so **do Task 18 first if executing strictly in isolation** — see Self-Review note. The safe order is 18 → 17.)

- [ ] **Step 7: Commit**

```bash
git add src/state/
git commit -m "feat(state): Zustand two-channel stores (reactive UI + vanilla transient sim)"
```

---

## Task 18: Quality tiers (data only)

**Files:**
- Create: `src/quality/tiers.ts`
- Test: `src/quality/tiers.test.ts`

> **Execution order:** Do this task BEFORE Task 17 — `uiStore.ts` imports `Tier` from here.

PRD §9.1: the tier ladder. M0 only needs the `Tier` type and the tier→settings data map; live detection (`detect-gpu`) and `PerformanceMonitor` wiring are M1.

- [ ] **Step 1: Write the failing test**

`src/quality/tiers.test.ts`:

```ts
import { TIERS, TIER_SETTINGS, type Tier } from './tiers';

describe('quality tiers', () => {
  it('defines the five tiers from PRD §9.1', () => {
    expect(TIERS).toEqual(['ultra', 'high', 'medium', 'low', 'fallback']);
  });

  it('each non-fallback tier has DPR, surface segments, and particle counts', () => {
    for (const tier of ['ultra', 'high', 'medium', 'low'] as Tier[]) {
      const s = TIER_SETTINGS[tier];
      expect(s.dpr).toBeGreaterThan(0);
      expect(s.surfaceSegments).toBeGreaterThan(0);
      expect(s.ambientParticles).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches the PRD ladder values (Ultra→Low)', () => {
    expect(TIER_SETTINGS.ultra.dpr).toBe(2.0);
    expect(TIER_SETTINGS.ultra.surfaceSegments).toBe(128);
    expect(TIER_SETTINGS.ultra.ambientParticles).toBe(65536);
    expect(TIER_SETTINGS.high.surfaceSegments).toBe(64);
    expect(TIER_SETTINGS.medium.surfaceSegments).toBe(48);
    expect(TIER_SETTINGS.low.surfaceSegments).toBe(32);
    expect(TIER_SETTINGS.fallback.mountCanvas).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- quality/tiers`
Expected: FAIL — `Cannot find module './tiers'`.

- [ ] **Step 3: Implement `src/quality/tiers.ts`**

```ts
/** Adaptive-quality tiers (PRD §9.1). Detection + PerformanceMonitor wiring is M1;
 *  M0 supplies only the type and the tier→settings data map. */
export type Tier = 'ultra' | 'high' | 'medium' | 'low' | 'fallback';

export const TIERS: readonly Tier[] = ['ultra', 'high', 'medium', 'low', 'fallback'];

export interface TierSettings {
  dpr: number;
  surfaceSegments: number;
  ambientParticles: number;
  semanticAgents: number;
  shadowMapSize: number;
  /** Whether to mount the R3F Canvas at all (false = WebGL error fallback). */
  mountCanvas: boolean;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  ultra: { dpr: 2.0, surfaceSegments: 128, ambientParticles: 65536, semanticAgents: 2048, shadowMapSize: 4096, mountCanvas: true },
  high: { dpr: 1.75, surfaceSegments: 64, ambientParticles: 30000, semanticAgents: 512, shadowMapSize: 2048, mountCanvas: true },
  medium: { dpr: 1.25, surfaceSegments: 48, ambientParticles: 12000, semanticAgents: 128, shadowMapSize: 1024, mountCanvas: true },
  low: { dpr: 1.0, surfaceSegments: 32, ambientParticles: 3000, semanticAgents: 0, shadowMapSize: 0, mountCanvas: true },
  fallback: { dpr: 1.0, surfaceSegments: 0, ambientParticles: 0, semanticAgents: 0, shadowMapSize: 0, mountCanvas: false },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- quality/tiers`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/quality/
git commit -m "feat(quality): tier type + tier→settings data map (PRD §9.1)"
```

---

## Task 19: Empty scene renders — the R3F smoke test

**Files:**
- Create: `src/scene/Scene.tsx`
- Modify: `src/App.tsx`
- Test: `src/scene/Scene.test.tsx`

PRD M0 exit criterion: "empty scene renders." This proves the upgraded R3F 9 / React 19 stack actually mounts a Canvas and renders, validated headlessly with `@react-three/test-renderer` (no GPU needed in CI).

- [ ] **Step 1: Write the failing test**

`src/scene/Scene.test.tsx`:

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneContents } from './Scene';

describe('Scene (R3F smoke test)', () => {
  it('mounts the empty scene and renders a mesh without errors', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneContents />);
    // The placeholder scene has one mesh (a reference cube) and a light.
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- scene/Scene`
Expected: FAIL — `Cannot find module './Scene'`.

- [ ] **Step 3: Implement `src/scene/Scene.tsx`**

`SceneContents` is the in-Canvas content (testable with the test renderer, which provides its own Canvas/store); `Scene` wraps it in the real `<Canvas>` for the app.

```tsx
import { Canvas } from '@react-three/fiber';

/** In-canvas content (no <Canvas> wrapper) — unit-testable with
 *  @react-three/test-renderer. M0 placeholder: one reference cube + a light, on
 *  the PRD §5.1 void background. The real surface/ball/post-stack arrive in M1. */
export function SceneContents() {
  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#00D3F2" />
      </mesh>
    </>
  );
}

/** App-facing scene: the real Canvas wrapper. */
export function Scene() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }} dpr={[1, 2]}>
      <SceneContents />
    </Canvas>
  );
}
```

- [ ] **Step 4: Replace `src/App.tsx` to render the scene**

```tsx
import { Scene } from './scene/Scene';

function App() {
  return (
    <div className="w-screen h-screen bg-[#0B0E1A]">
      <Scene />
    </div>
  );
}

export default App;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- scene/Scene`
Expected: PASS — at least one Mesh found, no render errors.

- [ ] **Step 6: Verify the dev server boots and the app builds**

```bash
npm run build
```

Expected: `tsc -b` passes and `vite build` produces `dist/` with no errors. (This confirms the empty scene renders in a real build, satisfying the M0 exit criterion.)

- [ ] **Step 7: Commit**

```bash
git add src/scene/ src/App.tsx
git commit -m "feat(scene): empty R3F scene + headless smoke test (proves R3F9/React19 stack renders)"
```

---

## Task 20: CI — run the full gate on every push

**Files:**
- Create: `.github/workflows/ci.yml`

PRD M0 exit criterion: "CI green." A minimal GitHub Actions workflow that installs, typechecks, tests, and builds.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, m0-foundation]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
```

- [ ] **Step 2: Verify the same commands pass locally (CI parity)**

```bash
npm ci && npm run typecheck && npm test && npm run build
```

Expected: all four succeed. This is the exact gate CI runs.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(m0): typecheck + test + build gate on push/PR"
```

---

## Task 21: M0 completion — full-suite verification & milestone tag

**Files:** none (verification + tag)

- [ ] **Step 1: Run the entire suite from a clean state**

```bash
rm -rf node_modules
npm ci
npm run typecheck
npm test
npm run build
```

Expected, all green:
- typecheck: no errors
- test: every engine test (dual, evalDual, compile, functions/registry, finite-difference, 9 optimizers, optimizers/registry, stepper), state, quality, and the scene smoke test pass
- build: `dist/` produced

- [ ] **Step 2: Confirm the M0 exit criteria from PRD §11 are met**

Verify each explicitly:
- [ ] All optimizers + autodiff pass numerical tests → `npm test` green, incl. `finite-difference.test.ts` (9 functions vs central differences ~1e-6) and all 9 optimizer step tests.
- [ ] Rosenbrock gradient is `[0,0]` at (1,1) → asserted in `finite-difference.test.ts` and `functions/registry.test.ts`.
- [ ] Empty scene renders → `scene/Scene.test.tsx` passes + `npm run build` succeeds.
- [ ] CI green → `.github/workflows/ci.yml` runs the same gate.

- [ ] **Step 3: Tag the milestone**

```bash
git tag -a m0-foundation -m "M0: modern stack + verified pure-TS engine (9 optimizers, autodiff, stepper)"
```

- [ ] **Step 4: Open the PR (or merge per your workflow)**

```bash
git push -u origin m0-foundation
gh pr create --title "M0 — Foundation: modern R3F stack + verified math engine" \
  --body "Implements PRD §11 M0. Clears legacy src/ (preserved on legacy branch), upgrades to fiber9/React19/drei10/postprocessing3/three~0.184/zustand5, and adds a fully unit-tested pure-TS engine/ (dual-number autodiff, 9 optimizers incl. Nadam, fixed-timestep stepper) with gradient-vs-finite-difference validation to ~1e-6. Empty R3F scene renders. CI green."
```

---

## Self-Review

**1. Spec coverage (PRD §11 M0 line):**
- "Modern R3F stack upgrade" → Tasks 2–3. ✓
- "Zustand two-channel architecture" → Task 17 (uiStore reactive + simStore vanilla/subscribeWithSelector per §8.2). ✓
- "engine/ (cost-function registry, dual-number autodiff, 9 optimizers, fixed-timestep stepper)" → Tasks 4–16. ✓ (autodiff 4–6, registry 8, 9 optimizers 10–14, registry 15, stepper 16)
- "preset functions" → Task 8 (all 9 §4.3 functions). ✓
- "Vitest harness with gradient-vs-finite-difference validation" → Tasks 3 + 9. ✓
- Exit: "All optimizers + autodiff pass numerical tests" → Tasks 9–16. ✓ "empty scene renders" → Task 19. ✓ "CI green" → Tasks 20–21. ✓
- §4.2 "suite of 9" → 8 from PRD + Nadam (decision locked) = 9. ✓
- §8.4 module boundaries (engine/scene/state/ui/quality) → engine (4–16), scene (19), state (17), quality (18). `ui/` is intentionally deferred — M0 has no HUD/controls/KaTeX (those are M1+); noted, not a gap.
- §4.4 robustness (guard non-finite) → stepper divergence guard (Task 16) + Ackley cusp guard (Task 8). ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step has complete code; every run step has an exact command + expected result. ✓

**3. Type consistency:** `Vec2`, `GradFn`, `HessFn`, `Optimizer`, `OptimizerState`, `StepResult`, `CostFunction`, `Tier` defined once in Task 7 / Task 18 and used consistently. Optimizer factory names (`makeSGD`…`makeNewton`) and defaults constants (`SGD_DEFAULTS`…`NEWTON_DEFAULTS`) match between their tasks and the registry (Task 15). `compileGradient` return shape (`{f, grad, node}`) consistent between Tasks 6 and 8. `createStepper`/`Stepper` consistent between Tasks 16 and the state bridge intent.

**4. One ordering correction found & noted:** `uiStore.ts` (Task 17) imports `Tier` from `quality/tiers.ts` (Task 18). **Execute Task 18 before Task 17.** This is flagged inline in both tasks. (The numbering keeps the §8.4 module grouping readable, but the dependency runs 18 → 17.)

**5. Two flagged-but-resolved decisions** (verified during planning, not guesses): AdamW uses `θ−=η·λ·θ` (matches PyTorch exactly, step1=0.998990); Nadam uses Ruder's constant-β₁ closed form with η=0.002 (legacy-Keras default). Both have execution-verified test values and source-cited justification baked into the task comments.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-12-ascent-m0-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?
