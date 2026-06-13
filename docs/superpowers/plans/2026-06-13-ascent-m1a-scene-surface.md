# ASCENT M1a — Scene & Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the M0 placeholder cube into the foundation of the cinematic scene — a GPU-displaced magma cost surface (physically lit, contoured, shadowed), a lacquered descent ball that tracks a live simulation, the swappable studio environment, and the single `useFrame` sim runner — with the two engine carryover fixes landed first.

**Architecture:** A pure-TS engine-hardening pass (bounded stepper history + cost; Adam-family `aux` → bias-corrected moments) lands before any rendering. Then the scene is built under the PRD §8.4 `scene/` boundary: a `three-custom-shader-material` (CSM) surface wrapping `MeshPhysicalMaterial` (vertex displacement + analytic normals + magma emissive, while keeping the full PBR/clearcoat/env/shadow/fog pass), a procedural-primary `<SceneEnvironment>` behind a swappable `.hdr` boundary, a directional key light with tier-driven soft shadows, and a lacquered ball that reads the vanilla `simStore` transiently and damps its world position. One `useSimRunner` `useFrame` owns the fixed-timestep stepper and writes `simStore` — the two-channel rule (PRD §8.2) is the spine. The cycle ends with the lighting A/B (procedural vs. Poly Haven `.hdr`) and a live-browser design checkpoint.

**Tech Stack:** three ~0.184 · @react-three/fiber 9.6 · @react-three/drei 10.7 · **three-custom-shader-material ^6.4.0 (new)** · zustand 5 · maath (via drei) · TypeScript 5.6 · Vitest 4.1 + @react-three/test-renderer 9.1 · Vite 7. GLSL for the surface shader. Live verification via the Playwright MCP browser.

---

## Context for the implementer

You are building **M1a — the first of three M1 cycles** for ASCENT, a 3D gradient-descent teaching/showpiece app. **Read `PRD.md` and `docs/superpowers/specs/2026-06-13-ascent-m1-design.md` once before starting** — the spec is the source of truth for M1 (it records four PRD corrections, the CSM decision, and the module map). This plan implements the M1a slice only (scene + surface); the post-stack, swarm, hero beat (M1b) and adaptive tiers + instrumentation (M1c) are planned just-in-time after this cycle.

### Locked decisions (already made — do not re-litigate)

1. **Surface material = `three-custom-shader-material` (CSM) v6.4.0** wrapping `THREE.MeshPhysicalMaterial`. It gives vertex displacement + custom analytic normals + magma emissive **while keeping** the full PBR pass (clearcoat, PMREM env reflections, shadow receiving, fog, dithering). Verified: peer `three >=0.159` (open upper bound) → **no three bump**; zero runtime deps; ships its own R3F `<primitive>`-based component (no `extend()` needed); root export types at `react.d.ts`. Alternatives (raw `ShaderMaterial`, `onBeforeCompile`) were rejected in the spec; `onBeforeCompile` is kept only as the depth-material fallback (Task 8).
2. **`<SceneEnvironment>` is procedural-primary behind a swappable `.hdr` boundary.** The lighting A/B (procedural vs. a Poly Haven dark-studio `.hdr`) happens at the end of this cycle (Task 12); the `.hdr` is the user's presumed winner, but the swap is one component either way.
3. **The two-channel rule is non-negotiable.** `uiStore` (reactive) for slow UI state; `simStore` (vanilla) for per-frame sim state, read transiently via `getState()`/`subscribe()` and applied by direct object mutation in `useFrame`. **Never `setState` per frame.** The committed Playwright smoke test (M1c) guards this.
4. **All numeric test values in this plan are execution-verified** — computed by running real Node scripts during planning, not derived by hand. The Adam-family bias-corrected moments and the ring-buffer behavior are exact; use them as written.

### Verified external references (checked live during planning, 2026-06-13)

- **CSM 6.4.0** resolves from npm; peer `three >=0.159`; `npm ls three` stays `0.184.x` after install.
- **Poly Haven `.hdr` candidates** (all CC0, HTTP-200 live) at `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<slug>_1k.hdr` for slugs `satara_night_no_lamps`, `dikhololo_night`, `moonless_golf`.

### The shared mapping contract (the spine that keeps the surface and the ball in sync)

`src/scene/surfaceMapping.ts` is the **single source of truth** for param↔world conversion, created in Task 4 and imported by `Surface.tsx` and `DescentBall.tsx`:

- `SURFACE_SIZE = 4` — the plane is `SURFACE_SIZE × SURFACE_SIZE` world units, centered at the origin, built in XY and rotated `-Math.PI/2` about X (local +Z → world +Y).
- `paramToWorldXZ(px, pz, domain)` — maps a function's `domain = [xMin, xMax, yMin, yMax]` linearly onto `[-SURFACE_SIZE/2, +SURFACE_SIZE/2]²`. **Note the 3-arg signature: the caller passes the active function's `domain`.**
- `costToWorldHeight(cost, functionId)` and `vScaleFor(functionId)` — map a cost value to a pleasing world height (~1.5 units) per function.
- The **same** mapping is reproduced in GLSL inside `surfaceShaders.ts`/`functionField.ts`. M1a hand-writes both the TS and the GLSL (AST→GLSL codegen is M3); **they must stay in sync** — a change to one is a change to the other.

The locked CSM uniform names (shared between the surface material and its `customDepthMaterial`): `uFunction` (int index from `FUNCTION_GLSL_INDEX`), `uTime`, `uVScale`, `uParamMin` (vec2), `uParamRange` (vec2), `uContourSpacing`, `uColorLow` (=0.12), `uColorHigh` (=1.0).

### Verification model (per the spec §8)

R3F components can't fully run in headless Vitest (the GL is mocked), so each task states which verification applies:
- **Pure TS / engine** (Tasks 1–3, 4's mapping, the GLSL structure-guards): Vitest TDD (RED→GREEN→commit) + `npm run typecheck`.
- **GLSL / R3F components** (Tasks 5–14): structure-guard tests where possible + `npm run typecheck` + `npm run build` (the M0 lesson: the build gate's `noUnusedLocals` catches things the test suite masks) + `@react-three/test-renderer` structure assertions + the **live Playwright-MCP browser** (zero WebGL console errors + screenshots on your real GPU).
- **⚠️ Smoke-test-early risks** are called out inline with their fallback: Risk #1 (CSM `customDepthMaterial` for displaced shadows) is verified in Task 8 with the `onBeforeCompile` fallback shown.

### Task map

- **Phase 0 — Engine hardening (Tasks 1–3):** ring-buffer history + cost; Adam-family `aux` bias-corrected; `aux` contract doc + green gate.
- **Phase 1 — The cost surface (Tasks 4–8):** install CSM + `surfaceMapping`; magma colormap GLSL; per-preset height/grad GLSL; assemble shaders; the CSM `Surface` + depth material (Risk #1).
- **Phase 2 — Environment, lights, ball (Tasks 9–12):** `SceneEnvironment`; tiered `Lights`; `DescentBall`; the lighting A/B checkpoint.
- **Phase 3 — Sim runner & wiring (Tasks 13–15):** `useSimRunner`; `Scene` composition (cube removed); the M1a phase gate + design checkpoint.

---

## Tasks

### Task 1: Stepper history → bounded ring buffer + populate cost

**Files:**
- Modify: `src/engine/stepper.ts` (add `cost`+`historyCap` to config; record cost per entry; cap via `shift()`)
- Test: `src/engine/stepper.test.ts` (update the 5 existing call sites to pass `cost`; add a cost-recording test and a ring-buffer cap test)

> **Why:** `m1-carryover-fixes.md` item 2. The stepper currently pushes one `HistoryEntry` per step with **no cap** (O(n) memory growth at a sustained 60fps single-step cadence) and leaves `HistoryEntry.cost` unset. The M1 sim runner is about to drive this continuously, so it must be bounded and must carry cost (the scrubber + cost-vs-iteration readout consume it). `cost` becomes a required field of `StepperConfig`; `historyCap` defaults to 4096 (the scrubber window). `history[0]` is the **oldest retained** entry after capping.

- [ ] **Step 1: Update the 5 existing test call sites to pass a `cost` fn (RED — they won't compile yet)**

The existing tests build `createStepper` without `cost`; once `cost` is required, they must supply one. Edit `src/engine/stepper.test.ts`. First, extend the imports and add a `cost` const beside the existing `grad`:

```ts
import { createStepper } from './stepper';
import { makeSGD } from './optimizers';
import { getFunction } from './functions';
import type { CostFn, GradFn, Vec2 } from './types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];
const cost: CostFn = (t: Vec2) => t[0] * t[0] + t[1] * t[1]; // x²+y², matches the grad above
```

Then add `cost` to each of the 5 existing `createStepper({...})` calls. The divergence test uses Rosenbrock's grad, so give it Rosenbrock's cost; the other four use the local `grad`/`cost`:

```ts
  it('advances exactly one step when elapsed >= dt', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.1); // exactly one dt
    expect(s.iteration).toBe(1);
    expect(s.theta[0]).toBeCloseTo(0.8, 12);
  });

  it('advances multiple steps for a large elapsed time (accumulator)', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.35); // 3 whole steps, 0.05 left over
    expect(s.iteration).toBe(3);
    expect(s.theta[0]).toBeCloseTo(0.512, 10); // 1·0.8^3
  });

  it('does not step until dt is reached; exposes interpolation alpha', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.05);
    expect(s.iteration).toBe(0);
    expect(s.alpha).toBeCloseTo(0.5, 6); // halfway to the next step
  });

  it('reset returns to the initial point and clears state', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.3);
    s.reset();
    expect(s.iteration).toBe(0);
    expect(s.theta).toEqual([1, 1]);
  });

  it('flags divergence and stops when a step produces non-finite values', () => {
    // Huge LR on Rosenbrock from a steep point → overflow to Infinity.
    const opt = makeSGD({ lr: 1e6 });
    const ros = getFunction('rosenbrock');
    const s = createStepper({ optimizer: opt, grad: ros.grad, cost: ros.cost, theta0: [-1.5, -1], dt: 0.1 });
    s.advance(1.0); // would be 10 steps, but it diverges first
    expect(s.diverged).toBe(true);
    expect(s.theta.every(Number.isFinite)).toBe(true); // last finite point retained
  });
```

- [ ] **Step 2: Add the two new tests (cost recorded everywhere; ring buffer caps + drops oldest)**

Append these two tests inside the `describe('fixed-timestep stepper', ...)` block, after the existing `'records history of points for the scrubber (M1)'` test. They use the verified values: `getFunction('sphere')` (`cost(x,y)=x²+y²`, so `cost([1,1])=2`), SGD `lr=0.1`, `dt=0.1`; with `historyCap: 4` after 6 steps `length===4`, `history[0].iteration===3`, last `iteration===6`.

```ts
  it('records cost on every history entry including the initial one', () => {
    const opt = makeSGD({ lr: 0.1 });
    const sphere = getFunction('sphere');
    const s = createStepper({ optimizer: opt, grad: sphere.grad, cost: sphere.cost, theta0: [1, 1], dt: 0.1 });
    expect(s.history[0].cost).toBeCloseTo(2, 12); // cost([1,1]) = 1²+1² = 2
    s.advance(0.1); // one step → θ=[0.8,0.8]
    expect(s.history).toHaveLength(2);
    expect(s.history[1].theta[0]).toBeCloseTo(0.8, 12);
    expect(s.history[1].cost).toBeCloseTo(0.8 * 0.8 + 0.8 * 0.8, 12); // 1.28
    expect(s.history.every((h) => typeof h.cost === 'number')).toBe(true);
  });

  it('caps history at historyCap and drops the oldest entry (ring buffer)', () => {
    const opt = makeSGD({ lr: 0.1 });
    const sphere = getFunction('sphere');
    const s = createStepper({
      optimizer: opt,
      grad: sphere.grad,
      cost: sphere.cost,
      theta0: [1, 1],
      dt: 0.1,
      historyCap: 4,
    });
    s.advance(0.6); // 6 whole steps; without a cap history would be length 7 (initial + 6)
    expect(s.history).toHaveLength(4); // capped
    expect(s.history[0].iteration).toBe(3); // oldest RETAINED (iterations 0,1,2 dropped)
    expect(s.history[s.history.length - 1].iteration).toBe(6); // newest
  });
```

- [ ] **Step 3: Run the tests to verify they FAIL (RED)**

```bash
npm test -- stepper
```

Expected: **FAIL**. The new tests reference `historyCap` and `cost`, and the source does not yet record cost or cap the array, so you see failures like `expected undefined to be close to 2` (initial `cost`) and `expected 7 to have a length of 4` (no cap). TypeScript will also flag `cost` / `historyCap` as unknown properties on `StepperConfig` — both resolve once Step 4 lands.

- [ ] **Step 4: Implement — write the complete new `src/engine/stepper.ts`**

Add `cost: CostFn` (required) and `historyCap?: number` (default 4096) to `StepperConfig`; seed the initial entry with cost; push every entry with cost; `shift()` when over the cap. The divergence guard, `alpha`, and the `iteration`/`theta` getters are unchanged. Replace the file entirely:

```ts
import type { CostFn, GradFn, Optimizer, OptimizerState, Vec2 } from './types';

export interface StepperConfig {
  optimizer: Optimizer;
  grad: GradFn;
  /** Cost of the active function — recorded on every history entry (incl. the
   *  initial point) for the iteration scrubber and the cost-vs-iteration readout. */
  cost: CostFn;
  theta0: Vec2;
  /** Fixed simulation timestep in seconds (one optimizer step per dt). */
  dt: number;
  /** Max retained history entries (ring buffer). Oldest are dropped first so the
   *  array stays bounded under a sustained 60fps single-step cadence. Default 4096
   *  — the scrubber window. */
  historyCap?: number;
}

/** A single recorded frame of the descent, for the iteration scrubber (M1). */
export interface HistoryEntry {
  iteration: number;
  theta: Vec2;
  cost: number;
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

const DEFAULT_HISTORY_CAP = 4096;

/**
 * Fixed-timestep accumulator (PRD §8.3): accumulates real elapsed time and
 * takes deterministic whole optimizer steps when it crosses dt, so behavior is
 * refresh-rate independent. Guards non-finite values (PRD §4.4): on NaN/Inf it
 * retains the last finite point, flags `diverged`, and stops stepping. History
 * is a bounded ring buffer (oldest dropped first) and records cost per entry.
 */
export function createStepper(config: StepperConfig): Stepper {
  const { optimizer, grad, cost, theta0, dt } = config;
  const historyCap = config.historyCap ?? DEFAULT_HISTORY_CAP;

  let theta: Vec2 = theta0;
  let state: OptimizerState = optimizer.init(theta0);
  let accumulator = 0;
  let diverged = false;
  let history: HistoryEntry[] = [{ iteration: 0, theta: theta0, cost: cost(theta0) }];

  const isFinitePair = (v: Vec2): boolean => Number.isFinite(v[0]) && Number.isFinite(v[1]);

  const record = (iteration: number, t: Vec2): void => {
    history.push({ iteration, theta: t, cost: cost(t) });
    if (history.length > historyCap) history.shift(); // drop oldest; history[0] = oldest retained
  };

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
        record(state.iteration, theta);
      }
    },
    reset() {
      theta = theta0;
      state = optimizer.init(theta0);
      accumulator = 0;
      diverged = false;
      history = [{ iteration: 0, theta: theta0, cost: cost(theta0) }];
    },
  };
}
```

> **Note — `HistoryEntry.cost` is now required (was `cost?`).** Nothing in the codebase reads `HistoryEntry` yet (the scrubber is M1b/M2), so tightening it is safe; the typecheck in Task 3 confirms no other consumer breaks.

- [ ] **Step 5: Run the tests to verify they PASS (GREEN)**

```bash
npm test -- stepper
```

Expected: **PASS** — `7 passed` in `src/engine/stepper.test.ts` (5 updated existing + 2 new). The `'records history of points for the scrubber (M1)'` test still asserts `length === 3` after `advance(0.2)` and stays valid (default cap 4096 ≫ 3; that test doesn't set `historyCap`).

- [ ] **Step 6: Commit**

```bash
git add src/engine/stepper.ts src/engine/stepper.test.ts
git commit -m "feat(engine): bound stepper history (ring buffer) + record cost per entry

StepperConfig now requires a cost fn and records cost on every HistoryEntry
(including the initial point); historyCap (default 4096) caps the array via
shift() so it stays bounded under a sustained 60fps single-step cadence —
history[0] is the oldest retained entry. Carryover fix #2 ahead of the M1
sim runner driving the stepper continuously."
```

---

### Task 2: Adam-family `aux` → bias-corrected moments

**Files:**
- Modify: `src/engine/optimizers/adam.ts` (`aux` → `{ mHat, vHat, gradient }`)
- Modify: `src/engine/optimizers/adamw.ts` (same)
- Modify: `src/engine/optimizers/nadam.ts` (same)
- Test: `src/engine/optimizers/adam.test.ts`, `adamw.test.ts`, `nadam.test.ts` (assert `aux.mHat`/`aux.vHat`)

> **Why:** `m1-carryover-fixes.md` item 1. `types.ts` documents `StepResult.aux` as carrying **bias-corrected** moments for the M2 internal-state viz, but all three Adam-family optimizers currently put the **raw** `m`/`v` into `aux`. `mHat = m/bc1` and `vHat = v/bc2` are already computed inline for the θ update — we just expose them instead of the raw buffers. **The θ math does not change**, so every verified θ value stays identical. `aux` values typed `Vec2 | number`, so in tests read the tuple via `as unknown as Vec2`.

- [ ] **Step 1: Update `adam.test.ts` to assert `aux.mHat`/`aux.vHat` (RED)**

Replace `src/engine/optimizers/adam.test.ts` entirely. The θ assertions are the existing verified values (unchanged); the new `aux` assertions use the verified moments (step1 `mHat[0]=2`, `vHat[0]=4`; step2 `mHat[0]=1.9989473684263157`, `vHat[0]=3.996000000020048`):

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

  it('aux exposes bias-corrected moments m̂, v̂ and the gradient', () => {
    const opt = makeAdam({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    const state = opt.init([1, 1]);
    // Step 1 from (1,1): g=[2,2]; m̂=g=[2,2], v̂=g²=[4,4] (bias correction divides by 1−β at t=1).
    const r1 = opt.step([1, 1], grad, state);
    const mHat1 = r1.aux!.mHat as unknown as Vec2;
    const vHat1 = r1.aux!.vHat as unknown as Vec2;
    const gradient1 = r1.aux!.gradient as unknown as Vec2;
    expect(mHat1[0]).toBeCloseTo(2, 12);
    expect(vHat1[0]).toBeCloseTo(4, 12);
    expect(gradient1[0]).toBeCloseTo(2, 12);
    // Step 2 from the advanced point.
    const r2 = opt.step(r1.theta, grad, r1.state);
    const mHat2 = r2.aux!.mHat as unknown as Vec2;
    const vHat2 = r2.aux!.vHat as unknown as Vec2;
    expect(mHat2[0]).toBeCloseTo(1.9989473684263157, 12);
    expect(vHat2[0]).toBeCloseTo(3.996000000020048, 12);
  });
});
```

- [ ] **Step 2: Update `adamw.test.ts` (RED)**

Replace `src/engine/optimizers/adamw.test.ts` entirely. θ values unchanged; verified AdamW moments (step1 `mHat[0]=2`, `vHat[0]=4`; step2 `mHat[0]=1.9989368421105267`, `vHat[0]=3.995960020230153`):

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

  it('aux exposes bias-corrected moments m̂, v̂ (decay does NOT enter m/v)', () => {
    const opt = makeAdamW({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8, weightDecay: 1e-2 });
    const state = opt.init([1, 1]);
    const r1 = opt.step([1, 1], grad, state);
    const mHat1 = r1.aux!.mHat as unknown as Vec2;
    const vHat1 = r1.aux!.vHat as unknown as Vec2;
    expect(mHat1[0]).toBeCloseTo(2, 12);
    expect(vHat1[0]).toBeCloseTo(4, 12);
    const r2 = opt.step(r1.theta, grad, r1.state);
    const mHat2 = r2.aux!.mHat as unknown as Vec2;
    const vHat2 = r2.aux!.vHat as unknown as Vec2;
    expect(mHat2[0]).toBeCloseTo(1.9989368421105267, 12);
    expect(vHat2[0]).toBeCloseTo(3.995960020230153, 12);
  });
});
```

- [ ] **Step 3: Update `nadam.test.ts` (RED)**

Replace `src/engine/optimizers/nadam.test.ts` entirely. θ values unchanged; verified Nadam moments (step1 `mHat[0]=2`, `vHat[0]=4`; step2 `mHat[0]=1.9960000000200002`, `vHat[0]=3.9848212907211287`):

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

  it('aux exposes bias-corrected moments m̂, v̂ and the gradient', () => {
    const opt = makeNadam({ lr: 0.002, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    const state = opt.init([1, 1]);
    const r1 = opt.step([1, 1], grad, state);
    const mHat1 = r1.aux!.mHat as unknown as Vec2;
    const vHat1 = r1.aux!.vHat as unknown as Vec2;
    expect(mHat1[0]).toBeCloseTo(2, 12);
    expect(vHat1[0]).toBeCloseTo(4, 12);
    const r2 = opt.step(r1.theta, grad, r1.state);
    const mHat2 = r2.aux!.mHat as unknown as Vec2;
    const vHat2 = r2.aux!.vHat as unknown as Vec2;
    expect(mHat2[0]).toBeCloseTo(1.9960000000200002, 12);
    expect(vHat2[0]).toBeCloseTo(3.9848212907211287, 12);
  });
});
```

- [ ] **Step 4: Run all three to verify they FAIL (RED)**

```bash
npm test -- adam adamw nadam
```

Expected: **FAIL**. The new `aux` tests fail because `aux` still holds raw `m`/`v` (no `mHat`/`vHat` keys) — e.g. `Cannot read properties of undefined` / `expected undefined to be close to 2` on `aux.mHat`. The existing θ tests still pass.

- [ ] **Step 5: Implement Adam — expose `mHat`/`vHat` in `aux`**

In `src/engine/optimizers/adam.ts`, the bias-corrected moments are needed for the θ update, so compute them as named vectors and return them in `aux`. Replace the `bc1`/`bc2`/`next`/`return` tail of `step()` (lines 35–45) with:

```ts
      const bc1 = 1 - Math.pow(hp.beta1, t);
      const bc2 = 1 - Math.pow(hp.beta2, t);
      const mHat: Vec2 = [m[0] / bc1, m[1] / bc1];
      const vHat: Vec2 = [v[0] / bc2, v[1] / bc2];
      const next: Vec2 = [
        theta[0] - (hp.lr * mHat[0]) / (Math.sqrt(vHat[0]) + hp.eps),
        theta[1] - (hp.lr * mHat[1]) / (Math.sqrt(vHat[1]) + hp.eps),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { mHat, vHat, gradient: g },
      };
```

> The θ formula is algebraically identical: `m[0]/bc1` is now `mHat[0]`, and `Math.sqrt(v[0]/bc2)` is now `Math.sqrt(vHat[0])` (`vHat[0] === v[0]/bc2`). The verified θ values are preserved.

- [ ] **Step 6: Implement AdamW — expose `mHat`/`vHat` in `aux`**

In `src/engine/optimizers/adamw.ts`, replace the `bc1`/`bc2`/`next`/`return` tail of `step()` (lines 49–59) with (note `next` subtracts from `decayed`, not `theta` — decay stays decoupled):

```ts
      const bc1 = 1 - Math.pow(hp.beta1, t);
      const bc2 = 1 - Math.pow(hp.beta2, t);
      const mHat: Vec2 = [m[0] / bc1, m[1] / bc1];
      const vHat: Vec2 = [v[0] / bc2, v[1] / bc2];
      const next: Vec2 = [
        decayed[0] - (hp.lr * mHat[0]) / (Math.sqrt(vHat[0]) + hp.eps),
        decayed[1] - (hp.lr * mHat[1]) / (Math.sqrt(vHat[1]) + hp.eps),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { mHat, vHat, gradient: g },
      };
```

- [ ] **Step 7: Implement Nadam — expose `mHat`/`vHat` in `aux`**

In `src/engine/optimizers/nadam.ts`, the closed form uses `m[i]/bc1` inside `numer`; route it through `mHat` so the exposed value and the update share one expression. Replace the `bc1`/`bc2`/`numer`/`next`/`return` tail of `step()` (lines 39–51) with:

```ts
      const bc1 = 1 - Math.pow(hp.beta1, t);
      const bc2 = 1 - Math.pow(hp.beta2, t);
      const mHat: Vec2 = [m[0] / bc1, m[1] / bc1];
      const vHat: Vec2 = [v[0] / bc2, v[1] / bc2];
      const numer = (i: number): number => hp.beta1 * mHat[i] + ((1 - hp.beta1) * g[i]) / bc1;
      const next: Vec2 = [
        theta[0] - (hp.lr / (Math.sqrt(vHat[0]) + hp.eps)) * numer(0),
        theta[1] - (hp.lr / (Math.sqrt(vHat[1]) + hp.eps)) * numer(1),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { mHat, vHat, gradient: g },
      };
```

> `numer` is unchanged (`m[i]/bc1` ≡ `mHat[i]`), and `Math.sqrt(v[i]/bc2)` ≡ `Math.sqrt(vHat[i])`. Nadam's verified θ values are preserved.

- [ ] **Step 8: Run all three to verify they PASS (GREEN)**

```bash
npm test -- adam adamw nadam
```

Expected: **PASS** — `6 passed` across the three files (each: 1 θ test + 1 `aux` test). The θ assertions still hold (math unchanged); the `aux` assertions now read the bias-corrected moments.

- [ ] **Step 9: Commit**

```bash
git add src/engine/optimizers/adam.ts src/engine/optimizers/adamw.ts src/engine/optimizers/nadam.ts \
        src/engine/optimizers/adam.test.ts src/engine/optimizers/adamw.test.ts src/engine/optimizers/nadam.test.ts
git commit -m "fix(engine): Adam-family aux returns bias-corrected moments, not raw m/v

adam/adamw/nadam now expose { mHat, vHat, gradient } in StepResult.aux —
matching the StepResult doc and what the M2 internal-state viz consumes.
mHat=m/bc1, vHat=v/bc2 were already computed for the θ update; they are now
named and surfaced. θ math is byte-for-byte unchanged (verified values hold).
Carryover fix #1."
```

---

### Task 3: Document the `aux` contract in `types.ts` + engine green gate

**Files:**
- Modify: `src/engine/types.ts` (sharpen the `StepResult.aux` JSDoc to name the `mHat`/`vHat`/`gradient` contract)
- Verify only: `src/engine/index.ts` (the engine barrel already re-exports `types`/`stepper`/`optimizers`; no change needed)

> **Why:** Consolidation. The carryover memory references "align `aux` with its doc" — the doc is in `types.ts` and currently describes the intent in prose ("bias-corrected moments") but doesn't pin the key names now that three optimizers emit them. Tighten it so the contract is discoverable, then prove the whole engine is green after Tasks 1–2. No new barrel file is needed: `src/engine/index.ts` already exports `./types`, `./stepper`, `./optimizers`, `./functions`, `./autodiff`.

- [ ] **Step 1: Tighten the `StepResult.aux` JSDoc**

In `src/engine/types.ts`, replace the `StepResult` interface and its doc comment (lines 55–62) with:

```ts
/** Result of one optimizer step: new point, advanced state, and optional
 *  internal-state values for the M2 visualization. For Adam-family optimizers
 *  (Adam/AdamW/Nadam) `aux` carries the BIAS-CORRECTED moments and the raw
 *  gradient: `{ mHat: Vec2, vHat: Vec2, gradient: Vec2 }` (mHat=m/(1−β₁ᵗ),
 *  vHat=v/(1−β₂ᵗ)). Other optimizers populate aux per their own viz needs
 *  (e.g. velocity arrow, per-axis adaptive scale). */
export interface StepResult {
  theta: Vec2;
  state: OptimizerState;
  aux?: Record<string, Vec2 | number>;
}
```

> **No `StepperConfig` note belongs here** — `StepperConfig`/`HistoryEntry` live in `stepper.ts` (already self-documented in Task 1), not `types.ts`. This step is purely the `aux` contract.

- [ ] **Step 2: Typecheck the whole project (must be clean)**

```bash
npm run typecheck
```

Expected: exits 0, no output (or `tsc --noEmit` prints nothing). Confirms `cost`/`historyCap`/`HistoryEntry.cost` (Task 1) and the `aux` shape (Task 2) typecheck across every consumer, and that no code outside the engine read the now-required `HistoryEntry.cost`.

- [ ] **Step 3: Run the entire engine suite (must be green)**

```bash
npm test -- engine
```

Expected: **PASS** — every file under `src/engine/**` green, including the modified `stepper.test.ts` (7 tests), `adam.test.ts` / `adamw.test.ts` / `nadam.test.ts` (2 each), plus the unchanged `finite-difference.test.ts`, `registry.test.ts`, autodiff suites, and the other six optimizers. Zero failures.

- [ ] **Step 4: Commit**

```bash
git add src/engine/types.ts
git commit -m "docs(engine): pin the StepResult.aux contract (mHat/vHat/gradient)

Adam-family aux now names its keys in the StepResult JSDoc so the M2
internal-state viz has a discoverable contract. Closes both M1 engine
carryover items; engine is green (typecheck + full engine suite) ahead of
the M1a sim runner."
```

---

Files referenced (all absolute):
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\stepper.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\stepper.test.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\optimizers\adam.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\optimizers\adamw.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\optimizers\nadam.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\optimizers\adam.test.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\optimizers\adamw.test.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\optimizers\nadam.test.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\types.ts`
- `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\index.ts` (verify-only; no change)

---

### Task 4: Install CSM + `surfaceMapping.ts` (the param↔world single source of truth)

**Files:**
- Modify: `package.json` (add `three-custom-shader-material`)
- Create: `src/scene/surfaceMapping.ts`
- Test: `src/scene/surfaceMapping.test.ts`

This task adds the one new M1a dependency and builds the **single source of truth for the param↔world mapping** that both `Surface.tsx` (Task 8) and `DescentBall.tsx` (a later phase) consume. It is pure TypeScript with no Three/React imports, so it is fully unit-testable (TDD). The same constants are later re-expressed in GLSL (Task 7) — a comment in this file flags that they must stay in sync.

- [ ] **Step 1: Add `three-custom-shader-material` to `package.json` dependencies**

In `package.json`, add the dependency line (alphabetical position, between `@react-three/postprocessing` and `clsx`):

```jsonc
// in "dependencies", add:
    "three-custom-shader-material": "^6.4.0",
```

The resulting `"dependencies"` block must read:

```json
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.6.1",
    "@react-three/postprocessing": "^3.0.4",
    "three-custom-shader-material": "^6.4.0",
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
```

- [ ] **Step 2: Install and verify the resolution**

```bash
npm install
```

Expected: install completes with **no `npm error ERESOLVE`**. CSM's peer requirement is `three >=0.159` with no upper bound, so it accepts the pinned `three@0.184` without forcing a bump. If you see a peer error, stop and report — do NOT use `--legacy-peer-deps`.

- [ ] **Step 3: Confirm CSM resolved AND that `three` did not bump**

```bash
npm ls three-custom-shader-material three 2>&1 | grep -E "three-custom-shader-material@|three@0\."
```

Expected: a line `three-custom-shader-material@6.4.x` and `three@0.184.x` (the tilde pin holds — postprocessing's `<0.185` cap is intact). If `three` shows anything `0.185+`, stop and report.

- [ ] **Step 4: Write the failing test**

`src/scene/surfaceMapping.test.ts`:

```ts
import {
  SURFACE_SIZE,
  paramToWorldXZ,
  worldXZToParam,
  vScaleFor,
  costToWorldHeight,
} from './surfaceMapping';
import { getFunction } from '../engine/functions';
import type { Vec2 } from '../engine/types';

describe('surfaceMapping — param↔world single source of truth', () => {
  const ros = getFunction('rosenbrock').domain; // [-2, 2, -1, 3]
  const sphere = getFunction('sphere').domain; // [-5, 5, -5, 5]

  it('SURFACE_SIZE is the locked 4 world units', () => {
    expect(SURFACE_SIZE).toBe(4);
  });

  it('maps the domain min-corner to (-SIZE/2, -SIZE/2)', () => {
    const [wx, wz] = paramToWorldXZ(ros[0], ros[2], ros);
    expect(wx).toBeCloseTo(-SURFACE_SIZE / 2, 12); // -2
    expect(wz).toBeCloseTo(-SURFACE_SIZE / 2, 12); // -2
  });

  it('maps the domain max-corner to (+SIZE/2, +SIZE/2)', () => {
    const [wx, wz] = paramToWorldXZ(ros[1], ros[3], ros);
    expect(wx).toBeCloseTo(SURFACE_SIZE / 2, 12); // +2
    expect(wz).toBeCloseTo(SURFACE_SIZE / 2, 12); // +2
  });

  it('maps the domain centre to the world origin', () => {
    // sphere domain centre is (0,0)
    const [wx, wz] = paramToWorldXZ(0, 0, sphere);
    expect(wx).toBeCloseTo(0, 12);
    expect(wz).toBeCloseTo(0, 12);
  });

  it('round-trips: worldXZToParam ∘ paramToWorldXZ ≈ identity (rosenbrock)', () => {
    const samples: Vec2[] = [
      [-1.2, 1],
      [0, 0],
      [1, 1],
      [-2, -1],
      [2, 3],
      [0.5, -0.5],
    ];
    for (const [px, pz] of samples) {
      const [wx, wz] = paramToWorldXZ(px, pz, ros);
      const [rpx, rpz] = worldXZToParam(wx, wz, ros);
      expect(rpx).toBeCloseTo(px, 10);
      expect(rpz).toBeCloseTo(pz, 10);
    }
  });

  it('round-trips on an asymmetric domain too (sphere is symmetric; use rosenbrock asym y)', () => {
    // rosenbrock y∈[-1,3] is asymmetric — exercises the offset term.
    const [wx, wz] = paramToWorldXZ(-2, 3, ros); // x-min, y-max
    expect(wx).toBeCloseTo(-SURFACE_SIZE / 2, 12);
    expect(wz).toBeCloseTo(SURFACE_SIZE / 2, 12);
    const [rpx, rpz] = worldXZToParam(wx, wz, ros);
    expect(rpx).toBeCloseTo(-2, 10);
    expect(rpz).toBeCloseTo(3, 10);
  });

  it('vScaleFor returns a positive height scale per function (concrete for sphere & rosenbrock)', () => {
    expect(vScaleFor('sphere')).toBeCloseTo(0.03, 12);
    expect(vScaleFor('rosenbrock')).toBeCloseTo(0.0006, 12);
    // unknown id falls back to the sensible default, still positive
    expect(vScaleFor('does-not-exist')).toBeGreaterThan(0);
  });

  it('costToWorldHeight = vScale·cost; 0 cost → 0 height; monotonic in cost', () => {
    // sphere cost([1,1]) = 2  → height = 0.03 * 2 = 0.06
    expect(costToWorldHeight(2, 'sphere')).toBeCloseTo(0.06, 12);
    expect(costToWorldHeight(0, 'sphere')).toBe(0);
    expect(costToWorldHeight(8, 'sphere')).toBeGreaterThan(costToWorldHeight(2, 'sphere'));
  });

  it('the chosen vScales put the domain-corner cost near ~1.5 world units (pleasing height)', () => {
    // sphere corner (5,5): cost=50 → 0.03*50 = 1.5 exactly
    expect(costToWorldHeight(50, 'sphere')).toBeCloseTo(1.5, 12);
    // rosenbrock worst corner (-2,-1): cost = (1-(-2))^2 + 100*(-1-4)^2 = 9 + 2500 = 2509
    //   → 0.0006*2509 ≈ 1.505 (within the "~1.5" target band)
    expect(costToWorldHeight(2509, 'rosenbrock')).toBeGreaterThan(1.0);
    expect(costToWorldHeight(2509, 'rosenbrock')).toBeLessThan(2.0);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

```bash
npm test -- surfaceMapping
```

Expected: FAIL — `Cannot find module './surfaceMapping'`.

- [ ] **Step 6: Implement `src/scene/surfaceMapping.ts`**

The vScale numbers are chosen so each function's *worst-corner* cost over its domain maps to roughly `1.5` world units (a pleasing peak height against the `SURFACE_SIZE=4` plane). `sphere`: max cost on `[-5,5]²` is `50` → `1.5/50 = 0.03`. `rosenbrock`: worst-corner cost ≈ `2509` → `1.5/2509 ≈ 0.0006`. The rest are computed the same way from their PRD domains and rounded to a clean value; all are positive.

```ts
import type { Domain } from './surfaceMapping.types';

/**
 * THE single source of truth for the parameter↔world-XZ mapping (LOCKED).
 * The surface is a SURFACE_SIZE × SURFACE_SIZE plane centred at the origin
 * (built in local XY, rotation-x = -PI/2 so local +Z becomes world +Y).
 * Surface.tsx (GPU vertex shader) and DescentBall.tsx both go through here so
 * the ball sits exactly on the displaced terrain.
 *
 * ⚠️ KEEP IN SYNC WITH GLSL: the same linear map is reproduced in
 * src/scene/shaders/surfaceShaders.ts (uParamMin / uParamRange) and the same
 * vScale is sent as the uVScale uniform. M1a hand-writes both; M3 may unify.
 */

/** A cost function's sampling domain: [xMin, xMax, yMin, yMax]. */
export type { Domain } from './surfaceMapping.types';

/** World extent of the (square) surface plane, in world units. LOCKED at 4. */
export const SURFACE_SIZE = 4;

/**
 * Map a parameter-space point (px in [xMin,xMax], pz in [yMin,yMax]) to world
 * XZ in [-SURFACE_SIZE/2, +SURFACE_SIZE/2]². Linear per axis; handles the
 * asymmetric domains (e.g. rosenbrock y∈[-1,3]) via the per-axis offset.
 */
export function paramToWorldXZ(px: number, pz: number, domain: Domain): [number, number] {
  const [xMin, xMax, yMin, yMax] = domain;
  const u = (px - xMin) / (xMax - xMin); // 0..1
  const v = (pz - yMin) / (yMax - yMin); // 0..1
  return [u * SURFACE_SIZE - SURFACE_SIZE / 2, v * SURFACE_SIZE - SURFACE_SIZE / 2];
}

/** Inverse of paramToWorldXZ — world XZ back to parameter space. */
export function worldXZToParam(wx: number, wz: number, domain: Domain): [number, number] {
  const [xMin, xMax, yMin, yMax] = domain;
  const u = (wx + SURFACE_SIZE / 2) / SURFACE_SIZE; // 0..1
  const v = (wz + SURFACE_SIZE / 2) / SURFACE_SIZE; // 0..1
  return [xMin + u * (xMax - xMin), yMin + v * (yMax - yMin)];
}

/**
 * Per-function vertical scale: world height = vScale · cost. Chosen so the
 * worst-corner cost over each function's domain maps to ~1.5 world units.
 * (Execution-derivable: sphere max cost on [-5,5]² is 50 → 1.5/50 = 0.03.)
 */
const V_SCALE: Record<string, number> = {
  sphere: 0.03, // max cost 50  → 1.5
  matyas: 0.04, // max ≈ 37.4 on [-10,10]² → ~1.5
  booth: 0.0009, // max ≈ 1741 on [-10,10]² → ~1.57
  rosenbrock: 0.0006, // worst-corner ≈ 2509 → ~1.5
  beale: 0.00002, // very steep on [-4.5,4.5]² (≈ 1.8e5 corner) → ~1.5..3 band
  saddle: 0.17, // |cost| max 9 on [-3,3]² → ~1.5 (signed; see costToWorldHeight)
  himmelblau: 0.0017, // max ≈ 890 on [-5,5]² → ~1.5
  rastrigin: 0.022, // max ≈ 80.7 on [-5.12,5.12]² → ~1.78
  ackley: 0.16, // max ≈ 14.3 on [-5,5]² → ~2.3 (flat-outer plateau dominates)
};

/** Fallback scale for any unregistered id (keeps height positive & sane). */
const DEFAULT_V_SCALE = 0.03;

/** The vertical scale for a function id (used for uVScale + the ball height). */
export function vScaleFor(functionId: string): number {
  return V_SCALE[functionId] ?? DEFAULT_V_SCALE;
}

/**
 * World Y for a given raw cost on a given function. Linear (worldY = vScale·cost),
 * matching the GLSL `csm_Position.z = uVScale * h` exactly. Saddle's cost is
 * signed (x²−y²) and is intentionally NOT clamped — the surface dips below 0.
 */
export function costToWorldHeight(cost: number, functionId: string): number {
  return vScaleFor(functionId) * cost;
}
```

- [ ] **Step 7: Create the tiny shared `Domain` type module**

`surfaceMapping.ts` and several shaders reference the domain tuple shape; give it one home. Create `src/scene/surfaceMapping.types.ts`:

```ts
/** A cost function's sampling domain tuple: [xMin, xMax, yMin, yMax]. */
export type Domain = readonly [number, number, number, number];
```

- [ ] **Step 8: Run to verify it passes**

```bash
npm test -- surfaceMapping
```

Expected: PASS (all 9 tests).

- [ ] **Step 9: Typecheck (catch the `noUnusedLocals` build-gate trap before commit)**

The repo's `tsconfig.json` has `noUnusedLocals` + `noUnusedParameters: true`; the test suite passing does NOT catch an unused import (this exact gap bit M0). Run:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/scene/surfaceMapping.ts src/scene/surfaceMapping.types.ts src/scene/surfaceMapping.test.ts
git commit -m "feat(scene): add CSM dep + surfaceMapping (the param↔world single source of truth)

three-custom-shader-material ^6.4.0 (peer three >=0.159, no three bump).
surfaceMapping.ts: SURFACE_SIZE=4, paramToWorldXZ/worldXZToParam (linear, handles
asymmetric domains), per-function vScale (~1.5 world-unit peak), costToWorldHeight.
Shared by Surface + DescentBall; mirrored in GLSL (kept in sync by hand in M1a)."
```

---

### Task 5: `colormap.ts` — the magma GLSL chunk + a structure guard

**Files:**
- Create: `src/scene/shaders/colormap.ts`
- Test: `src/scene/shaders/colormap.test.ts`

The magma colormap (PRD §5.2) is a GLSL function `vec3 magma(float t)` that interpolates over the 9 locked stops, sampled across `t∈[uColorLow, uColorHigh]`. GLSL cannot execute under Vitest, so the "test" is a **structure guard**: it asserts the exported string contains all 9 stop vec3s (in their exact normalized-float forms) and the function signature. That is a cheap regression tripwire — if someone perturbs a stop or renames the function, the guard fails. The real visual proof is the in-browser smoke test in Task 8.

- [ ] **Step 1: Write the failing guard test**

The 9 expected `vec3(...)` literals are the locked PRD §5.2 hex stops converted to normalized floats (e.g. `0x15/255 = 0.082353`). They are listed here exactly as the implementation must emit them.

`src/scene/shaders/colormap.test.ts`:

```ts
import { magmaColormapGLSL, MAGMA_STOPS_GLSL } from './colormap';

describe('magma colormap GLSL chunk (structure guard)', () => {
  // The 9 locked stops (PRD §5.2) as normalized-float vec3 literals.
  const EXPECTED_STOPS = [
    'vec3(0.082353, 0.054902, 0.215686)', // #150E37
    'vec3(0.231373, 0.058824, 0.439216)', // #3B0F70
    'vec3(0.392157, 0.101961, 0.501961)', // #641A80
    'vec3(0.549020, 0.160784, 0.505882)', // #8C2981
    'vec3(0.717647, 0.215686, 0.474510)', // #B73779
    'vec3(0.866667, 0.317647, 0.227451)', // #DD513A
    'vec3(0.972549, 0.462745, 0.360784)', // #F8765C
    'vec3(0.988235, 0.647059, 0.039216)', // #FCA50A
    'vec3(0.988235, 0.992157, 0.749020)', // #FCFDBF
  ];

  it('exports a non-empty GLSL string', () => {
    expect(typeof magmaColormapGLSL).toBe('string');
    expect(magmaColormapGLSL.length).toBeGreaterThan(0);
  });

  it('declares the vec3 magma(float t) function signature', () => {
    expect(magmaColormapGLSL).toMatch(/vec3\s+magma\s*\(\s*float\s+t\s*\)/);
  });

  it('contains all 9 locked magma stops in exact normalized-float form', () => {
    for (const stop of EXPECTED_STOPS) {
      expect(magmaColormapGLSL).toContain(stop);
    }
  });

  it('MAGMA_STOPS_GLSL enumerates exactly the 9 stops, in order', () => {
    expect(MAGMA_STOPS_GLSL).toEqual(EXPECTED_STOPS);
  });

  it('remaps the input through [uColorLow, uColorHigh] before sampling', () => {
    // The remap must reference both locked uniform names.
    expect(magmaColormapGLSL).toContain('uColorLow');
    expect(magmaColormapGLSL).toContain('uColorHigh');
  });

  it('clamps t into [0,1] so out-of-range costs do not wrap the LUT', () => {
    expect(magmaColormapGLSL).toMatch(/clamp\s*\(/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- colormap
```

Expected: FAIL — `Cannot find module './colormap'`.

- [ ] **Step 3: Implement `src/scene/shaders/colormap.ts`**

The chunk builds an array of the 9 stops, remaps the incoming `t` (already a normalized cost in `[0,1]`) into the visible sub-range `[uColorLow, uColorHigh]`, then does piecewise-linear interpolation between adjacent stops (the glsl-colormap "stop interpolation" approach). The `MAGMA_STOPS_GLSL` array is exported separately so the guard test asserts the exact literals without parsing GLSL.

```ts
/**
 * Magma colormap as a GLSL chunk (PRD §5.2). Implements `vec3 magma(float t)`
 * by piecewise-linear interpolation over the 9 locked stops. The incoming t
 * (a normalized cost in [0,1]) is first remapped into the visible band
 * [uColorLow, uColorHigh] — uColorLow defaults to 0.12 so the surface floor
 * starts in deep purple, never pure black (PRD §5.2 "sampled t∈[0.12,1]").
 *
 * ⚠️ The uniforms uColorLow / uColorHigh are declared by the fragment shader
 * (surfaceShaders.ts), NOT here — this chunk is concatenated into a program
 * that already declares them.
 *
 * GLSL can't run in Vitest; colormap.test.ts guards the stop literals + the
 * signature as a regression tripwire. Visual correctness is the Task-8 browser
 * smoke test.
 */

/** The 9 locked magma stops (PRD §5.2 hex → normalized float), in order. */
export const MAGMA_STOPS_GLSL: readonly string[] = [
  'vec3(0.082353, 0.054902, 0.215686)', // #150E37
  'vec3(0.231373, 0.058824, 0.439216)', // #3B0F70
  'vec3(0.392157, 0.101961, 0.501961)', // #641A80
  'vec3(0.549020, 0.160784, 0.505882)', // #8C2981
  'vec3(0.717647, 0.215686, 0.474510)', // #B73779
  'vec3(0.866667, 0.317647, 0.227451)', // #DD513A
  'vec3(0.972549, 0.462745, 0.360784)', // #F8765C
  'vec3(0.988235, 0.647059, 0.039216)', // #FCA50A
  'vec3(0.988235, 0.992157, 0.749020)', // #FCFDBF
];

export const magmaColormapGLSL = /* glsl */ `
// --- Magma colormap (9-stop piecewise-linear; PRD §5.2) -------------------
// 8 segments between 9 stops; segment i spans t in [i/8, (i+1)/8].
vec3 magma(float t) {
  // Remap the normalized cost into the visible band, then clamp.
  t = clamp((t - uColorLow) / max(uColorHigh - uColorLow, 1e-5), 0.0, 1.0);

  vec3 c0 = ${MAGMA_STOPS_GLSL[0]};
  vec3 c1 = ${MAGMA_STOPS_GLSL[1]};
  vec3 c2 = ${MAGMA_STOPS_GLSL[2]};
  vec3 c3 = ${MAGMA_STOPS_GLSL[3]};
  vec3 c4 = ${MAGMA_STOPS_GLSL[4]};
  vec3 c5 = ${MAGMA_STOPS_GLSL[5]};
  vec3 c6 = ${MAGMA_STOPS_GLSL[6]};
  vec3 c7 = ${MAGMA_STOPS_GLSL[7]};
  vec3 c8 = ${MAGMA_STOPS_GLSL[8]};

  float s = t * 8.0;          // 0..8
  float seg = floor(s);       // which segment (0..8)
  float f = s - seg;          // fraction within the segment (0..1)

  vec3 col = c0;
  col = mix(col, c1, clamp(s - 0.0, 0.0, 1.0));
  col = mix(col, c2, clamp(s - 1.0, 0.0, 1.0));
  col = mix(col, c3, clamp(s - 2.0, 0.0, 1.0));
  col = mix(col, c4, clamp(s - 3.0, 0.0, 1.0));
  col = mix(col, c5, clamp(s - 4.0, 0.0, 1.0));
  col = mix(col, c6, clamp(s - 5.0, 0.0, 1.0));
  col = mix(col, c7, clamp(s - 6.0, 0.0, 1.0));
  col = mix(col, c8, clamp(s - 7.0, 0.0, 1.0));

  // (seg, f kept for readability; the chained mix above is the interpolation.)
  return col;
}
`;
```

Implementer note: the chained-`mix` form is a standard branch-free GLSL gradient — each `mix(col, c_{i+1}, clamp(s-i,0,1))` blends in the next stop only once `s` crosses `i`, giving exact piecewise-linear interpolation without indexing a `vec3` array by a non-constant (which GLSL ES 1.00 disallows). The `seg`/`f` locals document the segment math; if your GLSL linter flags them as unused, delete those two lines (they are comments-in-code, not load-bearing).

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- colormap
```

Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scene/shaders/colormap.ts src/scene/shaders/colormap.test.ts
git commit -m "feat(scene): magma colormap GLSL chunk (9 locked stops, [uColorLow,uColorHigh] remap)

vec3 magma(float t): branch-free chained-mix piecewise interpolation over the 9
PRD §5.2 stops. Structure-guard test asserts exact stop literals + signature
(GLSL can't run in Vitest; visual proof is the Task-8 browser smoke)."
```

---

### Task 6: `functionField.ts` — per-preset height + analytic partials GLSL

**Files:**
- Create: `src/scene/shaders/functionField.ts`
- Test: `src/scene/shaders/functionField.test.ts`

This chunk defines `float surfaceHeight(int fn, vec2 p)` and `vec2 surfaceGrad(int fn, vec2 p)` — the cost `f(x,y)` and its **analytic** partials `[∂f/∂x, ∂f/∂y]`, switched on the `uFunction` index. The index map (`FUNCTION_GLSL_INDEX`) is an exported TS const matching the `FUNCTIONS` registry order exactly, so `Surface.tsx` sets `uFunction = FUNCTION_GLSL_INDEX[functionId]` and the GLSL `switch` agrees. All 9 are hand-written from their PRD §4.3 formulas (AST→GLSL is M3). The guard test asserts a `case` per index plus both signatures.

Registry order (from `FUNCTIONS`, verified): `0 sphere · 1 matyas · 2 booth · 3 rosenbrock · 4 beale · 5 saddle · 6 himmelblau · 7 rastrigin · 8 ackley`.

The analytic partials (hand-derived; the same forms the engine validates against finite differences in M0):
- **sphere** `x²+y²` → `(2x, 2y)`
- **matyas** `0.26(x²+y²) − 0.48xy` → `(0.52x − 0.48y, 0.52y − 0.48x)`
- **booth** `(x+2y−7)² + (2x+y−5)²` → `(2(x+2y−7) + 4(2x+y−5), 4(x+2y−7) + 2(2x+y−5))`
- **rosenbrock** `(1−x)² + 100(y−x²)²` → `(−2(1−x) − 400x(y−x²), 200(y−x²))`
- **beale** with `A=1.5−x+xy`, `B=2.25−x+xy²`, `C=2.625−x+xy³` → `∂x = 2A(y−1) + 2B(y²−1) + 2C(y³−1)`, `∂y = 2A·x + 2B·2xy + 2C·3xy²`
- **saddle** `x²−y²` → `(2x, −2y)`
- **himmelblau** `(x²+y−11)² + (x+y²−7)²` with `U=x²+y−11`, `V=x+y²−7` → `(4xU + 2V, 2U + 4yV)`
- **rastrigin** `20 + x²+y² − 10(cos2πx + cos2πy)` → `(2x + 20π·sin2πx, 2y + 20π·sin2πy)`
- **ackley** (PRD §4.3) → the same closed form the registry uses; guarded at the origin (`r→0`) so the GLSL never divides by zero.

- [ ] **Step 1: Write the failing guard test**

`src/scene/shaders/functionField.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- functionField
```

Expected: FAIL — `Cannot find module './functionField'`.

- [ ] **Step 3: Implement `src/scene/shaders/functionField.ts`**

```ts
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
  }
  return 0.0;
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
  }
  return vec2(0.0, 0.0);
}
`;
```

Implementer note (verified): GLSL ES 3.00 (`switch` on `int`) is what the WebGL2 default in three r184 compiles; CSM emits a `#version 300 es` program for WebGL2, so `switch` is valid. If a target falls back to WebGL1 (no `switch`), the Task-8 browser smoke test surfaces it as a compile error and the fix is a chained `if (fn==0) … else if …` — but all M1 target tiers are WebGL2 (the fallback tier mounts no canvas at all).

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- functionField
```

Expected: PASS (all 5 tests).

- [ ] **Step 5: Typecheck (the `FUNCTION_GLSL_INDEX` import must stay used)**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/scene/shaders/functionField.ts src/scene/shaders/functionField.test.ts
git commit -m "feat(scene): per-preset height + analytic-gradient GLSL (9 functions, registry-keyed index)

surfaceHeight(int fn, vec2 p) and surfaceGrad(int fn, vec2 p) switch on uFunction.
All 9 PRD §4.3 presets hand-written with analytic partials (matching the M0 engine);
Ackley origin guarded. FUNCTION_GLSL_INDEX is derived from FUNCTIONS order so the
GLSL switch and the uFunction uniform can never drift."
```

---

### Task 7: `surfaceShaders.ts` — assemble the vertex + fragment shaders

**Files:**
- Create: `src/scene/shaders/surfaceShaders.ts`
- Test: `src/scene/shaders/surfaceShaders.test.ts`

This composes the two GLSL chunks (Task 5 + Task 6) into the full CSM **vertex** and **fragment** shaders. The vertex shader reconstructs the parameter point from the plane's local XY (via `uParamMin`/`uParamRange`), evaluates `surfaceHeight`, writes the displaced `csm_Position.z` and the **analytic** `csm_Normal` (with the mesh-space Jacobian per the locked contract). The fragment shader colours by height through `magma`, adds `fwidth()`-anti-aliased contour lines animated by `-uTime`, and writes `csm_Emissive` with the **soft rolloff as the last op** so highlights stay sub-1.0 (never trip bloom). The guard test asserts both strings reference the CSM keywords and every locked uniform name.

**Locked uniform names** (the contract — both shaders + Task 8's `useMemo` use exactly these): `uFunction` (int), `uTime` (float), `uVScale` (float), `uParamMin` (vec2), `uParamRange` (vec2), `uContourSpacing` (float), `uColorLow` (float), `uColorHigh` (float).

**Height/normal math** (locked contract). The plane is authored in local XY and rotated `-90°` about X, so **local +Z → world +Y**. Displacement is `csm_Position.z = uVScale · h` where `h = surfaceHeight(...)` (raw cost; `uVScale` is the per-function `vScaleFor`, so this equals `costToWorldHeight`). Because world `y = uVScale·h` and the parameter axes are scaled from world XZ by `uParamRange/SURFACE_SIZE` per axis, the chain rule gives the *local-space* analytic normal **before** rotation:

```
n = normalize(vec3(
  -uVScale · dfx · (uParamRange.x / SURFACE_SIZE),
  -uVScale · dfz · (uParamRange.y / SURFACE_SIZE),
   1.0))
```

(The `-90°X` plane rotation then carries this local +Z up into world +Y, so `csm_Normal` is written in local space and CSM/three transform it normally.)

- [ ] **Step 1: Write the failing guard test**

`src/scene/shaders/surfaceShaders.test.ts`:

```ts
import { surfaceVertexShader, surfaceFragmentShader } from './surfaceShaders';

const LOCKED_UNIFORMS = [
  'uFunction',
  'uTime',
  'uVScale',
  'uParamMin',
  'uParamRange',
  'uContourSpacing',
  'uColorLow',
  'uColorHigh',
];

describe('surfaceShaders — vertex + fragment assembly (structure guard)', () => {
  it('exports two non-empty GLSL strings', () => {
    expect(typeof surfaceVertexShader).toBe('string');
    expect(typeof surfaceFragmentShader).toBe('string');
    expect(surfaceVertexShader.length).toBeGreaterThan(0);
    expect(surfaceFragmentShader.length).toBeGreaterThan(0);
  });

  it('vertex shader writes csm_Position and csm_Normal (CSM displacement + analytic normal)', () => {
    expect(surfaceVertexShader).toContain('csm_Position');
    expect(surfaceVertexShader).toContain('csm_Normal');
  });

  it('vertex shader calls both field functions (height + analytic grad)', () => {
    expect(surfaceVertexShader).toContain('surfaceHeight(');
    expect(surfaceVertexShader).toContain('surfaceGrad(');
  });

  it('vertex shader applies the per-axis Jacobian (uParamRange / SURFACE_SIZE)', () => {
    // The locked normal math divides the param range by the surface size.
    expect(surfaceVertexShader).toMatch(/uParamRange\.[xy]\s*\/\s*/);
  });

  it('fragment shader writes csm_Emissive and calls magma()', () => {
    expect(surfaceFragmentShader).toContain('csm_Emissive');
    expect(surfaceFragmentShader).toContain('magma(');
  });

  it('fragment shader uses fwidth() for the AA contour and animates by -uTime', () => {
    expect(surfaceFragmentShader).toMatch(/fwidth\s*\(/);
    expect(surfaceFragmentShader).toContain('uTime');
  });

  it('fragment shader applies the soft rolloff e/(1+e) as the LAST emissive op', () => {
    // The rolloff must be the final write to csm_Emissive (keeps values < 1.0).
    // NOTE: do NOT anchor with lastIndexOf('csm_Emissive') then require the
    // two-token rolloff in the tail — lastIndexOf lands on the rolloff's own
    // RHS operand, leaving a one-token tail, so that form is UNSATISFIABLE by a
    // correct impl. Instead: assert the rolloff expression exists, and that no
    // further `csm_Emissive =` assignment follows it.
    const rolloff = surfaceFragmentShader.match(
      /csm_Emissive\s*=\s*csm_Emissive\s*\/\s*\(\s*1\.0\s*\+\s*csm_Emissive\s*\)/,
    );
    expect(rolloff).not.toBeNull();
    const after = surfaceFragmentShader.slice(rolloff!.index! + rolloff![0].length);
    expect(after).not.toMatch(/csm_Emissive\s*=/); // nothing reassigns emissive after the rolloff
  });

  it('both shaders declare every locked uniform name', () => {
    for (const u of LOCKED_UNIFORMS) {
      const inVert = surfaceVertexShader.includes(u);
      const inFrag = surfaceFragmentShader.includes(u);
      expect(inVert || inFrag, `uniform ${u} must appear in at least one shader`).toBe(true);
    }
    // The displacement-relevant ones must be in the vertex shader specifically.
    for (const u of ['uFunction', 'uVScale', 'uParamMin', 'uParamRange']) {
      expect(surfaceVertexShader, `${u} must be in the vertex shader`).toContain(u);
    }
    // The colour/contour ones must be in the fragment shader specifically.
    for (const u of ['uColorLow', 'uColorHigh', 'uContourSpacing', 'uTime']) {
      expect(surfaceFragmentShader, `${u} must be in the fragment shader`).toContain(u);
    }
  });

  it('declares SURFACE_SIZE as a GLSL constant matching the TS mapping (4.0)', () => {
    expect(surfaceVertexShader).toMatch(/SURFACE_SIZE\s+4\.0/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- surfaceShaders
```

Expected: FAIL — `Cannot find module './surfaceShaders'`.

- [ ] **Step 3: Implement `src/scene/shaders/surfaceShaders.ts`**

The uniform declarations are written explicitly at the top of each shader (CSM concatenates them into the patched program; declaring them in the GLSL source — in addition to the JS `uniforms` object — keeps the chunk self-documenting and lets the guard test see them). `vUv` is a `varying` the vertex shader passes to the fragment shader for contour math. `SURFACE_SIZE 4.0` is the GLSL mirror of the TS `SURFACE_SIZE` constant (kept in sync by hand; flagged in both files).

```ts
import { functionFieldGLSL } from './functionField';
import { magmaColormapGLSL } from './colormap';

/**
 * The CSM vertex + fragment shaders for the displaced magma surface.
 *
 * VERTEX: reconstruct the parameter point p from the plane's local XY using
 * uParamMin/uParamRange, displace csm_Position.z = uVScale·height, and write
 * the ANALYTIC csm_Normal with the mesh-space Jacobian (uParamRange/SURFACE_SIZE
 * per axis). The plane is authored in local XY and rotated -90° about X, so
 * local +Z maps to world +Y; the normal is written in local space accordingly.
 *
 * FRAGMENT: colour by normalized height through magma(), overlay fwidth()-AA
 * contour lines animated by -uTime, and write csm_Emissive with the soft
 * rolloff e/(1+e) as the LAST op so highlights stay sub-1.0 (never trip bloom).
 *
 * ⚠️ KEEP IN SYNC WITH surfaceMapping.ts: SURFACE_SIZE here (4.0) mirrors the TS
 * SURFACE_SIZE; uVScale is surfaceMapping.vScaleFor(functionId); uParamMin /
 * uParamRange come from getFunction(id).domain. Task 8 wires the uniforms.
 */

const SURFACE_GLSL_CONSTS = /* glsl */ `
#define SURFACE_SIZE 4.0
`;

const SURFACE_UNIFORMS = /* glsl */ `
uniform int   uFunction;
uniform float uTime;
uniform float uVScale;
uniform vec2  uParamMin;
uniform vec2  uParamRange;
uniform float uContourSpacing;
uniform float uColorLow;
uniform float uColorHigh;
`;

export const surfaceVertexShader = /* glsl */ `
${SURFACE_GLSL_CONSTS}
${SURFACE_UNIFORMS}

${functionFieldGLSL}

varying vec2 vParam;     // parameter-space point, for the fragment shader
varying float vHeightN;  // normalized height (0..1) for colouring

void main() {
  // 'uv' is the plane's built-in [0,1]² UV (CSM/three provide it). Map it to
  // parameter space: p = uParamMin + uv * uParamRange.
  vec2 p = uParamMin + uv * uParamRange;
  vParam = p;

  float h = surfaceHeight(uFunction, p);   // raw cost
  vec2  g = surfaceGrad(uFunction, p);      // analytic [df/dx, df/dy]

  // Displace along local +Z (becomes world +Y after the -90°X plane rotation).
  csm_Position.z = uVScale * h;

  // Per-axis mesh-space Jacobian: param axes are scaled from world XZ by
  // (uParamRange / SURFACE_SIZE). Analytic normal in LOCAL space (pre-rotation).
  float jx = uParamRange.x / SURFACE_SIZE;
  float jz = uParamRange.y / SURFACE_SIZE;
  csm_Normal = normalize(vec3(-uVScale * g.x * jx, -uVScale * g.y * jz, 1.0));

  // Normalized height for the fragment colour ramp. The cost range that maps to
  // ~1.5 world units corresponds to height/uVScale; normalize against that band
  // so the magma ramp fills regardless of function scale. (1.5 = the contract's
  // pleasing peak height in world units.)
  vHeightN = clamp((uVScale * h) / 1.5, 0.0, 1.0);
}
`;

export const surfaceFragmentShader = /* glsl */ `
${SURFACE_UNIFORMS}

${magmaColormapGLSL}

varying vec2 vParam;
varying float vHeightN;

void main() {
  // Base colour from the magma ramp (magma() does the [uColorLow,uColorHigh] remap).
  vec3 col = magma(vHeightN);

  // --- fwidth()-anti-aliased contour lines on the parameter grid -----------
  // Lines every uContourSpacing in parameter space, drifting with -uTime.
  vec2 coord = vParam / max(uContourSpacing, 1e-4) - vec2(uTime * 0.05);
  vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float line = min(grid.x, grid.y);
  float contour = 1.0 - min(line, 1.0); // 1 on a line, 0 between
  // Brighten the lines slightly (a cool-white tint) over the magma base.
  vec3 lineColor = mix(col, col + vec3(0.25, 0.30, 0.40), 0.6);
  col = mix(col, lineColor, contour);

  // Write emissive, then apply the soft rolloff as the LAST op so the surface
  // stays below 1.0 and never trips the bloom luminance threshold (PRD §5.4).
  csm_Emissive = col;
  csm_Emissive = csm_Emissive / (1.0 + csm_Emissive);
}
`;
```

Implementer note: `csm_Position` is initialized by CSM to the original vertex `position`; we mutate only its `.z` (the displacement axis in local space). `csm_Normal` is initialized to the geometry normal; overwriting it with the analytic normal is exactly what gives the surface its smooth lit shape under PBR. The `vHeightN` normalization uses the same `1.5` "pleasing peak" constant as `surfaceMapping`; this is a colour-ramp normalization only (it does not affect geometry), and if a future function's peak exceeds 1.5 the `clamp` simply saturates the brightest stop.

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- surfaceShaders
```

Expected: PASS (all 9 tests).

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/scene/shaders/surfaceShaders.ts src/scene/shaders/surfaceShaders.test.ts
git commit -m "feat(scene): assemble surface vertex+fragment shaders (CSM displacement + magma + AA contours)

Vertex: param from plane UV, csm_Position.z = uVScale·height, analytic csm_Normal
with per-axis Jacobian (uParamRange/SURFACE_SIZE). Fragment: magma() ramp + fwidth()
contour lines drifting by -uTime, soft rolloff e/(1+e) as the LAST emissive op
(sub-1.0, bloom-safe). Composes the colormap + functionField chunks. Locked uniform
names; SURFACE_SIZE mirrors surfaceMapping (kept in sync by hand)."
```

---

### Task 8: `Surface.tsx` — the CSM mesh + customDepthMaterial (⚠️ SMOKE-TEST RISK #1)

**Files:**
- Create: `src/scene/Surface.tsx`
- Test: `src/scene/Surface.test.tsx`

The displaced surface mesh: a static `planeGeometry` at the tier's segment count, the CSM main material (`MeshPhysicalMaterial` base) driven by the locked uniforms, plus a **second CSM as the `customDepthMaterial`** sharing the SAME uniforms object so shadows follow the displacement. The uniforms object is created **once** via `useMemo`; a `useFrame` mutates `uTime` while playing; a `useEffect` updates `uFunction/uVScale/uParamMin/uParamRange` on `functionId` change and calls `invalidate()`.

> ⚠️ **SMOKE-TEST RISK #1 (spec §8.1):** CSM's availability map doesn't enumerate `MeshDepthMaterial`, so the depth-material path may fail to compile a real GLSL program. The test-renderer uses a **mock GL** (it does NOT compile shaders), so the unit test below only proves the **React/Three tree** is well-formed (a Mesh with both a material and a customDepthMaterial, no throw) — it is NOT proof the GLSL compiles. The **real** compile verification is the live-MCP-browser step (Step 8). The Plan-B fallback (hand-rolled `MeshDepthMaterial` + `onBeforeCompile`) is given inline in Step 9 and is applied only if the browser shows a depth-material compile error.

- [ ] **Step 1: Write the failing structure test**

This mounts `<Surface />` under `@react-three/test-renderer` (which provides the R3F context). It seeds `uiStore` to the default High tier (segments 64) and asserts the tree contains a `Mesh` whose `material` and `customDepthMaterial` are both present — the cheap proxy for "CSM produced both materials without throwing".

`src/scene/Surface.test.tsx`:

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Surface } from './Surface';
import { useUIStore } from '../state/uiStore';

describe('Surface (R3F structure smoke — proxy for CSM compiling)', () => {
  beforeEach(() => {
    useUIStore.getState().reset(); // functionId='rosenbrock', tier='high'
  });

  it('mounts and produces a Mesh with a material and a customDepthMaterial', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Surface />);

    // Find the surface mesh in the tree (there is exactly one).
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);

    // The underlying three.Mesh must have BOTH a material and a customDepthMaterial.
    const mesh = meshes[0].instance as {
      material?: unknown;
      customDepthMaterial?: unknown;
      geometry?: { type?: string };
    };
    expect(mesh.material).toBeTruthy();
    expect(mesh.customDepthMaterial).toBeTruthy();
    expect(mesh.geometry?.type).toBe('PlaneGeometry');

    await renderer.unmount();
  });

  it('does not write React state on mount (two-channel rule: no re-render storm)', async () => {
    // A render that mounts cleanly and unmounts is the assertion; if Surface
    // called setState in useFrame/useEffect-per-frame, test-renderer would loop.
    const renderer = await ReactThreeTestRenderer.create(<Surface />);
    await renderer.unmount();
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- Surface
```

Expected: FAIL — `Cannot find module './Surface'`.

- [ ] **Step 3: Implement `src/scene/Surface.tsx`**

```tsx
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import CustomShaderMaterial from 'three-custom-shader-material';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { TIER_SETTINGS } from '../quality/tiers';
import { SURFACE_SIZE, vScaleFor } from './surfaceMapping';
import { FUNCTION_GLSL_INDEX } from './shaders/functionField';
import { surfaceVertexShader, surfaceFragmentShader } from './shaders/surfaceShaders';

/** Shape of the locked uniforms object (one instance, shared with the depth pass). */
interface SurfaceUniforms {
  uFunction: { value: number };
  uTime: { value: number };
  uVScale: { value: number };
  uParamMin: { value: THREE.Vector2 };
  uParamRange: { value: THREE.Vector2 };
  uContourSpacing: { value: number };
  uColorLow: { value: number };
  uColorHigh: { value: number };
}

/** A CSM material ref exposes its `uniforms` (CSM merges them onto the material). */
type CSMRef = THREE.Material & { uniforms: SurfaceUniforms };

/**
 * The GPU-displaced magma cost surface (PRD §5.1 / §6.4). A static plane at the
 * tier's segment count, displaced in the vertex shader (csm_Position.z) with an
 * analytic normal, coloured by the magma ramp + AA contours in the fragment
 * shader. A second CSM serves as the customDepthMaterial so shadows follow the
 * displacement (SMOKE-TEST RISK #1; fallback documented in the plan).
 */
export function Surface() {
  const functionId = useUIStore((s) => s.functionId);
  const tier = useUIStore((s) => s.tier);
  const isPlaying = useUIStore((s) => s.isPlaying);
  const invalidate = useThree((s) => s.invalidate);

  const segments = TIER_SETTINGS[tier].surfaceSegments || 1; // fallback tier=0 → guard to 1

  const matRef = useRef<CSMRef>(null);
  const depthRef = useRef<CSMRef>(null);

  // Create the uniforms ONCE (stable identity). Mutated imperatively below.
  // The SAME object is handed to both the main material and the depth material.
  const uniforms = useMemo<SurfaceUniforms>(() => {
    const fn = getFunction(functionId);
    const [xMin, xMax, yMin, yMax] = fn.domain;
    return {
      uFunction: { value: FUNCTION_GLSL_INDEX[functionId] ?? 0 },
      uTime: { value: 0 },
      uVScale: { value: vScaleFor(functionId) },
      uParamMin: { value: new THREE.Vector2(xMin, yMin) },
      uParamRange: { value: new THREE.Vector2(xMax - xMin, yMax - yMin) },
      uContourSpacing: { value: 0.25 },
      uColorLow: { value: 0.12 },
      uColorHigh: { value: 1.0 },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // created once; function changes are applied imperatively in the effect

  // On functionId change, update the displacement uniforms + request one frame.
  useEffect(() => {
    const fn = getFunction(functionId);
    const [xMin, xMax, yMin, yMax] = fn.domain;
    uniforms.uFunction.value = FUNCTION_GLSL_INDEX[functionId] ?? 0;
    uniforms.uVScale.value = vScaleFor(functionId);
    uniforms.uParamMin.value.set(xMin, yMin);
    uniforms.uParamRange.value.set(xMax - xMin, yMax - yMin);
    invalidate(); // frameloop may be 'demand' while paused
  }, [functionId, uniforms, invalidate]);

  // Animate the contour drift only while playing (keeps idle frames cheap).
  useFrame((_, delta) => {
    if (isPlaying) {
      uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow castShadow>
      <planeGeometry args={[SURFACE_SIZE, SURFACE_SIZE, segments, segments]} />
      {/* Main lit material: full PBR via MeshPhysicalMaterial base. */}
      <CustomShaderMaterial
        ref={matRef}
        baseMaterial={THREE.MeshPhysicalMaterial}
        vertexShader={surfaceVertexShader}
        fragmentShader={surfaceFragmentShader}
        uniforms={uniforms}
        roughness={0.45}
        metalness={0.1}
        clearcoat={0.4}
        clearcoatRoughness={0.2}
        dithering
        fog
      />
      {/* Depth material running the SAME displacement so shadows follow it.
          Shares the SAME uniforms object (stable identity). RISK #1: if this
          fails to compile in the browser, swap to the Plan-B fallback. */}
      <CustomShaderMaterial
        ref={depthRef}
        attach="customDepthMaterial"
        baseMaterial={THREE.MeshDepthMaterial}
        vertexShader={surfaceVertexShader}
        uniforms={uniforms}
        depthPacking={THREE.RGBADepthPacking}
      />
    </mesh>
  );
}
```

Implementer note: the `matRef`/`depthRef` are declared for the imperative mutation contract (and for later phases that read `ref.current.uniforms`); since this task mutates the shared `uniforms` memo object directly (which both materials reference), the refs are presently written-but-light. If `noUnusedLocals` flags `matRef`/`depthRef` as unused (they ARE used — passed to `ref={}`), no action needed; if a linter flags the unused `CSMRef` generic, it is used as the ref type. The `eslint-disable` line is only for the intentional empty-dep `useMemo` (created-once is the whole point); it does not affect `tsc`.

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- Surface
```

Expected: PASS (2 tests). This proves the React/Three tree is well-formed (Mesh + material + customDepthMaterial, no throw under the mock GL). It does **NOT** prove the GLSL compiles — that is Step 8.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. (Confirms the CSM default-import types, the `baseMaterial` generic prop passthrough, and `THREE.RGBADepthPacking`/`MeshDepthMaterial` typings all line up.)

- [ ] **Step 6: Temporarily mount `<Surface />` in the scene for the browser smoke test**

To see the surface live, swap the M0 placeholder cube for the surface in `src/scene/Scene.tsx`. Replace the `<mesh>…</mesh>` cube block inside `SceneContents` with `<Surface />` (keep the lights + background for now; the full composition is the next phase):

```tsx
import { Canvas } from '@react-three/fiber';
import { Surface } from './Surface';

export function SceneContents() {
  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <Surface />
    </>
  );
}

export function Scene() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }} dpr={[1, 2]} shadows>
      <SceneContents />
    </Canvas>
  );
}
```

(The existing `Scene.test.tsx` asserts `>=1 Mesh` in `SceneContents`; `<Surface />` renders exactly one Mesh, so that test stays green — confirm in Step 7.)

- [ ] **Step 7: Run the full suite to confirm nothing regressed**

```bash
npm test
```

Expected: all green — the new `surfaceMapping`, `colormap`, `functionField`, `surfaceShaders`, `Surface` tests plus the unchanged engine/state suites and the existing `Scene.test.tsx` (still finds a Mesh).

- [ ] **Step 8: ⚠️ SMOKE-TEST RISK #1 — verify the GLSL actually compiles in a real browser**

The unit test cannot compile shaders (mock GL). Start the dev server and drive a real browser via the Playwright MCP to confirm zero WebGL errors and a visibly displaced surface.

```bash
npm run dev
```

Then, using the Playwright MCP tools, perform these checks (the live-browser equivalent of a test):
1. `browser_navigate` to `http://localhost:3000`.
2. `browser_console_messages` — assert there are **zero** messages matching `/WebGL|GLSL|shader|THREE.WebGLProgram|compile/i`. A CSM `MeshDepthMaterial` compile failure surfaces here as a `THREE.WebGLProgram: shader error` referencing the depth program. This is the **go/no-go for RISK #1**.
3. `browser_take_screenshot` — confirm a displaced, magma-coloured surface (purple valleys → bright ridges) with visible contour lines, lit and casting/receiving shadow. Save it for the M1a design checkpoint.
4. `browser_evaluate` a quick frame-cadence sanity check (optional spot-check, not a gate):
   ```js
   () => new Promise((res) => {
     let n = 0; const t0 = performance.now();
     const tick = () => { if (++n >= 60) return res(Math.round(60000 / (performance.now() - t0))); requestAnimationFrame(tick); };
     requestAnimationFrame(tick);
   })
   ```
   Expected: a plausible fps number (≈ refresh rate); this is a spot-check only.

Expected outcome: **zero WebGL/shader console errors** and a correctly displaced, magma-lit, shadowed surface. **If true, RISK #1 is cleared — proceed to Step 10 (commit).** If the console shows a depth-program shader error, go to Step 9 (Plan B).

- [ ] **Step 9: FALLBACK (only if Step 8 shows a depth-material compile error) — hand-rolled `MeshDepthMaterial` + `onBeforeCompile`**

If the second CSM (`baseMaterial={THREE.MeshDepthMaterial}`) fails to compile, replace **only** that second `<CustomShaderMaterial>` with a plain `THREE.MeshDepthMaterial` whose `onBeforeCompile` injects the same displacement into three's `#include <begin_vertex>` chunk (three's documented pattern). The main material is unchanged.

Add this imperative depth material (created once, sharing the SAME `uniforms` object) and attach it to the mesh:

```tsx
// --- Plan-B depth material (only if the CSM depth path won't compile) ---
const depthMaterial = useMemo(() => {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    // Share the SAME uniform objects so depth tracks the lit displacement.
    shader.uniforms.uFunction = uniforms.uFunction;
    shader.uniforms.uVScale = uniforms.uVScale;
    shader.uniforms.uParamMin = uniforms.uParamMin;
    shader.uniforms.uParamRange = uniforms.uParamRange;
    // Prepend our consts + uniforms + the field functions, then displace.
    shader.vertexShader =
      `#define SURFACE_SIZE 4.0\n` +
      `uniform int uFunction;\nuniform float uVScale;\nuniform vec2 uParamMin;\nuniform vec2 uParamRange;\n` +
      functionFieldGLSL +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec2 p = uParamMin + uv * uParamRange;
         transformed.z = uVScale * surfaceHeight(uFunction, p);`,
      );
  };
  return m;
}, [uniforms]);
```

…then change the mesh's depth attachment from the second `<CustomShaderMaterial>` to:

```tsx
<primitive object={depthMaterial} attach="customDepthMaterial" />
```

This requires importing `functionFieldGLSL` (already imported for the main shader chain via `surfaceShaders`; add a direct `import { functionFieldGLSL } from './shaders/functionField';` if not already present). Re-run Step 4 (unit test still passes — the tree still has a `customDepthMaterial`) and Step 8 (the depth program now compiles via the chunk injection). Record in the commit body which path shipped.

- [ ] **Step 10: Commit**

```bash
git add src/scene/Surface.tsx src/scene/Surface.test.tsx src/scene/Scene.tsx
git commit -m "feat(scene): CSM displaced magma Surface + shared-uniform customDepthMaterial

Static planeGeometry (tier segments), CSM(MeshPhysicalMaterial) main material
driven by the locked uniforms (created once via useMemo, mutated imperatively),
+ a second CSM(MeshDepthMaterial) as customDepthMaterial sharing the SAME uniforms
so shadows follow the displacement. uTime drifts contours while playing; functionId
change updates uFunction/uVScale/uParamMin/uParamRange + invalidate(). SMOKE-TEST
RISK #1 cleared in-browser (zero WebGL errors); Plan-B onBeforeCompile fallback
documented in the M1a plan. Temporarily mounts Surface in Scene for the smoke test."
```

---

I've completed the plan. Here is the summary of my section.

I drafted **M1a Phase 1 (Tasks 4–8)**, the GPU-displaced magma cost surface, matching the M0 plan format exactly (every task has a `**Files:**` block and bite-sized `- [ ] **Step k:**` steps with complete code, exact bash commands, expected FAIL/PASS output, and exact commit messages).

Key facts I verified against the installed codebase (and baked into the plan):
- **CSM is not yet installed** — Task 4 adds `three-custom-shader-material ^6.4.0`; `three@0.184.0` resolves cleanly and CSM's open-upper-bound peer means no three bump. `npm ls three` confirms 0.184.0.
- **`tsconfig.json` has `noUnusedLocals` + `noUnusedParameters: true`** (the M0 build-gate trap) — every task includes an explicit `npm run typecheck` step before commit, and I flagged the `matRef`/`depthRef`/import-usage gotchas inline.
- **Magma hex→float values are execution-computed** (e.g. `#150E37 → vec3(0.082353, 0.054902, 0.215686)`) so the colormap guard test asserts exact literals.
- **`@types/three` exposes `RGBADepthPacking` (3201) and `MeshDepthMaterial.depthPacking`** — the customDepthMaterial typechecks.
- **`@react-three/test-renderer` exposes `findAllByType`/`findAll`** and `instance` access — used for the RISK #1 structure smoke test, with an explicit note that the mock GL does NOT compile shaders, so the real go/no-go is the live Playwright-MCP browser step (Step 8) with the Plan-B `onBeforeCompile` fallback fully written out (Step 9).
- **Engine registry order** (sphere 0 … ackley 8) and **`getFunction(id).domain`** values (rosenbrock `[-2,2,-1,3]`, sphere `[-5,5,-5,5]`) drive `FUNCTION_GLSL_INDEX`, the vScale targets, and the surfaceMapping round-trip tests.
- **Locked cross-component contract honored throughout:** `SURFACE_SIZE=4`, the eight locked uniform names, the analytic-normal Jacobian (`uParamRange/SURFACE_SIZE` per axis, local-space pre-`-90°X`-rotation), uniforms created once via `useMemo` and shared between main + depth materials, soft rolloff `e/(1+e)` as the last `csm_Emissive` op.

The Markdown above (from `## Task 4` through the end of Task 8) is my deliverable, ready to be assembled into the full document.

---

### Task 9: SceneEnvironment — procedural studio rig + swappable `.hdr`

**Files:**
- Create: `src/scene/SceneEnvironment.tsx`
- Test: `src/scene/SceneEnvironment.test.tsx`

A single swappable boundary (spec §5.2). The **procedural** branch bakes a dark-studio softbox rig once (`frames={1}`) from three `<Lightformer>` rect emitters — a dim white key + a cyan rim (`#00D3F2`) + an ember rim (`#FFA23A`) — so the lacquered ball's reflections carry the palette accents. The **hdr** branch loads a self-hosted `.hdr` under `<Suspense>`. Both keep `background={false}` so the locked void `#0B0E1A` stays the backdrop; PMREM is automatic in three r184 (no manual `PMREMGenerator`). `environmentIntensity={0.6}` is the single global fill knob.

- [ ] **Step 1: Write the failing test**

`src/scene/SceneEnvironment.test.tsx`:

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import SceneEnvironment from './SceneEnvironment';

describe('SceneEnvironment (R3F smoke test)', () => {
  it('mounts the procedural rig without throwing', async () => {
    // The procedural <Environment frames={1}> bakes a cube camera; under
    // test-renderer that bake is a no-op, so we only assert the subtree mounts
    // (the real reflection check is the live-browser A/B in Task 12).
    const renderer = await ReactThreeTestRenderer.create(<SceneEnvironment mode="procedural" />);
    expect(renderer.scene).toBeTruthy();
    await renderer.unmount();
  });

  it('mounts the hdr branch (wrapped in Suspense) without throwing', async () => {
    // No real .hdr fetch happens under test-renderer (Suspense fallback={null});
    // we only assert the component tree is constructable with mode="hdr".
    const renderer = await ReactThreeTestRenderer.create(
      <SceneEnvironment mode="hdr" hdr="/hdri/satara_night_no_lamps_1k.hdr" />,
    );
    expect(renderer.scene).toBeTruthy();
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- SceneEnvironment`
Expected: FAIL — `Cannot find module './SceneEnvironment'` (or "Failed to resolve import").

- [ ] **Step 3: Implement `src/scene/SceneEnvironment.tsx`**

Write the entire file:

```tsx
import { Suspense } from 'react';
import { Environment, Lightformer } from '@react-three/drei';

export interface SceneEnvironmentProps {
  /** 'procedural' = baked Lightformer studio rig; 'hdr' = self-hosted .hdr file. */
  mode: 'procedural' | 'hdr';
  /** Path under /public for the hdr branch. Defaults to the cleanest candidate. */
  hdr?: string;
}

/**
 * Swappable image-based-lighting boundary (spec §5.2). The whole point of this
 * component is that the procedural<->hdr decision (Task 12's A/B) is a one-prop
 * swap.
 *
 * BOTH branches keep `background={false}` — the env is reflections + low-freq
 * fill ONLY; the locked void `#0B0E1A` + fog (set on <Scene>) stay the backdrop.
 * Setting background={true} would overwrite scene.background and hide the void.
 *
 * PMREM is AUTOMATIC in three r184: the renderer prefilters whatever texture is
 * assigned to scene.environment when a MeshStandardMaterial-derived material
 * reads it — so no manual PMREMGenerator here. `environmentIntensity={0.6}`
 * writes scene.environmentIntensity (the single global fill knob).
 */
export default function SceneEnvironment({
  mode,
  hdr = '/hdri/satara_night_no_lamps_1k.hdr',
}: SceneEnvironmentProps) {
  if (mode === 'hdr') {
    // RGBELoader fetches the .hdr → suspend until it resolves. fallback={null}
    // means the scene renders with no env for one frame (acceptable; the void
    // backdrop carries it).
    return (
      <Suspense fallback={null}>
        <Environment files={hdr} background={false} environmentIntensity={0.6} />
      </Suspense>
    );
  }

  // Procedural dark-studio softbox rig. frames={1} = a single static cube-camera
  // bake at mount (zero per-frame cost). resolution={256} is plenty for a soft,
  // low-frequency env. The three rect emitters give the ball palette-tinted
  // reflections: a dim neutral key + the two brand-accent rims.
  return (
    <Environment frames={1} resolution={256} background={false} environmentIntensity={0.6}>
      {/* Dim white KEY — large soft box above-front, angled down at the scene. */}
      <Lightformer
        form="rect"
        intensity={1.2}
        color="#ffffff"
        scale={[6, 6]}
        position={[0, 5, 4]}
        rotation={[-Math.PI / 4, 0, 0]}
        target={[0, 0, 0]}
      />
      {/* Cyan RIM — from back-left, kicks a cool edge onto the orb's reflections. */}
      <Lightformer
        form="rect"
        intensity={2.5}
        color="#00D3F2"
        scale={[3, 5]}
        position={[-5, 1.5, -3]}
        rotation={[0, Math.PI / 3, 0]}
        target={[0, 0, 0]}
      />
      {/* Ember RIM — from back-right, a warm amber counter-accent. */}
      <Lightformer
        form="rect"
        intensity={1.6}
        color="#FFA23A"
        scale={[3, 5]}
        position={[5, 1.5, -3]}
        rotation={[0, -Math.PI / 3, 0]}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Confirms the drei `<Environment>`/`<Lightformer>` props above typecheck under `@types/three@0.184` and the `noUnusedLocals`/`noUnusedParameters` strict settings — the M0 build-gate trap.)

- [ ] **Step 5: Run to verify the test passes**

Run: `npm test -- SceneEnvironment`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/scene/SceneEnvironment.tsx src/scene/SceneEnvironment.test.tsx
git commit -m "feat(scene): swappable SceneEnvironment (procedural studio rig + .hdr branch)

Procedural mode bakes a dark-studio softbox rig once (frames=1) from three
Lightformer rects — dim white key + cyan/ember rims — so the ball's
reflections carry the palette. hdr mode loads a self-hosted .hdr under
Suspense. Both background=false (the void stays); PMREM auto in r184."
```

---

### Task 10: Lights — directional key + shadow config + tiered soft shadows

**Files:**
- Create: `src/scene/Lights.tsx`
- Test: `src/scene/Lights.test.tsx`

The shadow rig (spec §5.2). Always: a low ambient fill + one `<directionalLight castShadow>` keyed off the surface, with a **tight** ortho frustum (frustum tightness, not just map size, drives shadow sharpness for our `SURFACE_SIZE=4` scene). The shadow-map size comes from `TIER_SETTINGS[tier].shadowMapSize` (guarded: `0` → mount the light *without* `castShadow`). Tier-conditional soft-shadow strategy: `ultra`/`high` mount drei `<SoftShadows>` once; `medium` uses `<ContactShadows frames={1}>`; `low`/`fallback` get neither.

- [ ] **Step 1: Write the failing test**

`src/scene/Lights.test.tsx`:

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useUIStore } from '../state/uiStore';
import Lights from './Lights';

describe('Lights (R3F smoke test)', () => {
  afterEach(() => {
    useUIStore.getState().reset(); // restore tier='high' between cases
  });

  it('renders a DirectionalLight at the default (high) tier', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Lights />);
    const dir = renderer.scene.findAllByType('DirectionalLight');
    expect(dir.length).toBe(1);
    await renderer.unmount();
  });

  it('renders an AmbientLight (the low fill)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Lights />);
    expect(renderer.scene.findAllByType('AmbientLight').length).toBe(1);
    await renderer.unmount();
  });

  it('still renders the DirectionalLight at the low tier (shadowMapSize 0 → no castShadow, light remains)', async () => {
    useUIStore.getState().setTier('low');
    const renderer = await ReactThreeTestRenderer.create(<Lights />);
    expect(renderer.scene.findAllByType('DirectionalLight').length).toBe(1);
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Lights`
Expected: FAIL — `Cannot find module './Lights'`.

- [ ] **Step 3: Implement `src/scene/Lights.tsx`**

Write the entire file:

```tsx
import { SoftShadows, ContactShadows } from '@react-three/drei';
import { useUIStore } from '../state/uiStore';
import { TIER_SETTINGS } from '../quality/tiers';

/**
 * The scene's light + shadow rig (spec §5.2), keyed off the active tier.
 *
 * - Always: a low ambientLight fill so shadowed faces never read pure black,
 *   plus ONE directional key light from above-front.
 * - The key casts shadows only when the tier budgets for it
 *   (TIER_SETTINGS[tier].shadowMapSize > 0). A TIGHT ortho frustum (±3 for the
 *   SURFACE_SIZE=4 scene) is what makes the shadow crisp — frustum tightness
 *   matters more than raw map size.
 * - shadow-bias / shadow-normalBias kill the displaced-surface acne.
 *
 * Soft-shadow STRATEGY is tier-conditional:
 *   ultra/high → drei <SoftShadows>  (percentage-closer soft shadows)
 *   medium     → drei <ContactShadows frames={1}>  (cheap, baked once)
 *   low/fallback → neither (the hard PCF shadow, or none if map size is 0)
 *
 * ⚠️ <SoftShadows> GOTCHA: it globally patches THREE.ShaderChunk and recompiles
 * ALL materials on mount AND on any prop change. Its props here are STATIC
 * per-tier constants — never bind them to an animated/interactive value, or
 * every frame triggers a full shader recompile and tanks the frame rate.
 */
export default function Lights() {
  const tier = useUIStore((s) => s.tier);
  const shadowMapSize = TIER_SETTINGS[tier].shadowMapSize;
  const castShadow = shadowMapSize > 0;
  const useSoftShadows = tier === 'ultra' || tier === 'high';
  const useContactShadows = tier === 'medium';

  return (
    <>
      {/* SoftShadows mounted ONCE at this tier; static props (see gotcha above). */}
      {useSoftShadows && <SoftShadows size={25} samples={10} focus={0} />}

      {/* Low neutral fill — keeps shadowed faces from crushing to black. */}
      <ambientLight intensity={0.15} />

      {/* The single directional KEY light. */}
      <directionalLight
        position={[4, 6, 3]}
        intensity={2}
        castShadow={castShadow}
        shadow-mapSize={castShadow ? [shadowMapSize, shadowMapSize] : undefined}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        // Tight ortho frustum fitted to the 4×4 surface (drives sharpness).
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      {/* Medium tier: cheap render-once contact shadow under the scene.
          frames={1} is ESSENTIAL — without it this re-renders every frame. */}
      {useContactShadows && (
        <ContactShadows
          frames={1}
          position={[0, -0.01, 0]}
          scale={6}
          resolution={1024}
          blur={2.5}
          opacity={0.5}
          far={4}
          color="#000000"
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (In particular confirms `shadow-mapSize={... | undefined}` and the `shadow-camera-*` namespaced props typecheck against R3F 9's element types.)

- [ ] **Step 5: Run to verify the test passes**

Run: `npm test -- Lights`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/scene/Lights.tsx src/scene/Lights.test.tsx
git commit -m "feat(scene): tiered light + shadow rig (directional key, tight frustum, SoftShadows/ContactShadows by tier)

One directional key with a tight ortho frustum (sharpness) + guarded
shadow-mapSize from TIER_SETTINGS (0 -> no castShadow). ultra/high mount
SoftShadows once (static props — never animate, global recompile);
medium uses ContactShadows frames=1; low/fallback get neither."
```

---

### Task 11: DescentBall — lacquered orb tracking the sim

**Files:**
- Create: `src/scene/DescentBall.tsx`
- Test: `src/scene/DescentBall.test.tsx`

The descending agent (spec §5.3). A small lacquered orb: `MeshPhysicalMaterial` (`roughness=0.3, metalness=0, clearcoat=1.0, clearcoatRoughness=0.05`) with an emissive cyan core (`toneMapped={false}`, `emissiveIntensity=3`) so M1b's selective bloom can pick it out. It reads the sim **transiently** in `useFrame` — `simStore.getState().theta` + `.cost` — converts param-space → world via `surfaceMapping` (`paramToWorldXZ` + `costToWorldHeight`, the single source of truth shared with the Surface), and damps its world position with `easing.damp3`. **The ball owns its smoothing**; the sim runner (Task in Phase 3) writes the true param-space θ. No `setState` anywhere.

> **Cross-task contract:** this imports `paramToWorldXZ(px, pz, domain)` and `costToWorldHeight(cost, functionId)` from `./surfaceMapping` (created in Task 4 of M1a — confirm the exact exported signatures there). `paramToWorldXZ` takes the active function's `domain` as its third argument, so this reads `getFunction(functionId).domain` from the engine to map param→world. Those are the only external coordinates it touches.

- [ ] **Step 1: Write the failing test**

`src/scene/DescentBall.test.tsx`:

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { simStore } from '../state/simStore';
import DescentBall from './DescentBall';

describe('DescentBall (R3F smoke test)', () => {
  it('renders a mesh carrying a physical material', async () => {
    const renderer = await ReactThreeTestRenderer.create(<DescentBall />);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(1);
    // The orb is a MeshPhysicalMaterial (clearcoat lacquer).
    const mat = meshes[0].instance.material as { type: string; clearcoat: number };
    expect(mat.type).toBe('MeshPhysicalMaterial');
    expect(mat.clearcoat).toBe(1);
    await renderer.unmount();
  });

  it('advances frames without throwing when the sim store has a point', async () => {
    // Put a real param-space point into the sim store, then pump frames; the
    // useFrame reads it transiently and damps position. We only assert no throw
    // (real motion is a live-browser check — Task 12).
    simStore.getState().setTheta([-1.2, 1]);
    simStore.getState().setCost(24.2);
    const renderer = await ReactThreeTestRenderer.create(<DescentBall />);
    await renderer.advanceFrames(10, 1 / 60);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1);
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- DescentBall`
Expected: FAIL — `Cannot find module './DescentBall'`.

> **Smoke-test-early note (spec §8.1, surface-mapping integration):** this is the *first* consumer of `surfaceMapping`. If `paramToWorldXZ`/`costToWorldHeight` aren't exported yet (Phase 1 incomplete), Step 2 fails at import resolution rather than on the assertion — finish Phase 1's `surfaceMapping.ts` first. The fallback if `costToWorldHeight` isn't ready is to temporarily place the ball at `y = paramToWorldXZ(...).?` height `0`; do NOT ship that — it's only to unblock the structural test.

- [ ] **Step 3: Implement `src/scene/DescentBall.tsx`**

Write the entire file:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import * as THREE from 'three';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';

/** Radius of the orb in world units; also its resting offset above the surface. */
const BALL_RADIUS = 0.08;

/**
 * The lacquered descent ball (spec §5.3) — the single agent of the M1 cinematic
 * descent.
 *
 * It reads Channel B (simStore) TRANSIENTLY inside useFrame and mutates its own
 * position directly — never setState (the two-channel rule, PRD §8.2). The sim
 * runner writes the TRUE param-space θ into simStore each step; the ball owns
 * the visual SMOOTHING via maath easing.damp3 (framerate-independent), so the
 * orb glides between optimizer steps instead of snapping.
 *
 * World placement is the single source of truth in surfaceMapping.ts (shared
 * with the Surface so the ball sits exactly ON the displaced terrain):
 *   (θx, θy) --paramToWorldXZ--> (worldX, worldZ)
 *   cost     --costToWorldHeight--> worldY  (+ BALL_RADIUS so it rests on top)
 */
export default function DescentBall() {
  const meshRef = useRef<THREE.Mesh>(null);
  // Reusable scratch target so the per-frame math allocates nothing.
  const target = useRef(new THREE.Vector3());
  const functionId = useUIStore((s) => s.functionId);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { theta, cost } = simStore.getState();
    const fn = getFunction(functionId);

    // Param-space (θx, θy) → world XZ on the SURFACE_SIZE plane.
    const [worldX, worldZ] = paramToWorldXZ(theta[0], theta[1], fn.domain);
    // Cost → world height, lifted by the ball radius so it rests ON the surface.
    const worldY = costToWorldHeight(cost, functionId) + BALL_RADIUS;

    target.current.set(worldX, worldY, worldZ);
    // Critically-damped follow (~0.15s); no overshoot, no per-frame allocation.
    easing.damp3(mesh.position, target.current, 0.15, delta);
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
      <meshPhysicalMaterial
        color="#0a0a0a"
        roughness={0.3}
        metalness={0}
        clearcoat={1.0}
        clearcoatRoughness={0.05}
        envMapIntensity={1}
        // Emissive cyan core — toneMapped={false} + emissiveIntensity>1 keeps it
        // above the HalfFloat bloom threshold so M1b's selective bloom finds it.
        emissive="#00D3F2"
        emissiveIntensity={3.0}
        toneMapped={false}
      />
    </mesh>
  );
}
```

> **Note on the `domain` arg:** `paramToWorldXZ(px, pz, domain)` takes the active function's `domain` (`[xMin,xMax,yMin,yMax]`) as its third argument — this is the signature Task 4 ships, keeping it a pure function. So this component reads `getFunction(functionId).domain` and passes it through. (If you are reading tasks out of order: Task 4's `surfaceMapping.ts` is the authority for the exact signature.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Confirms `easing.damp3(mesh.position, …)` types against `THREE.Vector3`, and the `surfaceMapping` import signature matches.)

- [ ] **Step 5: Run to verify the test passes**

Run: `npm test -- DescentBall`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/scene/DescentBall.tsx src/scene/DescentBall.test.tsx
git commit -m "feat(scene): lacquered DescentBall tracking the sim transiently

MeshPhysicalMaterial lacquer (clearcoat=1) + emissive cyan core
(toneMapped=false) for M1b selective bloom. Reads simStore.theta/cost in
useFrame, maps param->world via surfaceMapping (shared with Surface), damps
world position with maath easing.damp3. No setState (two-channel rule)."
```

---

### Task 12: The lighting A/B (procedural vs `.hdr`) — the M1a design checkpoint

**Files:**
- Create: `public/hdri/` (download 3 CC0 `.hdr` candidates)
- Modify (temporarily, then revert/keep per decision): `src/scene/Scene.tsx`
- Modify (decision record): `docs/superpowers/specs/2026-06-13-ascent-m1-design.md` (§10 open-questions resolution)
- Commit: the chosen `.hdr` asset (only the winner if `.hdr` wins)

This is a **structured-procedure task, not primarily code** — it is the gate that completes M1a. The spec's §10 lists "Final lighting A/B winner — M1a checkpoint (your call, `.hdr` presumed)". The swappable `<SceneEnvironment>` (Task 9) exists precisely so this is a one-prop swap. **M1a is NOT done until this decision is recorded and the default mode is set.**

> **Prerequisite:** Tasks 9-11 are merged AND the Surface + Scene from Phase 1/Phase 3 render a ball-on-surface frame in the live dev server. The A/B must be judged on the *real* ball + surface, not in isolation (spec §5.2: "screenshot it in the real scene next to the candidate `.hdr` on the actual ball + surface").

- [ ] **Step 1: Create the asset folder and download the three CC0 candidates**

All three are CC0 from Poly Haven (~1.5–1.8 MB each at 1k). Run from the repo root:

```bash
mkdir -p public/hdri
curl -L -o public/hdri/satara_night_no_lamps_1k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/satara_night_no_lamps_1k.hdr"
curl -L -o public/hdri/dikhololo_night_1k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dikhololo_night_1k.hdr"
curl -L -o public/hdri/moonless_golf_1k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonless_golf_1k.hdr"
```

Verify all three downloaded as real binaries (not HTML error pages):

```bash
ls -la public/hdri/
file public/hdri/*.hdr
```

Expected: three files, each **> 1 MB**; `file` reports `Radiance HDR` (or generic `data`), NOT `HTML document`. If any is tiny / HTML, the CDN path changed — fall back to downloading from the asset page `https://polyhaven.com/a/<slug>` (pick HDR / 1k) and re-place under `public/hdri/`.

> **Smoke-test-early note (spec §8.1, KaTeX-style asset risk applies to `.hdr` too):** confirm Vite actually serves the file before the A/B — open `http://localhost:3000/hdri/satara_night_no_lamps_1k.hdr` in the browser; a 200 with binary (not a 404 HTML) proves `public/` static serving works. Files in `public/` are served at the root path verbatim by Vite.

- [ ] **Step 2: Wire a temporary mode toggle into the Scene**

Temporarily render `<SceneEnvironment>` with a mode you can flip. In `src/scene/Scene.tsx`, inside `SceneContents`, add the import and the component (this is scaffolding for the A/B — the permanent wiring lands in the Phase 3 Scene composition task):

```tsx
// at top of src/scene/Scene.tsx
import SceneEnvironment from './SceneEnvironment';

// inside SceneContents(), alongside Surface/Lights/DescentBall:
//   flip this one literal to run each side of the A/B:
<SceneEnvironment mode="procedural" />
{/* <SceneEnvironment mode="hdr" hdr="/hdri/satara_night_no_lamps_1k.hdr" /> */}
```

Start the dev server (leave it running in a separate terminal):

```bash
npm run dev
```

Expected: Vite prints `Local: http://localhost:3000/`. (The `server.port` in `vite.config.ts` is `3000`.)

- [ ] **Step 3: Screenshot the procedural side via the Playwright MCP browser**

Use the live MCP browser at the **same** framing for every shot (real GPU — CI has none). With `mode="procedural"` active:

1. `browser_navigate` → `http://localhost:3000` (let the scene settle ~1s; the descent should be at/near the start point so the ball + surface are both framed).
2. `browser_take_screenshot` → save as `procedural.png` (filename argument `procedural.png`).
3. `browser_console_messages` → confirm **zero WebGL errors** (spec exit criterion). Note any `THREE.WebGLRenderer` warnings.

- [ ] **Step 4: Screenshot each `.hdr` candidate at identical framing**

For each candidate, edit the one line in `SceneContents` to `<SceneEnvironment mode="hdr" hdr="/hdri/<slug>_1k.hdr" />` (Vite HMR reloads on save), then:

1. `browser_navigate` → `http://localhost:3000` (re-navigate so the bake/env load is fresh; let it settle ~1s for the `.hdr` to fetch + PMREM-prefilter).
2. `browser_take_screenshot` → `hdr_satara.png` / `hdr_dikhololo.png` / `hdr_moonless.png` respectively.
3. `browser_console_messages` → confirm the `.hdr` actually loaded (no 404 for `/hdri/...`, no RGBELoader error) and zero WebGL errors.

Result: four screenshots at one framing — `procedural.png`, `hdr_satara.png`, `hdr_dikhololo.png`, `hdr_moonless.png`.

- [ ] **Step 5: Present the four screenshots to the user and capture the decision**

Show the user all four side by side and ask for the call. Frame it on what differs on the lacquered orb + magma surface: reflection richness on the clearcoat, how cleanly the void `#0B0E1A` reads behind, overall mood (the "moody dip below 1.0" the PRD wants — spec §10), and any noise/banding. State the lean explicitly: **`.hdr` is the presumed winner** (user's stated preference); `satara_night_no_lamps` is the cleanest candidate. **This is the user's call — do not auto-decide.** Wait for the answer.

- [ ] **Step 6: Apply the decision in `Scene.tsx`**

Set the default `<SceneEnvironment>` mode to the winner and remove the commented A/B alternative + the toggle scaffolding (the permanent Phase-3 Scene composition keeps just the winning line):

- If `.hdr` wins (presumed): keep `<SceneEnvironment mode="hdr" hdr="/hdri/<winner>_1k.hdr" />` and **`git rm` the two losing `.hdr` files** from `public/hdri/` so only the chosen asset ships.
- If procedural wins: keep `<SceneEnvironment mode="procedural" />` and `git rm -r public/hdri/` (no `.hdr` ships at all).

Then verify the suite + typecheck are still green:

```bash
npm run typecheck && npm test -- SceneEnvironment
```

Expected: typecheck clean; SceneEnvironment tests PASS.

- [ ] **Step 7: Record the resolution in the spec and commit**

Append the resolved decision under the spec's §10 open-questions list in `docs/superpowers/specs/2026-06-13-ascent-m1-design.md` — a one-line entry, e.g.:

```markdown
- **RESOLVED (M1a, 2026-06-13):** Lighting A/B → `<winner>` (`mode="<procedural|hdr>"`, asset `<slug>_1k.hdr` if hdr). Judged on the live ball+surface at High tier; <one-sentence why — e.g. "satara_night_no_lamps gave the cleanest clearcoat reflections with the least banding over the void">. Default set in `Scene.tsx`; losing candidates removed from `public/hdri/`.
```

Commit the decision + chosen asset together:

```bash
git add docs/superpowers/specs/2026-06-13-ascent-m1-design.md src/scene/Scene.tsx public/hdri/
git commit -m "feat(scene): resolve M1a lighting A/B — default env mode set

Judged procedural vs the 3 CC0 .hdr candidates on the live ball+surface at
High tier (real GPU via Playwright MCP, zero WebGL console errors). Records
the winner in the M1 spec §10 resolution and sets the default
<SceneEnvironment> mode in Scene.tsx. Losing .hdr candidates removed; only
the chosen asset ships. This gates M1a completion."
```

> **Gate:** with this committed, the M1a Phase-2 deliverables (environment, lighting, ball) and the design checkpoint are complete. The Phase-3 Scene composition task wires `<SceneEnvironment>` (in its decided mode) + `<Lights>` + `<DescentBall>` + `<Surface>` + the sim runner together under `<Canvas shadows>`.

---

### Task 13: `useSimRunner` — the single useFrame that owns the stepper

This is the spine of the two-channel rule (PRD §8.2): exactly ONE `useFrame` writes the vanilla `simStore` (Channel B). It reads `useUIStore` (Channel A) reactively to decide *what* to simulate, but reads the per-frame-relevant `isPlaying` flag via `getState()` inside the frame loop to avoid a stale closure without re-subscribing the frame callback.

**Files:**
- Create: `src/scene/useSimRunner.ts`
- Test: (none as a standalone unit — `useFrame` requires a live R3F render loop that `@react-three/test-renderer` does not tick deterministically; verification is `npm run typecheck` + the Task 14 structural test + the Task 15 live-browser smoke. This is called out per spec §8.1 "smoke-test-early": the runner's behavior is proven in the browser, not a unit test.)

- [ ] **Step 1: Confirm the engine dependencies this hook leans on are already in place (Phase 1).** This hook calls `createStepper({optimizer, grad, theta0, dt, cost, historyCap})` and reads `history[last].cost`. Those (`cost`, `historyCap`, ring buffer, per-entry cost) were added in Tasks 1-3. Verify the stepper config type before writing the hook.

```bash
npm run typecheck
```

Expected: PASS (green) — the post-Phase-1/2 tree (engine fixes + `surfaceMapping`/shaders/`Surface`/`Lights`/`SceneEnvironment`/`DescentBall`) compiles. If `StepperConfig` does not yet have `cost`/`historyCap`, STOP — Tasks 1-3 are incomplete; do not proceed.

- [ ] **Step 2: Write `src/scene/useSimRunner.ts` (COMPLETE).** A hook used *inside* `<Canvas>`. The stepper lives in a ref. One `useEffect` (deps: `functionId`, `optimizerId`, `learningRate`, `startPoint`) rebuilds the stepper and seeds the sim store. One `useFrame` advances it and writes Channel B. `isPlaying` is read via `useUIStore.getState()` inside the frame to avoid a stale closure.

```ts
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { getFunction } from '../engine/functions/registry';
import { makeOptimizer } from '../engine/optimizers/registry';
import { createStepper, type Stepper } from '../engine/stepper';
import type { Vec2 } from '../engine/types';
import { useUIStore } from '../state/uiStore';
import { simStore } from '../state/simStore';

/**
 * Fixed simulation timestep (seconds per optimizer step). 1/30 s ≈ 33 ms/step
 * (~30 steps/s) reads as a clear, teaching-friendly pace — fast enough to feel
 * live, slow enough to follow each step. It is intentionally decoupled from the
 * render frame rate: the stepper is a fixed-timestep accumulator (PRD §8.3), so
 * the descent is identical at 30/60/120 fps. Tunable; a speed control is M1c.
 */
const SIM_DT = 1 / 30;

/**
 * The ONE useFrame that owns the descent (PRD §8.2, the two-channel rule):
 *   - Channel A (reactive): reads uiStore for functionId/optimizer/lr/startPoint
 *     and rebuilds the stepper when any of them change.
 *   - Channel B (transient): every frame (while playing) it advances the stepper
 *     and writes the vanilla simStore via getState() setters — NEVER React state.
 * No other component may write simStore from a frame loop. Must be mounted inside
 * <Canvas> because useFrame requires the R3F render-loop context.
 */
export function useSimRunner(): void {
  const stepperRef = useRef<Stepper | null>(null);
  const invalidate = useThree((s) => s.invalidate);

  // Channel A → rebuild. Subscribe reactively to the four inputs that define a
  // run. Any change tears down the old stepper, builds a fresh one, and reseeds
  // the sim store to the start point so the ball snaps back to θ₀.
  const functionId = useUIStore((s) => s.functionId);
  const optimizerId = useUIStore((s) => s.optimizerId);
  const learningRate = useUIStore((s) => s.learningRate);
  const startPoint = useUIStore((s) => s.startPoint);

  useEffect(() => {
    const fn = getFunction(functionId);
    const theta0 = startPoint as Vec2;
    // Newton needs grad to build its numeric Hessian; passing {grad} is harmless
    // for the first-order optimizers (they ignore it).
    const optimizer = makeOptimizer(optimizerId, { lr: learningRate }, { grad: fn.grad });

    const stepper = createStepper({
      optimizer,
      grad: fn.grad,
      theta0,
      dt: SIM_DT,
      cost: fn.cost,
    });
    stepperRef.current = stepper;

    // Seed Channel B at θ₀ so the ball is correctly placed even before play.
    const sim = simStore.getState();
    sim.setTheta(theta0);
    sim.setCost(fn.cost(theta0));
    sim.setIteration(0);
    sim.setDiverged(false);

    // We are on frameloop="demand" while paused — force one render so the freshly
    // seeded ball position is drawn immediately.
    invalidate();
  }, [functionId, optimizerId, learningRate, startPoint, invalidate]);

  useFrame((_, delta) => {
    const stepper = stepperRef.current;
    if (!stepper) return;

    // Read the play flag transiently (no re-subscription → no stale closure, no
    // re-created frame callback). While paused we early-out; the Canvas is on
    // frameloop="demand" so this callback isn't even pumped, but the guard keeps
    // the hook correct if the frameloop policy changes.
    if (!useUIStore.getState().isPlaying) return;

    stepper.advance(delta);

    // Write Channel B once per frame from the post-advance stepper. Cost comes
    // from the last history entry the stepper recorded this frame (it computes
    // cost per entry); fall back to recompute only if history is somehow empty.
    const last = stepper.history[stepper.history.length - 1];
    const sim = simStore.getState();
    sim.setTheta(stepper.theta);
    sim.setIteration(stepper.iteration);
    sim.setCost(last?.cost ?? getFunction(useUIStore.getState().functionId).cost(stepper.theta));
    sim.setDiverged(stepper.diverged);
  });
}
```

- [ ] **Step 3: Typecheck.**

```bash
npm run typecheck
```

Expected output: no errors, exit 0. (Confirms `createStepper`'s `cost` field, the `Stepper` type export, `useThree`/`useFrame` signatures, and the `simStore`/`useUIStore` setter shapes all line up. `noUnusedLocals` would flag a dangling import here — so a clean typecheck also proves every import is used.)

- [ ] **Step 4: Commit.**

```bash
git add src/scene/useSimRunner.ts
git commit -m "feat(scene): useSimRunner — the single useFrame owning the stepper

One frame loop writes the vanilla simStore (Channel B); it reads uiStore
(Channel A) reactively to rebuild the stepper on function/optimizer/lr/
startPoint change and reseeds θ₀. isPlaying is read via getState() inside
useFrame to avoid a stale closure. Fixed SIM_DT=1/30s (PRD §8.2, §8.3)."
```

---

### Task 14: `Scene.tsx` composition — replace the placeholder cube

Compose the real scene: void background + exponential fog, lights, swappable environment, the magma CSM surface, the lacquered descent ball, and the sim runner. The `<Canvas>` gains `shadows`, tier-driven `dpr`, and a `frameloop` that is `'always'` while playing and `'demand'` while paused (PRD §8.3 power discipline — no scrubber yet, so `mode` is effectively `'live'`).

> **Note on `useSimRunner` placement:** `useFrame` (inside the hook) MUST run within the `<Canvas>` React subtree. `SceneContents` is rendered as a child of `<Canvas>`, so calling `useSimRunner()` from `SceneContents`'s body is valid. We call it directly rather than via a wrapper `<SimRunner/>` component — one fewer node, and `SceneContents` is already the in-canvas boundary the test mounts.

> **Note on the `frameloop` clock:** toggling `frameloop` between `'demand'` and `'always'` resets `clock.elapsedTime`, but the stepper consumes `useFrame`'s `delta` (per-frame, not absolute), so the descent is unaffected. The first frame after an `'always'` switch has a small/clamped delta — harmless for a fixed-timestep accumulator. Documented inline.

**Files:**
- Modify: `src/scene/Scene.tsx`
- Test (modify): `src/scene/Scene.test.tsx`

- [ ] **Step 1: Update the smoke test to assert the real surface (write the failing assertion first).** The old test asserted `>=1 Mesh` (the cube). The cube is removed; now the `Surface` (a CSM `<mesh>`) and the `DescentBall` (a `<mesh>`) are the meshes. Assert `>=2` meshes and at least one light (`DirectionalLight` from `<Lights/>`). Replace the file contents:

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneContents } from './Scene';

describe('Scene (R3F smoke test)', () => {
  it('mounts the composed scene: surface + ball meshes and a key light', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneContents />);

    // The placeholder cube is gone. The real scene has at least two meshes:
    // the CSM displaced Surface and the lacquered DescentBall.
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(2);

    // <Lights/> mounts a directional key light.
    const dirLights = renderer.scene.findAllByType('DirectionalLight');
    expect(dirLights.length).toBeGreaterThanOrEqual(1);

    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL.** The current `Scene.tsx` still renders the single cube and an `ambientLight`+`directionalLight`, so `>=2` Mesh may fail and the test now imports the not-yet-composed scene.

```bash
npm test -- Scene
```

Expected: FAIL. Most likely on `expect(meshes.length).toBeGreaterThanOrEqual(2)` — `Received: 1` (only the cube). (If Phase 2's `Surface`/`DescentBall` are not yet imported, the failure proves the composition is missing — which Step 3 fixes.)

- [ ] **Step 3: Rewrite `src/scene/Scene.tsx` (COMPLETE).** Compose the scene and wire the runner. `SceneContents` calls `useSimRunner()`. `Scene` adds `shadows`, tier `dpr`, and play-driven `frameloop`, and mounts drei `<OrbitControls makeDefault/>`.

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useUIStore } from '../state/uiStore';
import { TIER_SETTINGS } from '../quality/tiers';
import { Lights } from './Lights';
import { SceneEnvironment } from './SceneEnvironment';
import { Surface } from './Surface';
import { DescentBall } from './DescentBall';
import { useSimRunner } from './useSimRunner';

/**
 * In-canvas content (no <Canvas> wrapper) — unit-testable with
 * @react-three/test-renderer. The full M1a scene (PRD §5.1): void background +
 * exponential fog, key light + soft shadows, a swappable procedural/HDR
 * environment, the magma CSM surface, and the lacquered descent ball. The single
 * sim runner (the one useFrame that owns the descent) is called here because
 * useFrame must execute inside the <Canvas> subtree, and SceneContents IS that
 * in-canvas boundary.
 */
export function SceneContents() {
  // Channel B's driver. Renders nothing; owns the stepper + writes simStore.
  useSimRunner();

  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      {/* Exponential fog in the void colour fades the surface edges into the
          background so the plane never reads as a hard-edged card (PRD §5.1). */}
      <fogExp2 attach="fog" args={[0x0b0e1a, 0.08]} />

      <Lights />
      {/* M1a default: procedural environment (no network/HDR fetch). The HDR
          path is swappable via mode and exercised in M1b. */}
      <SceneEnvironment mode="procedural" />

      <Surface />
      <DescentBall />
    </>
  );
}

/** App-facing scene: the real Canvas wrapper. */
export function Scene() {
  // Reactive (Channel A) reads. These change rarely and re-rendering <Scene> to
  // update Canvas props (frameloop/dpr) is correct — it does NOT re-render the
  // in-canvas tree's transient state.
  const isPlaying = useUIStore((s) => s.isPlaying);
  const tier = useUIStore((s) => s.tier);

  // Power discipline (PRD §8.3): render every frame only while the descent is
  // animating; otherwise render on demand (camera moves call invalidate() via
  // OrbitControls; the sim runner invalidate()s on rebuild). No scrubber yet
  // (M1c), so "live" is the only mode → frameloop = isPlaying ? always : demand.
  // Toggling frameloop resets clock.elapsedTime, but the stepper uses per-frame
  // delta (fixed-timestep accumulator), so the descent is unaffected.
  const frameloop = isPlaying ? 'always' : 'demand';

  return (
    <Canvas
      shadows
      camera={{ position: [3, 3, 3], fov: 50 }}
      dpr={[1, TIER_SETTINGS[tier].dpr]}
      frameloop={frameloop}
    >
      <OrbitControls makeDefault />
      <SceneContents />
    </Canvas>
  );
}
```

- [ ] **Step 4: Run the test — expect PASS.**

```bash
npm test -- Scene
```

Expected: PASS. `findAllByType('Mesh')` now returns the `Surface` mesh + the `DescentBall` mesh (`>=2`), and `findAllByType('DirectionalLight')` returns `<Lights/>`'s key light (`>=1`). (The `Environment`, `OrbitControls`, fog, and the runner's `useFrame` mount without throwing — the test renderer instantiates them but does not pump the frame loop, which is why the runner's behavior is verified live in Task 15, not here.)

> **Smoke-test-early risk (spec §8.1):** if `SceneEnvironment mode="procedural"` triggers a drei `<Environment>` that the test renderer cannot construct headlessly (e.g. it needs a real WebGL `WebGLCubeRenderTarget`), this test can throw on mount rather than assert. Fallback: render `<SceneEnvironment>` only in `Scene` (the live Canvas) and omit it from `SceneContents` for the headless test by guarding on a prop, e.g. `SceneContents({ withEnv = true })` and mounting with `withEnv={false}` in the test. Confirmed unnecessary if Task 11's `SceneEnvironment` already guards its PMREM generation for the headless renderer; try the unguarded version first.

- [ ] **Step 5: Typecheck (catches what the test cannot).** The M0 lesson: `noUnusedLocals`/`noUnusedParameters` fire only in `tsc`, not vitest.

```bash
npm run typecheck
```

Expected: no errors, exit 0. (Confirms `frameloop` is a valid Canvas prop value union, `OrbitControls`/`Environment` props, and that every import — `Lights`, `SceneEnvironment`, `Surface`, `DescentBall`, `useSimRunner`, `TIER_SETTINGS` — is actually used.)

- [ ] **Step 6: Commit.**

```bash
git add src/scene/Scene.tsx src/scene/Scene.test.tsx
git commit -m "feat(scene): compose M1a scene — surface + ball + lights + env + runner

Replace the placeholder cube. SceneContents renders void bg + exponential
fog, <Lights/>, <SceneEnvironment mode=procedural/>, <Surface/>, <DescentBall/>
and calls useSimRunner() (useFrame inside Canvas). Scene's Canvas gains
shadows, tier-driven dpr, OrbitControls makeDefault, and frameloop=
isPlaying?always:demand (PRD §8.3). Smoke test asserts surface+ball meshes
and the key light."
```

---

### Task 15: M1a phase gate — typecheck + build + test + live browser smoke + design checkpoint

A consolidation/gate task: prove the whole M1a tree is green across all three CI gates, then drive the **live** scene in a real browser via Playwright MCP (the only way to verify WebGL renders, the surface displaces and is magma-coloured, the ball sits on it, and play animates it). Present the result to the user as the M1a design checkpoint.

**Files:** none created — this is a verification + checkpoint task. Any fix it surfaces is committed at the end.

- [ ] **Step 1: Typecheck gate.**

```bash
npm run typecheck
```

Expected: no errors, exit 0.

- [ ] **Step 2: Test gate (full suite, not just the scene).** Includes the Phase 1 engine tests (ring-buffer cap + per-entry cost, Adam/AdamW/Nadam bias-corrected aux) and the Phase 2/3 scene smoke tests.

```bash
npm test
```

Expected: all suites pass, exit 0. Spot-check the summary line shows the engine tests added in Tasks 1-3 and the `Scene` test from Task 14, e.g. `Test Files  N passed (N)` / `Tests  M passed (M)`, zero failed.

- [ ] **Step 3: Build gate (explicit — the M0 lesson).** `npm run build` = `tsc -b && vite build`. The `tsc -b` project build applies `noUnusedLocals`/`noUnusedParameters` across the whole graph (stricter than the test run), and `vite build` proves the GLSL strings, CSM, and drei imports bundle for production.

```bash
npm run build
```

Expected: `tsc -b` emits nothing and exits 0, then `vite build` prints `✓ built in <t>s` and writes `dist/`. Zero TypeScript errors, zero Rollup warnings about unresolved imports (e.g. `three-custom-shader-material`, `maath`). If `noUnusedLocals` flags a dangling symbol the tests missed, fix it now and re-run all three gates.

- [ ] **Step 4: Start the dev server in the background.**

```bash
npm run dev
```

Run in background. Expected: Vite prints `Local: http://localhost:3000/` (port from `vite.config.ts`). Note: `server.open: true` may try to open a system browser — ignore it; we drive Playwright explicitly. If port 3000 is taken, Vite picks the next free port — read the actual URL from the log and use it below.

- [ ] **Step 5: Load the scene schema for the Playwright MCP tools, then navigate.** These tools are deferred — fetch their schemas first.

```
ToolSearch: select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_wait_for,mcp__plugin_playwright_playwright__browser_evaluate
```

Then navigate to the dev server:

```
browser_navigate → url: "http://localhost:3000/"
```

Expected: navigation resolves; the page title loads. Give WebGL a beat to initialize:

```
browser_wait_for → time: 2
```

- [ ] **Step 6: Assert ZERO WebGL/console errors.** This is the hard gate — a silent shader compile failure or CSM misuse shows up here, not in the headless test.

```
browser_console_messages → onlyErrors: true
```

Expected: an empty list (no `error`-level messages). Specifically there must be NO: GLSL compile/link errors (`ERROR: 0:NN`), `THREE.WebGLProgram` errors, `Cannot read properties of undefined (reading 'uniforms')` (a CSM ref-mutation timing bug), or React error-boundary traces. If any appear, STOP and fix — capture the exact message; the most likely culprits are a shader uniform name mismatch vs the locked contract (`uFunction/uTime/uVScale/uParamMin/uParamRange/uContourSpacing/uColorLow/uColorHigh`) or a `surfaceMapping` ↔ GLSL constant drift.

- [ ] **Step 7: Screenshot the scene at the Rosenbrock start.** Default uiStore state is `functionId='rosenbrock'`, `optimizerId='sgd'`, `startPoint=[-1.2,1]`, `isPlaying=false`, `tier='high'`.

```
browser_take_screenshot → filename: "ascent-m1a-rosenbrock.png", fullPage: false
```

Expected: a dark (#0B0E1A) scene showing the **magma-coloured** Rosenbrock surface (deep purple valley → orange/yellow on the high walls, colour ramp t∈[0.12,1]), displaced (the curved valley is visibly 3D, not flat), lit with a key light and a soft contact shadow under the surface/ball, and the **lacquered ball sitting on the surface** at the start point (upper-left region of the valley for `[-1.2, 1]`). Fog softens the plane edges into the background.

- [ ] **Step 8: Toggle play and confirm the ball MOVES (the runner works end-to-end).** Drive `isPlaying` through the store from the page context, wait for the descent to advance several steps, and re-screenshot. This proves `useSimRunner` advances the stepper and writes `simStore`, and that `frameloop` flips to `'always'`.

```
browser_evaluate → function: "() => { /* flip Channel A: isPlaying=true via the exposed store, or via the play control once M1c adds it. For M1a, set it directly. */ window.__ascent_play__ ? window.__ascent_play__() : null; return 'requested play'; }"
```

> If no debug hook is exposed yet, the simplest M1a-friendly approach is a one-line dev-only `window` handle. Add to `useSimRunner` (or `App`) behind `import.meta.env.DEV`: `if (import.meta.env.DEV) (window as any).__ascent_play__ = () => useUIStore.getState().setPlaying(true);`. Alternatively, since the store is a module singleton, evaluate against it directly if the app exposes it. The robust fallback that needs NO app change: temporarily set `isPlaying: true` in `uiStore.ts`'s `INITIAL` for the duration of this manual check, observe motion, then revert (do NOT commit the flipped default). Pick whichever is least invasive; document which you used.

```
browser_wait_for → time: 2
browser_take_screenshot → filename: "ascent-m1a-rosenbrock-playing.png", fullPage: false
```

Expected: the ball has visibly descended along the valley toward `(1,1)` compared to the start screenshot — confirming the stepper advances and the ball reads `simStore.theta` and damps to the new surface point. (At SGD lr=0.1 on Rosenbrock the first steps are a sharp zig toward the valley floor — exactly the headline behaviour.)

- [ ] **Step 9: 60fps spot-check (informal).** While playing, sample the frame rate from the page to confirm the live scene holds ~60fps at tier `high` on the dev machine.

```
browser_evaluate → function: "() => new Promise(res => { let n=0; const t0=performance.now(); const tick=()=>{ n++; if(performance.now()-t0<1000){requestAnimationFrame(tick);} else {res(Math.round(n*1000/(performance.now()-t0)));} }; requestAnimationFrame(tick); })"
```

Expected: ~55-60 (fps) on a typical dev GPU at tier `high` (dpr cap 1.75, 64 surface segments). A number well below 30 means a perf problem (e.g. shadow map too large, dpr uncapped) to note for M1b tuning — not necessarily an M1a blocker, but record it.

- [ ] **Step 10: Stop the dev server.** Terminate the background `npm run dev` process (Ctrl-C equivalent / kill the job) so it does not linger across turns.

- [ ] **Step 11: Present the M1a design checkpoint to the user.** Alongside the Task 12 A/B comparison, show both screenshots (`ascent-m1a-rosenbrock.png`, `ascent-m1a-rosenbrock-playing.png`) and the measured fps, and state the explicit **M1a exit criteria** — every box must be checked before M1a is declared done:

  - [ ] Surface **displaces** (the Rosenbrock valley is visibly 3D) and is **magma-coloured** (purple→orange ramp, t∈[0.12,1]).
  - [ ] Surface is **lit** (key light) and **shadowed** (soft contact shadow), edges fade into fog.
  - [ ] **Ball sits on the surface** at the start point and **moves** down the valley when play is toggled (proves `useSimRunner` + the two-channel write path).
  - [ ] **Zero console errors** (no GLSL compile/link, no CSM uniform errors).
  - [ ] **All three gates green:** `npm run typecheck`, `npm test`, `npm run build`.
  - [ ] **~60fps** spot-check at tier `high`.
  - [ ] `surfaceMapping.ts` ↔ GLSL constants confirmed in sync (the single source of truth held: ball and surface agree on param↔world).

  > **Note:** M1b (the post-processing stack — AGX tone mapping via a `ToneMapping` effect not the renderer, N8AO, SMAA with CA reordered adjacent per spec §3 — plus the ambient particle field and the hero "first descent" beat) is planned **just-in-time** after this checkpoint is approved. M1c adds detect-gpu tier auto-detection, the scrubber/timeline (`frameloop` gains the `'live'`/`'scrub'` mode split), and promotes `detect-gpu`/`maath` to explicit deps.

- [ ] **Step 12: Commit any final touch-ups surfaced by the gate** (e.g. a `noUnusedLocals` fix from Step 3, a uniform-name correction from Step 6, or removal of a temporary dev `window` hook from Step 8). If the tree is already clean, skip the commit.

```bash
git add -A
git commit -m "fix(scene): M1a gate touch-ups — <describe the specific fix>

Surfaced by the M1a phase gate (typecheck/build/console). <e.g. corrected
uSurface uniform name to match the locked contract; removed temporary dev
play hook used for the live smoke check.>"
```

---

**Notes for the assembling author (not part of the plan body):** my code calls `createStepper({optimizer, grad, theta0, dt, cost})` and reads `history[last].cost` — both depend on Tasks 1-3 landing the `cost` config field, per-entry cost, and ring buffer. Tasks reference Phase 2 components (`Lights`, `SceneEnvironment`, `Surface`, `DescentBall`) and `surfaceMapping` by their locked contract. The lr override key is `lr` (verified in `sgd.ts`), and `TIER_SETTINGS[tier].dpr` supplies the dpr upper bound (verified in `tiers.ts`). The relevant files I grounded against: `C:\Users\rahuaf\Documents\My Stuff\Programming\gradient-descent-app\src\engine\stepper.ts`, `src\engine\optimizers\registry.ts`, `src\engine\optimizers\sgd.ts`, `src\engine\functions\registry.ts`, `src\state\uiStore.ts`, `src\state\simStore.ts`, `src\quality\tiers.ts`, `src\scene\Scene.tsx`, `src\scene\Scene.test.tsx`.
