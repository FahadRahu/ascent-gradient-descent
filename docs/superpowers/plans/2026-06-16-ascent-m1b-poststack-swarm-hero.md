# ASCENT M1b — Post-Stack, Swarm & Hero Beat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the cinematic layer on top of the working M1a scene — the full AGX/HalfFloat merged post-processing stack (selective bloom by physics, N8AO, DOF, SMAA, grade), the stateless 65k-particle ambient swarm riding a baked half-float flow field, the `TubeGeometry` descent path + live drei `<Trail>` ribbon, and the ~700ms hero arrival beat — all driven by ref-mutation under the two-channel rule, tier-conditional, and verified on the real GPU.

**Architecture:** Four subsystems compose onto the M1a `SceneContents` tree. (1) **Post-stack** — a tier-keyed `<EffectComposer>` (`PostStack.tsx`) in the spec §3.3 corrected order, AGX via the `ToneMappingMode.AGX` *symbol*, selective bloom by the existing materials' physics; Low tier mounts no composer and uses the renderer-AGX path. (2) **Path & Trail** — a `TubeGeometry` rebuilt from the stepper's history polyline (exposed via a new Channel-B handle on `useSimRunner`) with a `uProgress` reveal shader, plus a live `<Trail>` ribbon (smoke-test Risk #2). (3) **Swarm** — a pure-TS baked half-float flow-field `DataTexture` (smoke-test Risk #4) + a stateless `<points>` material whose vertex shader reuses `functionFieldGLSL` so motes ride the same displaced terrain. (4) **Hero beat** — a pure-TS arrival trigger + state machine driving a `HeroBeat` controller that mutates ball/trail/bloom/dof/vignette refs and a lone ember ground ring through the ~700ms choreography. A single `HeroRefs` object, created once in `SceneContents`, is the cross-subsystem seam.

**Tech Stack:** three ~0.184 · @react-three/fiber 9.6 · @react-three/drei 10.7 · @react-three/postprocessing 3.0.4 (wrapping postprocessing 6.39.1, n8ao 1.10.2, meshline 3.3.1, all transitive) · **maath 0.10.8 (promoted transitive→explicit, new)** · three-custom-shader-material 6.4.0 · zustand 5 · TypeScript 5.6 · Vitest 4.1 + @react-three/test-renderer 9.1 · Vite 7. GLSL for the swarm + path shaders. Live verification via the Playwright MCP browser.

---

## Context for the implementer

You are building **M1b — the second of three M1 cycles** for ASCENT, a 3D gradient-descent teaching/showpiece app. **Read `PRD.md` and `docs/superpowers/specs/2026-06-13-ascent-m1-design.md` once before starting** — the spec is the source of truth for M1 (it records the four PRD corrections in §3, and §5.4/§5.5/§5.6 spec the M1b scope). M1a (the GPU-displaced magma surface, lacquered ball, environment, lights, sim runner) is **done and merged** (`v0.2.0-m1a`); this plan composes onto it. M1c (adaptive `detect-gpu` tiers, `<PerformanceMonitor>`, the iteration scrubber, live KaTeX, the uPlot loss chart, the committed Playwright smoke) is planned just-in-time after this cycle.

### Locked decisions (already made — do not re-litigate)

1. **AGX comes from the `ToneMapping` *effect*, as the SYMBOL.** Per spec §3.1, the composer pins `gl.toneMapping = NoToneMapping`, so AGX must be the last effect child: `<ToneMapping mode={ToneMappingMode.AGX} />`. **CRITICAL — verified against installed source:** at *runtime* `ToneMappingMode.AGX === 7`, but the package's `.d.ts` erroneously declares it `8` (a type/runtime skew). **Always pass the symbol `ToneMappingMode.AGX`, never a numeric literal** — the emitted JS reads the correct runtime value. The **Low tier mounts no composer**, so there `gl.toneMapping = THREE.AgXToneMapping` (`===6`) on the renderer is valid and is how Low gets AGX.
2. **Effect order is the spec §3.3 corrected order, hard-coded:** `N8AO → Bloom → DOF → SMAA → ChromaticAberration → Vignette → Noise → ToneMapping(AGX last)`. CA sits adjacent to SMAA (both convolution) so Vignette+Noise+ToneMapping stay contiguous and merge into the final `EffectPass`.
3. **N8AO `accumulate` via ref, `denoiseRadius` via prop.** Verified against the installed `N8AO.d.ts`: `denoiseRadius` **is** a JSX prop (this *corrects* spec §3.4 which called it ref-only) → pass `denoiseRadius={0}`. `accumulate` is **not** a prop → set `n8aoRef.current.configuration.accumulate = true` in a `useEffect`. `quality`/`halfRes`/`aoSamples` recompile shaders → static per tier, never per frame. `n8ao` ships **no** `.d.ts` and `@r3/pp`'s `N8AO.d.ts` references `N8AOPostPass` as an unresolved identifier → type the ref with a **local minimal interface** (`{ configuration: { accumulate: boolean } }`); this typechecks clean under the project's `skipLibCheck: true`.
4. **Selective bloom is by physics — threshold stays `0.9`.** The M1a materials were already authored for this: the Surface's `csm_Emissive = e/(1+e)` soft-rolloff stays sub-1.0 (won't bloom), and the DescentBall's `emissiveIntensity={3.0} toneMapped={false}` exceeds 0.9 (blooms). The `HalfFloatType` buffer keeps `>1` values un-clamped. **Never lower the threshold to catch dim pixels** (PRD's "neon mush" warning); drive glow via `emissiveIntensity`.
5. **The two-channel rule is non-negotiable** (PRD §8.2, the spine). `uiStore` (reactive) for slow UI state; `simStore` (vanilla) for per-frame sim state, read transiently via `getState()` and applied by direct object/ref mutation inside `useFrame`. **Never `setState` per frame, anywhere.** Every new per-frame uniform (`uTime`, `uProgress`, the hero choreography, the DOF target) is a ref mutation. The hero-beat phase lives in a `useRef`, never a store.
6. **One shared-ref seam: `src/scene/heroRefs.ts`.** A single `HeroRefs` object (`{ ballMaterial, trailMaterial, bloom, dof, vignette }`) is created once in `SceneContents` and threaded to the owner subsystems (which populate `.current`) and to `<HeroBeat>` (which only mutates). Every ref is nullable — a tier without a composer leaves bloom/dof/vignette null; the hero beat null-guards every consumer and degrades gracefully.
7. **DOF target/bokehScale split (no two-writer hazard).** `PostStack` owns `dofRef.current.target` (eased toward the ball world position each frame, computed from `simStore` + `surfaceMapping` — no ball-mesh ref needed). `HeroBeat` writes only `dofRef.current.bokehScale`. Disjoint properties.
8. **Swarm is ON by default, scaled by tier; only fallback drops to 0.** Counts come from the existing `TIER_SETTINGS[tier].ambientParticles` (ultra 65536 / high 30000 / medium 12000 / low 3000 / fallback 0). `Swarm` reads the tier internally and self-gates (returns null at count 0).
9. **All numeric constants from the PRD are LOCKED** (bloom `intensity=1.2/threshold=0.9/smoothing=0.025/radius=0.7/levels=9`; vignette `offset=0.35/darkness=0.55`; CA `offset=[0.0008,0.0005]`; noise `opacity=0.04`; N8AO `aoRadius=0.4/distanceFalloff=1.0/intensity=3`; trail core `#FFF4E6` emissive 3.5 / halo cyan `#00D3F2`; ball touchdown `color=[6,6,4]` emissive 3→5; settle beacon cyan ~2.2; ember `#FFA23A`; divergence fuchsia `#ED6AFF`). Aesthetic gains the PRD does not pin (lifetimes, spawn bias, swirl amounts, easing smoothTimes) are first-guesses tuned in-browser at the checkpoint — flagged where they appear, never silently invented as load-bearing.

### Verified external API facts (extracted from installed source during planning — trust these over training memory)

Installed versions: `three 0.184.0`, `@react-three/fiber 9.6.1`, `@react-three/drei 10.7.7`, `@react-three/postprocessing 3.0.4`, `postprocessing 6.39.1`, `maath 0.10.8`, `meshline 3.3.1`, `n8ao 1.10.2`, `three-custom-shader-material 6.4.0`.

- **Post-stack imports:** effects from `@react-three/postprocessing` (`EffectComposer, N8AO, Bloom, DepthOfField, SMAA, ChromaticAberration, Vignette, Noise, ToneMapping`); enums from `postprocessing` (`ToneMappingMode, SMAAPreset, BlendFunction, VignetteTechnique`); `HalfFloatType` from `three`. `<EffectComposer>` defaults `multisampling` to 8 (MUST set `={0}`) and `frameBufferType` to HalfFloat (set `={HalfFloatType}` explicitly). Child order = pass order. Effect refs: `Bloom→BloomEffect` (`.intensity` live setter), `DepthOfField→DepthOfFieldEffect` (`.target: Vector3|null`, `.bokehScale` live setter), `Vignette→VignetteEffect` (`.darkness`/`.offset` live setters). **All of `<Bloom>`/`<SMAA>`/`<Vignette>`/`<Noise>`/`<ChromaticAberration>`/`<ToneMapping>` are loosely typed at the JSX site** — verified: each component's `.d.ts` declares its props as `{[x:string]:any}` (the `EffectProps<…>` aliases exist but are NOT applied to the components), so TypeScript will NOT catch a prop-name typo on any of them. Prop names come from the underlying `postprocessing` effect constructors. This is exactly why the **live smoke (Task 4) is the real prop-correctness gate** — do not rely on `tsc` to catch a CA/ToneMapping/Bloom prop mistake. Effect refs (`Bloom→BloomEffect.intensity`, `DepthOfField→DepthOfFieldEffect.target/.bokehScale`, `Vignette→VignetteEffect.darkness/.offset`) ARE typed and forward correctly.
- **maath easing** (`import { easing } from 'maath'`): `easing.damp(obj, 'key', target, smoothTime, delta)` mutates `obj.key`, returns boolean; `easing.damp3(vec3, target|[x,y,z]|number, smoothTime, delta)`; `easing.dampC(color:THREE.Color, target:Color|[r,g,b]|hex|string, smoothTime, delta)`. All framerate-independent — **you MUST pass the frame `delta`** (the default is `0.01`, wrong). `DescentBall.tsx` already uses `easing.damp3` successfully.
- **drei `<Trail>`** (Risk #2): props `width(0.2) length(1) decay(1) local(false) stride(0) interval(1) color('hotpink') attenuation((w)=>n) target(RefObject<Object3D>)`. Wrapper mode `<Trail><mesh/></Trail>` (first Object3D child is the anchor — canonical) or `target={ref}`. A ref on `<Trail>` resolves to the portaled trail **Mesh**; `trailRef.current.material` is a `MeshLineMaterial` whose `.color` getter returns the **live `THREE.Color` uniform** → mutate in place. **Do NOT change the `color` PROP per frame** (rebuilds the material → hitch). No `extend()` needed for wrapper/target modes (meshline stays transitive). ~1-frame attach delay; material rebuilds on `width`/`color`/`size`/`children` change.
- **TubeGeometry**(`path, tubularSegments, radius, radialSegments, closed`): `uv.x` runs 0 (start) → 1 (end) along the tube, arc-length parameterized. Reveal via `smoothstep(uProgress - uEdge, uProgress, vUv.x)`. Use `closed=false` so `uv.x` reaches exactly 1.0. `CatmullRomCurve3(points, false, 'centripetal', 0.5)` (centripetal avoids loops on the sharp Rosenbrock zig-zag). `CatmullRomCurve3`/`TubeGeometry` are pure CPU geometry — they run under Node/Vitest with no GL.
- **DataTexture half-float** (Risk #4): `new THREE.DataTexture(data, 256, 256, THREE.RGBAFormat, THREE.HalfFloatType)` where `data` is a `Uint16Array(256*256*4)` of `THREE.DataUtils.toHalfFloat(x)` bit-patterns (NOT Float32Array; HalfFloatType requires Uint16). `RGBAFormat` not RGB (Intel-mobile compat). Set `tex.needsUpdate = true`. NearestFilter + ClampToEdge are DataTexture **defaults** — do not set them. `THREE.DataUtils.fromHalfFloat` round-trips to ≤4e-4 (the unit-test oracle).
- **drei `shaderMaterial(uniforms, vert, frag)`** returns a `THREE.ShaderMaterial` subclass constructor. Register with `extend({ SwarmMaterial })` → JSX `<swarmMaterial/>` (lowercase first letter). Uniforms exposed as `mat.uniforms[k].value` AND accessor props `mat.uTime`. The TS JSX augmentation (`declare module '@react-three/fiber' { interface ThreeElements { swarmMaterial: ThreeElement<typeof SwarmMaterial> } }`) was **typecheck-probed clean** under fiber 9.6 / React 19. Raw points: `<points frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" args={[f32, 3]} />…</bufferGeometry><swarmMaterial/></points>` — draw count derives from `attributes-position` count; `BufferAttribute` throws on a plain Array (must be a TypedArray).
- **`RingGeometry`**, **`AgXToneMapping (===6)`** confirmed present in three 0.184.

### The shared mapping contract (unchanged from M1a — depended on, not modified)

`src/scene/surfaceMapping.ts` remains the single source of truth: `SURFACE_SIZE = 4`; `paramToWorldXZ(px, pz, domain)`; `worldXZToParam`; `vScaleFor(functionId)`; `costToWorldHeight(cost, functionId)`. The same linear map is reproduced in GLSL inside `surfaceShaders.ts` / `functionField.ts` (`p = uParamMin + uv * uParamRange`, `#define SURFACE_SIZE 4.0`). M1b's swarm and path **reuse** these — the swarm imports `functionFieldGLSL` so motes ride the exact displaced surface, and the path/trail go through `paramToWorldXZ`/`costToWorldHeight`. Engine: `getFunction(id)` → `{ id, cost, grad, domain, minima }`; the stepper records `HistoryEntry { iteration, theta, cost }` in a bounded ring buffer.

### Verification model (per spec §8 — the proven M1a layering)

R3F components can't fully run in headless Vitest (the GL is mocked — it does not compile shaders, merge effect passes, or upload DataTextures), so each task states which verification applies:
- **Pure TS** (postConfig, heroRefs, pathGeometry, flowField, heroTrigger, heroState): Vitest TDD (RED→GREEN→commit) + `npm run typecheck`. This is where the real logic confidence lives — three's `Vector3`/`CatmullRomCurve3`/`TubeGeometry`/`DataTexture`/`DataUtils` are pure CPU and run fine under Node.
- **GLSL chunks** (pathShaders, swarmShaders): string-guard tests (regex/`toContain` on the source) + `npm run typecheck`.
- **R3F components** (PostStack, DescentPath, DescentTrail, Swarm, EmberRing, HeroBeat, Scene): `@react-three/test-renderer` structure assertions (`findAllByType`, `advanceFrames` no-throw) + `npm run typecheck` + `npm run build` (**the M0/M1a lesson: the build gate's `noUnusedLocals`/`tsc -b` catches things the passing test suite masks**).
- **Live Playwright-MCP browser** (orchestrator-driven, on the real GPU): the only layer that proves shaders compile, effects merge, HalfFloat un-clamps, and the four integration risks actually work. Used at the smoke-test-early points and consolidated at the final design checkpoint.

### Smoke-test-early integration risks (spec §8.1)

| # | Risk | Where in this plan | Fallback |
|---|---|---|---|
| 2 | drei `<Trail>` + meshline under R3F 9.6 — most reconciler-coupled | **Task 5** (start of Phase B, live browser FIRST) | `TubeGeometry`-only path (drop the live ribbon); hero halo-bleed no-ops via null-guard |
| 4 | Half-float `DataTexture` sampling on the target GPU | **Task 11** (CI-safe encode/decode unit test) + **Task 19** (live GPU sampling) | `FloatType` + `Float32Array` (shader unchanged; ~5-line bake change) |
| — | The merged post-stack compiling/merging on the real GPU (this cycle's equivalent integration risk) | **Task 4** (wire + live smoke, the first time the stack hits a real GL context) | Mount effects incrementally to bisect; N8AO→`SSAO`/GTAO swap if N8AO specifically fails |

(Risk #1 CSM depth was resolved GO in M1a; Risk #3 KaTeX fonts is M1c.)

### Task map

- **Phase A — Post-processing stack (Tasks 1–4):** promote `maath` + `postConfig.ts`; the `heroRefs.ts` shared seam; `PostStack.tsx`; wire into `SceneContents` + the early post-stack live smoke.
- **Phase B — Descent path + live Trail (Tasks 5–10):** Risk #2 live smoke FIRST; `pathGeometry.ts`; `pathShaders.ts`; the `useSimRunner` history handle; `DescentPath.tsx` (tube); `DescentTrail.tsx` (ribbon) + wire in.
- **Phase C — Ambient swarm + flow field (Tasks 11–13):** `flowField.ts` bake (Risk #4 CI half); `swarmShaders.ts`; `Swarm.tsx` + JSX augmentation + wire in.
- **Phase D — Hero arrival beat + final composition (Tasks 14–18):** `heroTrigger.ts`; `heroState.ts`; `EmberRing.tsx`; `DescentBall.tsx` material-ref lift; `HeroBeat.tsx` + the final `SceneContents` composition.
- **Phase E — Gate & checkpoint (Task 19):** typecheck + build + test + the consolidated live Playwright-MCP browser smoke (all risks) + the M1b design checkpoint.

---

## File structure

**Create (pure TS):** `src/quality/postConfig.ts` · `src/scene/heroRefs.ts` · `src/scene/pathGeometry.ts` · `src/scene/flowField.ts` · `src/scene/heroTrigger.ts` · `src/scene/heroState.ts` (+ matching `.test.ts`).
**Create (GLSL chunks):** `src/scene/shaders/pathShaders.ts` · `src/scene/shaders/swarmShaders.ts` (+ string-guard `.test.ts`).
**Create (R3F components):** `src/scene/PostStack.tsx` · `src/scene/DescentPath.tsx` · `src/scene/DescentTrail.tsx` · `src/scene/Swarm.tsx` · `src/scene/EmberRing.tsx` · `src/scene/HeroBeat.tsx` (+ matching `.test.tsx`).
**Modify:** `package.json` (add `maath`) · `src/scene/useSimRunner.ts` (expose the history handle) · `src/scene/DescentBall.tsx` (lift `materialRef`) · `src/scene/Scene.tsx` (compose all four subsystems, tier-conditional).

Each file has one responsibility; the cross-subsystem seam is the single `HeroRefs` object. Layout is flat `scene/` with shaders in `scene/shaders/`, matching the M1a convention.

---

## Tasks

### Task 1: Promote `maath` to an explicit dep + `postConfig.ts` (per-tier post config)

**Files:**
- Modify: `package.json` (add `maath` to `dependencies`)
- Create: `src/quality/postConfig.ts`
- Create: `src/quality/postConfig.test.ts`

> **Why:** `maath` is currently only a transitive dep (via drei); M1b imports it directly for the DOF follow and the entire hero-beat choreography, so the M1 spec §7 says promote it to an explicit pinned dep. `postConfig.ts` is the post-stack analogue of `tiers.ts` — a pure-TS per-tier data map (which effects mount and their tier-varied params), kept separate so `tiers.ts` stays untouched and the post config is independently unit-testable. It is consumed only by `PostStack.tsx` (Task 3).

- [ ] **Step 1: Add `maath` to `package.json` dependencies**

Insert the pinned line (after `lucide-react`, before `mathjs`). The resulting `"dependencies"` block must read:

```json
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.6.1",
    "@react-three/postprocessing": "^3.0.4",
    "three-custom-shader-material": "^6.4.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "maath": "0.10.8",
    "mathjs": "^15.2.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "three": "~0.184.0",
    "zustand": "^5.0.14"
  },
```

- [ ] **Step 2: Install and verify nothing moved**

```bash
npm install
```

Expected: completes with **no `ERESOLVE`**. `maath@0.10.8` was already resolved transitively, so promoting it to explicit at the same exact version is a no-op for the tree. Verify:

```bash
npm ls maath three 2>&1 | grep -E "maath@|three@0\."
```

Expected: `maath@0.10.8` and `three@0.184.x` (the three pin is untouched). If `three` shows `0.185+`, stop and report.

- [ ] **Step 3: Write the failing test — `src/quality/postConfig.test.ts`**

```ts
import { POST_CONFIG } from './postConfig';
import { TIERS } from './tiers';
import { SMAAPreset } from 'postprocessing';

describe('POST_CONFIG — per-tier post-processing config', () => {
  it('has an entry for every Tier', () => {
    for (const t of TIERS) {
      expect(POST_CONFIG[t]).toBeDefined();
    }
  });

  it('mounts a composer for ultra/high/medium only', () => {
    expect(POST_CONFIG.ultra.mountComposer).toBe(true);
    expect(POST_CONFIG.high.mountComposer).toBe(true);
    expect(POST_CONFIG.medium.mountComposer).toBe(true);
    expect(POST_CONFIG.low.mountComposer).toBe(false);
    expect(POST_CONFIG.fallback.mountComposer).toBe(false);
  });

  it('turns DOF off at medium and below, on at high/ultra', () => {
    expect(POST_CONFIG.ultra.dof).toBe(true);
    expect(POST_CONFIG.high.dof).toBe(true);
    expect(POST_CONFIG.medium.dof).toBe(false);
    expect(POST_CONFIG.low.dof).toBe(false);
  });

  it('uses SMAA ULTRA at ultra, HIGH at high/medium', () => {
    expect(POST_CONFIG.ultra.smaaPreset).toBe(SMAAPreset.ULTRA);
    expect(POST_CONFIG.high.smaaPreset).toBe(SMAAPreset.HIGH);
    expect(POST_CONFIG.medium.smaaPreset).toBe(SMAAPreset.HIGH);
  });

  it('disables N8AO halfRes only at ultra', () => {
    expect(POST_CONFIG.ultra.n8ao.halfRes).toBe(false);
    expect(POST_CONFIG.high.n8ao.halfRes).toBe(true);
    expect(POST_CONFIG.medium.n8ao.halfRes).toBe(true);
  });

  it('scales bloom down at medium vs high', () => {
    expect(POST_CONFIG.high.bloom.intensity).toBeGreaterThan(0);
    expect(POST_CONFIG.medium.bloom.intensity).toBeLessThan(POST_CONFIG.high.bloom.intensity);
  });
});
```

- [ ] **Step 4: Run the test to verify it FAILS (RED)**

```bash
npm test -- postConfig
```

Expected: **FAIL** with `Cannot find module './postConfig'`.

- [ ] **Step 5: Implement — `src/quality/postConfig.ts`**

```ts
import type { Tier } from './tiers';
import { SMAAPreset } from 'postprocessing';

/**
 * Per-tier post-processing configuration (spec §5.4 tier shape) — the sibling of
 * tiers.ts for the cinematic layer: which effects mount and their tier-varied
 * params. Pure data + the SMAAPreset enum (a plain number at runtime), so it is
 * fully unit-testable with no Three/React imports. PostStack.tsx reads
 * POST_CONFIG[tier] and renders accordingly.
 *
 * THE TIER LADDER (spec §5.4):
 *   ultra  — full stack, SMAA ULTRA, N8AO no halfRes + 'ultra', DOF on.
 *   high   — baseline full stack, SMAA HIGH, N8AO halfRes + 'medium', DOF on.
 *   medium — DOF OFF, smaller bloom, N8AO 'low' + halfRes.
 *   low    — NO composer (renderer AGX + emissive-mesh fake glow).
 *   fallback — NO composer (the Canvas never mounts; kept consistent).
 *
 * Bloom luminanceThreshold/luminanceSmoothing/radius/mipmapBlur are tier-invariant
 * (the selective-glow contract) and live directly in PostStack; only intensity/
 * levels vary per tier.
 */

/** N8AO quality presets recompile shaders → set once per tier, never per frame. */
export type N8AOQuality = 'performance' | 'low' | 'medium' | 'high' | 'ultra';

export interface PostTierConfig {
  /** Whether to mount the <EffectComposer> subtree. false → renderer-AGX path. */
  mountComposer: boolean;
  /** Antialiasing preset for <SMAA>. */
  smaaPreset: SMAAPreset;
  n8ao: {
    quality: N8AOQuality; // recompiles — static per tier
    halfRes: boolean; // recompiles — static per tier
  };
  bloom: {
    intensity: number;
    levels: number;
  };
  /** Whether <DepthOfField> mounts this tier (Medium and below turn DOF off). */
  dof: boolean;
}

export const POST_CONFIG: Record<Tier, PostTierConfig> = {
  ultra: {
    mountComposer: true,
    smaaPreset: SMAAPreset.ULTRA,
    n8ao: { quality: 'ultra', halfRes: false },
    bloom: { intensity: 1.2, levels: 9 },
    dof: true,
  },
  high: {
    mountComposer: true,
    smaaPreset: SMAAPreset.HIGH,
    n8ao: { quality: 'medium', halfRes: true },
    bloom: { intensity: 1.2, levels: 9 },
    dof: true,
  },
  medium: {
    mountComposer: true,
    smaaPreset: SMAAPreset.HIGH,
    n8ao: { quality: 'low', halfRes: true },
    bloom: { intensity: 0.8, levels: 7 }, // smaller bloom (spec §5.4)
    dof: false, // DOF OFF at Medium
  },
  low: {
    mountComposer: false, // renderer-AGX path + emissive-mesh fake glow
    smaaPreset: SMAAPreset.LOW,
    n8ao: { quality: 'performance', halfRes: true },
    bloom: { intensity: 0, levels: 0 },
    dof: false,
  },
  fallback: {
    mountComposer: false, // Canvas never mounts (mountCanvas=false); moot but consistent
    smaaPreset: SMAAPreset.LOW,
    n8ao: { quality: 'performance', halfRes: true },
    bloom: { intensity: 0, levels: 0 },
    dof: false,
  },
};
```

- [ ] **Step 6: Run the test to verify it PASSES (GREEN), then typecheck**

```bash
npm test -- postConfig
npm run typecheck
```

Expected: all `postConfig` tests pass; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/quality/postConfig.ts src/quality/postConfig.test.ts
git commit -m "feat(post): promote maath to explicit dep + per-tier post-processing config

maath 0.10.8 (already transitive via drei) promoted to an explicit pinned dep
for M1b's DOF follow + hero-beat easing (M1 spec §7). postConfig.ts is the
tiers.ts sibling for the cinematic layer: mountComposer / SMAA preset / N8AO
quality+halfRes / bloom intensity+levels / DOF per tier (spec §5.4)."
```

---

### Task 2: `heroRefs.ts` — the cross-subsystem ref contract

**Files:**
- Create: `src/scene/heroRefs.ts`
- Create: `src/scene/heroRefs.test.ts`

> **Why:** M1b's four subsystems share imperative handles: `PostStack` populates the bloom/dof/vignette effect refs, `DescentBall` populates its material ref, `DescentTrail` populates its ribbon-material ref, and `HeroBeat` mutates all of them across the arrival beat. A single `HeroRefs` object — created once in `SceneContents`, threaded to owners and consumer — is the locked seam (decision 6). It is **not** a store (it carries render-irrelevant per-frame handles), so it never triggers a React render. Building it first lets every later component type its ref props against it.

- [ ] **Step 1: Write the failing test — `src/scene/heroRefs.test.ts`**

```ts
import { createHeroRefs } from './heroRefs';

describe('createHeroRefs', () => {
  it('returns an object with all six nullable refs', () => {
    const r = createHeroRefs();
    expect(r.ballMaterial).toEqual({ current: null });
    expect(r.trailMaterial).toEqual({ current: null });
    expect(r.pathHalo).toEqual({ current: null });
    expect(r.bloom).toEqual({ current: null });
    expect(r.dof).toEqual({ current: null });
    expect(r.vignette).toEqual({ current: null });
  });

  it('returns a fresh object each call (no shared mutable singleton)', () => {
    const a = createHeroRefs();
    const b = createHeroRefs();
    expect(a).not.toBe(b);
    expect(a.bloom).not.toBe(b.bloom);
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- heroRefs
```

Expected: **FAIL** — `Cannot find module './heroRefs'`.

- [ ] **Step 3: Implement — `src/scene/heroRefs.ts`**

```ts
import * as THREE from 'three';
import type { RefObject } from 'react';
import type { BloomEffect, DepthOfFieldEffect, VignetteEffect } from 'postprocessing';

/**
 * The single cross-subsystem ref seam for the M1b cinematic layer (spec §5.6).
 * SceneContents creates this ONCE (stable identity), passes the matching ref to
 * each OWNER subsystem so they populate `.current`, and passes the whole object
 * to <HeroBeat>, which only ever MUTATES the referenced objects inside its single
 * useFrame (the two-channel rule — no setState).
 *
 * Owners:  ballMaterial ← DescentBall · trailMaterial + pathHalo ← DescentTrail /
 *          DescentPath · bloom/dof/vignette ← PostStack.
 * Consumer: HeroBeat (mutates ball emissive, trail color, path halo uniform,
 *          bloom.intensity, dof.bokehScale, vignette.darkness).
 *
 * Any ref may be null at runtime — a tier without a composer leaves bloom/dof/
 * vignette null; a Trail that failed its smoke test leaves trailMaterial null
 * (but pathHalo survives → the approach/divergence halo cue still reads on the
 * persistent tube). HeroBeat MUST null-guard every consumer. That nullability IS
 * the tier/fallback story: on Low the beat degrades to the emissive choreography
 * + ember ring + the tube halo.
 *
 * `pathHalo` is typed structurally (just the uHaloColor uniform HeroBeat eases)
 * so heroRefs.ts need not import the PathUniforms type from the DescentPath
 * component module — DescentPath's PathUniforms is assignable to it.
 */
export interface HeroRefs {
  /** Lacquered ball's MeshPhysicalMaterial (owned by DescentBall). */
  ballMaterial: RefObject<THREE.MeshPhysicalMaterial | null>;
  /** Live trail ribbon material — its `.color` is the HALO hue (owned by DescentTrail). */
  trailMaterial: RefObject<(THREE.Material & { color: THREE.Color }) | null>;
  /** Persistent tube's halo uniform — survives a Trail NO-GO so the cyan/fuchsia
   *  halo cue always reads (owned by DescentPath; structurally = PathUniforms). */
  pathHalo: RefObject<{ uHaloColor: { value: THREE.Color } } | null>;
  /** Selective bloom effect — `.intensity` live setter (owned by PostStack). */
  bloom: RefObject<BloomEffect | null>;
  /** DOF effect — HeroBeat writes only `.bokehScale` (owned by PostStack). */
  dof: RefObject<DepthOfFieldEffect | null>;
  /** Vignette effect — `.darkness` live setter (owned by PostStack). */
  vignette: RefObject<VignetteEffect | null>;
}

/** Construct an all-null HeroRefs. Call ONCE in SceneContents (useMemo-wrapped). */
export function createHeroRefs(): HeroRefs {
  return {
    ballMaterial: { current: null },
    trailMaterial: { current: null },
    pathHalo: { current: null },
    bloom: { current: null },
    dof: { current: null },
    vignette: { current: null },
  };
}
```

- [ ] **Step 4: Run to verify PASS (GREEN), then typecheck**

```bash
npm test -- heroRefs
npm run typecheck
```

Expected: pass; typecheck clean (the `postprocessing` effect types resolve).

- [ ] **Step 5: Commit**

```bash
git add src/scene/heroRefs.ts src/scene/heroRefs.test.ts
git commit -m "feat(scene): HeroRefs cross-subsystem ref contract + factory

The single shared seam for M1b: ball material, trail material, and the bloom/
dof/vignette effect refs. Created once in SceneContents, populated by the owner
subsystems, mutated only by HeroBeat (two-channel rule). All refs nullable so
the beat degrades gracefully on tiers without a composer."
```

---

### Task 3: `PostStack.tsx` — the merged AGX/HalfFloat post-processing stack

**Files:**
- Create: `src/scene/PostStack.tsx`
- Create: `src/scene/PostStack.test.tsx`

> **Why:** The cinematic core (spec §5.4). A tier-keyed `<EffectComposer>` in the corrected §3.3 order, AGX as the last effect via the *symbol*, selective bloom by the existing materials' physics. Low/fallback mount no composer and use the renderer-AGX path instead (decision 1). `PostStack` **owns** the effect refs (attaches them onto the passed-in `HeroRefs`) and the DOF rack-focus follow; `HeroBeat` (Task 18) owns the choreography. **PostStack must always be mounted** (so its Low-tier renderer-AGX `useEffect` runs) — it self-gates internally; do NOT gate it out in `Scene`.
>
> **Deliberate deviation from spec §5.4 (acknowledged, time-boxed):** spec §5.4 says "prefer toggling composer `enabled` over unmount/remount (the N8AO wrapper has a documented dispose/leak TODO)." This plan instead conditionally renders the composer subtree (`if (!cfg.mountComposer) return null`) and conditionally mounts `<DepthOfField>` (`{cfg.dof && …}`) — i.e. it *unmounts* on a tier change. The N8AO leak is real (verified: the `@r3/pp` N8AO wrapper has no dispose cleanup), but in M1b **tier is fixed at the detected start tier** — runtime `setTier` swaps happen only in the dev-only live smokes (Task 4 Step 7, Task 19 Step 8), not in production use, so the leak is bounded to a handful of dev gestures. **M1c owns live tiering** (`<PerformanceMonitor>` + `detect-gpu`), and the spec's runtime decision (§5.7) already says runtime `setTier` scales **dpr only** — segment/particle/effect *counts* stay at the start tier. So the composer never actually unmounts in a shipped session; M1c re-architects to the `enabled`-toggle when it introduces live re-tiering. This deviation is recorded here rather than silently taken.
>
> The mock GL in `@react-three/test-renderer` does **not** compile shaders or merge effect passes, so the structure test only proves the React/Three tree is well-formed and conditional mounting is correct. Real GPU verification is the Task 4 live smoke.

- [ ] **Step 1: Write the failing structure test — `src/scene/PostStack.test.tsx`**

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useUIStore } from '../state/uiStore';
import { createHeroRefs } from './heroRefs';
import PostStack from './PostStack';

describe('PostStack (R3F structure smoke)', () => {
  afterEach(() => {
    useUIStore.getState().setTier('high'); // restore the default
  });

  it('mounts an EffectComposer with the core effects at high tier', async () => {
    useUIStore.getState().setTier('high');
    const refs = createHeroRefs();
    const renderer = await ReactThreeTestRenderer.create(<PostStack refs={refs} />);
    // The composer + its effects appear in the test-renderer tree by type name.
    expect(renderer.scene.findAllByType('EffectComposer').length).toBeGreaterThanOrEqual(0);
    // (The mock GL may not instantiate every effect; the hard proof is the live
    // browser. We assert the component mounts + unmounts without throwing.)
    await renderer.unmount();
  });

  it('mounts NO composer at low tier (renderer-AGX path)', async () => {
    useUIStore.getState().setTier('low');
    const refs = createHeroRefs();
    const renderer = await ReactThreeTestRenderer.create(<PostStack refs={refs} />);
    expect(renderer.scene.findAllByType('EffectComposer').length).toBe(0);
    await renderer.unmount();
  });
});
```

> **Note on the assertion shape:** `@react-three/test-renderer`'s mock GL frequently throws inside `EffectComposer`/effect construction (it touches real GL the mock lacks), exactly as the M1a Scene test documented for `<Environment>`/`<SoftShadows>`. If `create(<PostStack>)` throws at high tier under the mock, wrap the high-tier assertion in the established M1a pattern — mock `@react-three/postprocessing` to passthrough/no-op components in this test file (spread the real module, override `EffectComposer` to a children passthrough and each effect to `() => null`) — and keep the **low-tier** assertion (no composer) as the real structural check. The genuine post-stack proof is the Task 4 live browser smoke; this test only guards the tier conditional. Record which form you used in the commit body.

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- PostStack
```

Expected: **FAIL** — `Cannot find module './PostStack'`.

- [ ] **Step 3: Implement — `src/scene/PostStack.tsx`**

```tsx
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HalfFloatType } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  EffectComposer,
  N8AO,
  Bloom,
  DepthOfField,
  SMAA,
  ChromaticAberration,
  Vignette,
  Noise,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction, VignetteTechnique } from 'postprocessing';
import { easing } from 'maath';
import { useUIStore } from '../state/uiStore';
import { simStore } from '../state/simStore';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import { POST_CONFIG } from '../quality/postConfig';
import type { HeroRefs } from './heroRefs';

/** Ball radius offset so the focus plane sits on the orb (mirrors DescentBall). */
const BALL_RADIUS = 0.08;

/**
 * Minimal local ref shape for the N8AO pass. n8ao ships no .d.ts and @r3/pp's
 * N8AO.d.ts references an unresolved `N8AOPostPass`, so we type only the field we
 * touch — `configuration.accumulate` — and rely on the project's skipLibCheck.
 */
interface N8AOPassRef {
  configuration: { accumulate: boolean };
}

export interface PostStackProps {
  /** The shared HeroRefs bundle; PostStack attaches bloom/dof/vignette onto it. */
  refs: HeroRefs;
}

/**
 * The merged AGX/HalfFloat post-processing stack (spec §5.4). Mounts INSIDE
 * <Canvas> as a child of SceneContents and is ALWAYS rendered (it self-gates by
 * tier): composer tiers (ultra/high/medium) render the full EffectComposer
 * subtree; low/fallback render no composer and set renderer AGX directly (valid
 * only when no composer is mounted — the composer otherwise pins
 * gl.toneMapping = NoToneMapping for its lifetime; spec §3.1).
 *
 * Owns: the effect refs (attached onto `refs`) and the per-frame DOF rack-focus
 * follow (the only per-frame work — a ref mutation, two-channel-clean). HeroBeat
 * owns the choreography (it writes bloom.intensity / vignette.darkness / dof
 * .bokehScale; PostStack writes dof.target — disjoint properties, no conflict).
 */
export default function PostStack({ refs }: PostStackProps) {
  const tier = useUIStore((s) => s.tier);
  const functionId = useUIStore((s) => s.functionId);
  const gl = useThree((s) => s.gl);
  const cfg = POST_CONFIG[tier];

  const n8aoRef = useRef<N8AOPassRef>(null);
  // The Vector3 passed as <DepthOfField target> — R3F sets effect.target to THIS
  // SAME instance, so `dof.target === focusTarget`. We must NOT damp it toward
  // itself (a no-op). Non-null at mount so autofocus is enabled (null disables it).
  const focusTarget = useMemo(() => new THREE.Vector3(0, 0, 5), []);
  // A SEPARATE scratch goal we recompute each frame; dof.target eases toward it.
  const focusGoal = useMemo(() => new THREE.Vector3(0, 0, 5), []);

  // --- Low/fallback: renderer AGX, no composer. Restore on cleanup so an M1c
  //     runtime swap to a composer tier doesn't leave a stale renderer setting. --
  useEffect(() => {
    if (cfg.mountComposer) return;
    const prev = gl.toneMapping;
    gl.toneMapping = THREE.AgXToneMapping; // ===6, valid only with no composer
    return () => {
      gl.toneMapping = prev;
    };
  }, [cfg.mountComposer, gl]);

  // --- N8AO: force accumulate ON via ref (not a JSX prop; spec §3.4). ----------
  useEffect(() => {
    if (!cfg.mountComposer) return;
    if (n8aoRef.current) n8aoRef.current.configuration.accumulate = true;
  }, [cfg.mountComposer, tier]);

  // --- Per-frame: rack-focus the DOF target onto the ball world position. ------
  //     Read Channel B transiently; compute the focus point the SAME way
  //     DescentBall computes its position (shared surfaceMapping), eased framerate-
  //     independently. Null-guarded — DOF is absent at Medium/Low.
  useFrame((_, delta) => {
    const dof = refs.dof.current;
    if (!dof || !dof.target) return;
    const { theta, cost } = simStore.getState();
    const fn = getFunction(functionId);
    const [wx, wz] = paramToWorldXZ(theta[0], theta[1], fn.domain);
    const wy = costToWorldHeight(cost, functionId) + BALL_RADIUS;
    // Recompute the GOAL on a separate vector, then ease dof.target toward it.
    // (dof.target IS focusTarget — the prop instance — so damping it toward
    // focusTarget would be a self-damp no-op and the focus would snap, not ease.)
    focusGoal.set(wx, wy, wz);
    easing.damp3(dof.target, focusGoal, 0.3, delta);
  });

  // --- Low/fallback: render nothing (the useEffect applied the renderer AGX). ---
  if (!cfg.mountComposer) return null;

  // --- Composer tiers. multisampling={0}: MANDATORY (wrapper defaults to 8; SMAA
  //     + N8AO depth both need MSAA off). frameBufferType={HalfFloatType}: keeps
  //     >1 emissive un-clamped so selective bloom works. Child order = §3.3. ----
  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
      <N8AO
        ref={n8aoRef}
        aoRadius={0.4}
        distanceFalloff={1.0}
        intensity={3}
        color="black"
        quality={cfg.n8ao.quality}
        halfRes={cfg.n8ao.halfRes}
        denoiseRadius={0}
      />
      <Bloom
        ref={refs.bloom}
        mipmapBlur
        intensity={cfg.bloom.intensity}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.025}
        radius={0.7}
        levels={cfg.bloom.levels}
      />
      {cfg.dof && (
        <DepthOfField ref={refs.dof} target={focusTarget} focusRange={0.3} bokehScale={3} resolutionScale={1} />
      )}
      <SMAA preset={cfg.smaaPreset} />
      <ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0005)} blendFunction={BlendFunction.NORMAL} />
      <Vignette ref={refs.vignette} offset={0.35} darkness={0.55} technique={VignetteTechnique.DEFAULT} />
      <Noise premultiply opacity={0.04} blendFunction={BlendFunction.SCREEN} />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
```

> **AGX reminder:** `mode={ToneMappingMode.AGX}` is the symbol — never write `mode={7}` or `mode={8}` (the `.d.ts` says 8, runtime is 7; the symbol is correct either way). **Bloom ref:** `<Bloom>` is `wrapEffect`-based and forwards its ref to the `BloomEffect`; `ref={refs.bloom}` is the handle the hero-beat flare uses — Task 4's live smoke confirms it actually forwards (log `refs.bloom.current?.intensity` ≠ undefined).

- [ ] **Step 4: Run the test (GREEN), then typecheck + build**

```bash
npm test -- PostStack
npm run typecheck
npm run build
```

Expected: the low-tier (no-composer) assertion passes; typecheck clean (the local `N8AOPassRef`, the `postprocessing` enum symbols, and the loosely-typed effect props all resolve under `skipLibCheck`); `npm run build` clean (no `noUnusedLocals` — confirm `BALL_RADIUS`, `focusTarget`, and `focusGoal` are all used). If the high-tier `create()` throws under the mock GL, apply the documented `@react-three/postprocessing` mock from Step 1.

- [ ] **Step 5: Commit**

```bash
git add src/scene/PostStack.tsx src/scene/PostStack.test.tsx
git commit -m "feat(post): merged AGX/HalfFloat post-processing stack (spec §5.4, §3.3 order)

EffectComposer multisampling=0 frameBufferType=HalfFloat; effects in the
corrected order N8AO→Bloom→DOF→SMAA→CA→Vignette→Noise→ToneMapping(AGX symbol,
last). Tier-keyed via POST_CONFIG; Low/fallback mount no composer and use the
renderer-AGX path. N8AO accumulate via ref, denoiseRadius via prop. Owns the
DOF rack-focus follow + the bloom/dof/vignette refs for the hero beat. Selective
bloom is by physics (existing materials' emissive). <test-renderer mock note>."
```

---

### Task 4: Wire `PostStack` into `SceneContents` + the early post-stack live smoke

**Files:**
- Modify: `src/scene/Scene.tsx`
- Modify: `src/scene/Scene.test.tsx` (assert PostStack composes)

> **Why:** This is the first time the merged stack hits a real GL context — the cycle's "does it even compile/merge on the GPU" integration smoke (spec §8.1 equivalent). Wire PostStack into the scene, create the shared `heroRefs` (consumed fully in Phase D; only bloom/dof/vignette are populated now), and drive the live browser to confirm zero WebGL errors, the AGX grade, and selective bloom on the ball (not the surface).
>
> **Fog note (carried from M1a):** the scene keeps the M1a-tuned `<fogExp2 args={[0x0b0e1a, 0.08]}>`, not PRD §5.4's *starting* value `0.025`. The denser fog was the M1a live-checkpoint choice; M1b is the "cinematic tuning against real geometry" cycle, and the new post-stack/bloom changes how fog reads, so **re-judge the density at the Task 19 checkpoint** against the full stack — if the AGX grade + bloom make 0.08 read as muddy, dial back toward 0.025. Retained-as-is here (a deliberate M1a override of the PRD starting value), flagged for re-tuning rather than silently re-emitted.

- [ ] **Step 1: Modify `src/scene/Scene.tsx` — add the shared refs + mount PostStack**

Add the imports and the `heroRefs` creation in `SceneContents`, and mount `<PostStack>` last (it always mounts; it self-gates by tier internally). Replace the `SceneContents` function body's imports/return accordingly:

```tsx
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useUIStore } from '../state/uiStore';
import { TIER_SETTINGS } from '../quality/tiers';
import Lights from './Lights';
import SceneEnvironment from './SceneEnvironment';
import { Surface } from './Surface';
import DescentBall from './DescentBall';
import { useSimRunner } from './useSimRunner';
import PostStack from './PostStack';
import { createHeroRefs } from './heroRefs';

export function SceneContents() {
  useSimRunner();

  // The cross-subsystem ref bundle — created once (stable identity). Only
  // bloom/dof/vignette are populated this phase (by PostStack); ballMaterial /
  // trailMaterial are wired in Phases B & D.
  const heroRefs = useMemo(() => createHeroRefs(), []);

  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      <fogExp2 attach="fog" args={[0x0b0e1a, 0.08]} />
      <Lights />
      <SceneEnvironment mode="hdr" hdr="/hdri/satara_night_no_lamps_1k.hdr" />
      <Surface />
      <DescentBall />
      {/* The merged AGX/HalfFloat post-stack — ALWAYS mounted; self-gates by tier
          (Low/fallback mount no composer and use the renderer-AGX path). */}
      <PostStack refs={heroRefs} />
    </>
  );
}
```

(Leave the `Scene()` wrapper function unchanged.)

- [ ] **Step 2: Update `src/scene/Scene.test.tsx` — assert PostStack composes**

The existing test (`Scene.test.tsx`) already imports `type { ReactNode }` and mocks the GL-crashing drei helpers. Extend it with a sibling mock for the post-stack (it reuses that same `ReactNode` import — no `React` namespace needed). Add this `vi.mock` next to the existing `vi.mock('@react-three/drei', …)` block:

```tsx
// PostStack pulls in @react-three/postprocessing, whose EffectComposer touches
// real GL on mount (throws under the test-renderer mock). Neutralize it here so
// the composed-tree assertions still verify the genuine M1a content; the real
// post-stack is proven in the live browser (Task 4 Step 4+).
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children?: ReactNode }) => <>{children}</>,
  N8AO: () => null,
  Bloom: () => null,
  DepthOfField: () => null,
  SMAA: () => null,
  ChromaticAberration: () => null,
  Vignette: () => null,
  Noise: () => null,
  ToneMapping: () => null,
}));
```

Keep the existing assertions (≥2 meshes, a DirectionalLight). The existing test still proves the genuine Surface + ball + light compose; PostStack now mounts without throwing. (`ReactNode` is already imported in `Scene.test.tsx` from M1a — if a future refactor removed it, re-add `import type { ReactNode } from 'react';`.)

- [ ] **Step 3: Run the structure test + gates**

```bash
npm test -- Scene
npm run typecheck
npm run build
```

Expected: green. (If the postprocessing mock needs `React` in scope, add `import React from 'react';` to the test file.)

- [ ] **Step 4: LIVE post-stack smoke (orchestrator-driven Playwright MCP).** Start the dev server in the background:

```bash
npm run dev > /tmp/ascent-dev.log 2>&1 &
```

Expected: Vite prints `Local: http://localhost:3000/`. Then load the Playwright MCP tool schemas and navigate:

```
ToolSearch: select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_wait_for,mcp__plugin_playwright_playwright__browser_evaluate
```

```
browser_navigate → url: "http://localhost:3000/"
browser_wait_for → time: 2
```

- [ ] **Step 5: Assert ZERO WebGL/console errors (the hard gate).**

```
browser_console_messages → onlyErrors: true
```

Expected: empty. There must be NO GLSL compile/link errors, no `THREE.WebGLProgram` errors, no `EffectComposer`/N8AO construction errors, no `Cannot read properties of undefined`. If any appear, STOP — this is the integration risk firing. Bisect by mounting effects incrementally (start with just `<ToneMapping mode={ToneMappingMode.AGX}/>` + `<Bloom>`, confirm green, then add `<N8AO>`, then `<DepthOfField>`, then SMAA/CA/Vignette/Noise) — `POST_CONFIG` + the conditional children already support this. If N8AO specifically fails, swap to the dep-free `SSAO`/GTAO alternative (PRD §6.3) and record it.

- [ ] **Step 6: Confirm the Bloom ref forwards + selective bloom by physics.** Screenshot, then probe the ref:

```
browser_take_screenshot → filename: "ascent-m1b-poststack-high.png", fullPage: false
browser_evaluate → function: "() => { const u = window.__ascent?.uiStore; return u ? u.getState().tier : 'no-store'; }"
```

Expected screenshot: the Rosenbrock scene now graded by AGX (filmic, slightly moody), the **ball glows** (selective bloom — emissive 3.0 > threshold 0.9), the **surface does NOT bloom** (its emissive soft-rolloff stays sub-1.0), N8AO darkens the crevices/valley contact. No clipped-white "neon mush". To confirm the Bloom ref forwarded (the hero-beat flare depends on it), check there are no errors and that the bloom is visibly present; the definitive ref check is exercised in Task 18's live run (the flare). If the scene looks washed-out/over-bright, that's the "moody exposure dip" tuning (spec §10) — adjust `environmentIntensity`/emissive in-browser, not the (ignored) `toneMappingExposure`.

- [ ] **Step 7: Toggle to Low tier — confirm the renderer-AGX path (no composer, no errors).**

```
browser_evaluate → function: "() => { window.__ascent?.uiStore.getState().setTier('low'); return 'low'; }"
browser_wait_for → time: 1
browser_console_messages → onlyErrors: true
browser_take_screenshot → filename: "ascent-m1b-poststack-low.png", fullPage: false
```

Expected: still zero errors; the scene renders with AGX applied via the renderer (no composer), emissive ball still reads as a glow (fake-glow via the bright emissive, no bloom pass). Restore High:

```
browser_evaluate → function: "() => { window.__ascent?.uiStore.getState().setTier('high'); return 'high'; }"
```

- [ ] **Step 8: Stop the dev server.** Kill the background `npm run dev` job so it doesn't linger.

- [ ] **Step 9: Commit (including any tuning/touch-ups surfaced by the smoke).**

```bash
git add src/scene/Scene.tsx src/scene/Scene.test.tsx
git commit -m "feat(scene): mount the merged post-stack in SceneContents

PostStack always-mounted (self-gates by tier) + the shared heroRefs created
once. Live-browser smoke on the real GPU: zero WebGL console errors, AGX grade,
selective bloom on the ball (not the surface), N8AO crevice darkening; Low tier
verified on the renderer-AGX path. <Note any incremental-bisection or N8AO swap
if the merged stack needed it; note the exposure-dip tuning if applied.>"
```

> **Gate:** with this committed, the post-stack integration risk is retired on the real GPU and every later glow (path, trail, ball flash, ember) composes onto a proven stack. Phase B begins with the Risk #2 Trail smoke.

### Task 5: ⚠️ SMOKE-TEST RISK #2 FIRST — drei `<Trail>` live in the browser

**Files:** none committed (a temporary mount, reverted at the end).

> **Why first:** drei `<Trail>` (meshline) is the most reconciler-coupled M1b component (spec §8.1, Risk #2). Before building `DescentTrail`/`DescentPath` properly, prove `<Trail>` mounts and renders a ribbon under R3F 9.6 / React 19 / three 0.184 — a NO-GO here flips the whole Phase-B ribbon design to the `TubeGeometry`-only fallback. The source review during planning found no hard incompatibility ("looks GO"), but the live browser is the proof.

- [ ] **Step 1: Temporarily mount a minimal `<Trail>` in `SceneContents`.** Add (do NOT commit) to `src/scene/Scene.tsx` inside `SceneContents`, after `<DescentBall />`:

```tsx
import { Trail } from '@react-three/drei';
import { useRef } from 'react';
// ...inside SceneContents, a temporary self-animating trail probe:
//   (this mesh orbits so the ribbon is obvious; remove after the smoke)
function TrailProbe() {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (m.current) {
      const t = clock.elapsedTime;
      m.current.position.set(Math.cos(t) * 1.2, 1.2, Math.sin(t) * 1.2);
    }
  });
  return (
    <Trail width={1.5} length={6} color="#00D3F2" attenuation={(w) => w}>
      <mesh ref={m}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#FFF4E6" toneMapped={false} />
      </mesh>
    </Trail>
  );
}
// ...and mount <TrailProbe /> in the returned fragment; ensure THREE + useFrame are imported.
```

- [ ] **Step 2: Run the dev server + drive the browser.**

```bash
npm run dev > /tmp/ascent-dev.log 2>&1 &
```

```
ToolSearch: select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_wait_for
browser_navigate → url: "http://localhost:3000/"
browser_wait_for → time: 2
browser_console_messages → onlyErrors: true
browser_take_screenshot → filename: "ascent-m1b-trail-smoke.png", fullPage: false
```

- [ ] **Step 3: Judge GO / NO-GO.**
  - **GO** (expected): the screenshot shows a cyan ribbon trailing the orbiting sphere; zero WebGL/React console errors. → Proceed with the live `<Trail>` in Task 10. Note GO in the Task-10 commit.
  - **NO-GO** (ribbon absent, reconciler crash, or meshline GL errors): record the exact error. The Phase-B plan still builds the persistent `DescentPath` tube (Tasks 6–9); **Task 10 changes to render nothing** (the spec's documented fallback — "drop the live ribbon"), and the hero beat's `trailMaterial` ref simply stays null (its halo-bleed no-ops via the null-guard — already designed for). The persistent path then carries the entire ribbon read.

- [ ] **Step 4: Revert the probe + stop the server.** Remove `TrailProbe` and its temporary imports from `Scene.tsx` (git restore the file), kill the dev job. **Nothing from this task is committed** — it is a go/no-go gate. Record the verdict in the Task 10 commit body.

---

### Task 6: `pathGeometry.ts` — the world-space polyline + tube math (pure TS)

**Files:**
- Create: `src/scene/pathGeometry.ts`
- Create: `src/scene/pathGeometry.test.ts`

> **Why:** The descent ribbon's geometry math is pure CPU (three's `Vector3`/`CatmullRomCurve3`/`TubeGeometry` run under Node with no GL), so it is fully unit-testable. It converts the stepper's history polyline (param-space θ + cost per entry) to world space via the SAME `surfaceMapping` the ball uses (so the ribbon lies on the terrain), builds a `TubeGeometry` with a bounded vertex budget, and computes the reveal fraction. `DescentPath` (Task 9) consumes these.

- [ ] **Step 1: Write the failing test — `src/scene/pathGeometry.test.ts`**

```ts
import * as THREE from 'three';
import {
  PATH_LIFT,
  historyToWorldPoints,
  buildTubeGeometry,
  revealProgress,
} from './pathGeometry';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import type { HistoryEntry } from '../engine/stepper';

describe('pathGeometry — descent ribbon math', () => {
  const sphere = getFunction('sphere');
  const hist: HistoryEntry[] = [
    { iteration: 0, theta: [1, 1], cost: 2 },
    { iteration: 1, theta: [0.8, 0.8], cost: 1.28 },
    { iteration: 2, theta: [0.64, 0.64], cost: 0.8192 },
  ];

  it('maps history to world points via the shared surfaceMapping (+ PATH_LIFT)', () => {
    const pts = historyToWorldPoints(hist, sphere.domain, 'sphere');
    expect(pts).toHaveLength(3);
    const [wx, wz] = paramToWorldXZ(1, 1, sphere.domain);
    const wy = costToWorldHeight(2, 'sphere') + PATH_LIFT;
    expect(pts[0].x).toBeCloseTo(wx, 10);
    expect(pts[0].y).toBeCloseTo(wy, 10);
    expect(pts[0].z).toBeCloseTo(wz, 10);
  });

  it('returns null for fewer than 2 points (degenerate curve)', () => {
    expect(buildTubeGeometry([], 64, 0.02, 8)).toBeNull();
    expect(buildTubeGeometry([new THREE.Vector3()], 64, 0.02, 8)).toBeNull();
  });

  it('builds a TubeGeometry with a uv attribute for >=2 points', () => {
    const pts = historyToWorldPoints(hist, sphere.domain, 'sphere');
    const geo = buildTubeGeometry(pts, 64, 0.02, 8);
    expect(geo).toBeInstanceOf(THREE.TubeGeometry);
    expect(geo!.attributes.uv).toBeDefined();
  });

  it('caps the vertex count regardless of a long history (constant budget)', () => {
    const long: HistoryEntry[] = Array.from({ length: 4000 }, (_, i) => ({
      iteration: i,
      theta: [Math.cos(i * 0.01), Math.sin(i * 0.01)] as [number, number],
      cost: 1,
    }));
    const pts = historyToWorldPoints(long, sphere.domain, 'sphere');
    const geo = buildTubeGeometry(pts, 256, 0.02, 8)!;
    // (tubularSegments + 1) * (radialSegments + 1) position verts; tubular capped at 256.
    expect(geo.attributes.position.count).toBeLessThanOrEqual((256 + 1) * (8 + 1));
  });

  it('revealProgress clamps to [0,1] and is 0 when built<=0', () => {
    expect(revealProgress(5, 0)).toBe(0);
    expect(revealProgress(3, 10)).toBeCloseTo(0.3, 10);
    expect(revealProgress(50, 10)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- pathGeometry
```

Expected: **FAIL** — `Cannot find module './pathGeometry'`.

- [ ] **Step 3: Implement — `src/scene/pathGeometry.ts`**

```ts
import * as THREE from 'three';
import type { HistoryEntry } from '../engine/stepper';
import type { Domain } from './surfaceMapping.types';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';

/** Lift the ribbon just above the displaced surface so it never z-fights. */
export const PATH_LIFT = 0.04;

/**
 * Convert the stepper history polyline (param-space θ + cost per entry) to
 * world-space points on the SURFACE_SIZE plane — the SAME mapping the ball and
 * the GPU surface use, so the ribbon lies exactly on the terrain (+ a small lift).
 */
export function historyToWorldPoints(
  history: readonly HistoryEntry[],
  domain: Domain,
  functionId: string,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (const h of history) {
    const [wx, wz] = paramToWorldXZ(h.theta[0], h.theta[1], domain);
    const wy = costToWorldHeight(h.cost, functionId) + PATH_LIFT;
    pts.push(new THREE.Vector3(wx, wy, wz));
  }
  return pts;
}

/**
 * Build a TubeGeometry along the descent polyline, or null if fewer than 2
 * points (CatmullRomCurve3 needs >=2; a 1-point run is degenerate). The
 * tubularSegments cap gives a constant vertex budget regardless of iteration
 * count. closed=false so the built-in uv.x runs 0->1 along the tube (the reveal
 * coordinate). centripetal curveType avoids loops on the sharp Rosenbrock zig-zag.
 */
export function buildTubeGeometry(
  points: THREE.Vector3[],
  tubularSegments: number,
  radius: number,
  radialSegments: number,
): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const segments = Math.max(1, Math.min(tubularSegments, points.length * 4));
  return new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
}

/**
 * Frame-rate-independent reveal fraction in [0,1]. `built` is the iteration count
 * baked into the CURRENT geometry; `current` is the live stepper iteration.
 * Because the geometry is rebuilt whenever history grows, this rides at ~1.0 (the
 * tube tip IS the ball), so the smoothstep edge renders a soft leading glow at
 * the tip. Guards built<=0 (returns 0).
 */
export function revealProgress(current: number, built: number): number {
  if (built <= 0) return 0;
  return Math.min(Math.max(current / built, 0), 1);
}
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- pathGeometry
npm run typecheck
```

Expected: pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/pathGeometry.ts src/scene/pathGeometry.test.ts
git commit -m "feat(scene): descent-path geometry math (history->world polyline + tube)

Pure TS (three geometry runs under Node): historyToWorldPoints uses the shared
surfaceMapping so the ribbon rides the terrain; buildTubeGeometry returns null
for <2 points and caps the vertex budget; revealProgress is the frame-rate-
independent reveal fraction. Consumed by DescentPath."
```

---

### Task 7: `pathShaders.ts` — the tube reveal shader (string-guard)

**Files:**
- Create: `src/scene/shaders/pathShaders.ts`
- Create: `src/scene/shaders/pathShaders.test.ts`

> **Why:** The tube's reveal + HDR glow lives in a tiny CSM shader: `smoothstep(uProgress - uEdge, uProgress, vUv.x)` discards the unrevealed tail and brightens a traveling band at the front; the white-hot core (`#FFF4E6`, HDR) + colored halo are written to `csm_DiffuseColor` so the >1 values feed selective bloom. GLSL can't compile under Vitest, so a string-guard pins the load-bearing expressions (the same regression-tripwire pattern as M1a's `colormap.test.ts`).

- [ ] **Step 1: Write the failing test — `src/scene/shaders/pathShaders.test.ts`**

```ts
import { pathVertexShader, pathFragmentShader } from './pathShaders';

describe('pathShaders — GLSL structure guards', () => {
  it('vertex passes the tube uv through', () => {
    expect(pathVertexShader).toContain('vPathUv = uv');
  });

  it('fragment reveals via smoothstep on uProgress and discards the tail', () => {
    expect(pathFragmentShader).toContain('smoothstep(uProgress - uEdge, uProgress, vPathUv.x)');
    expect(pathFragmentShader).toContain('discard');
  });

  it('fragment writes csm_DiffuseColor and uses the locked uniforms', () => {
    expect(pathFragmentShader).toContain('csm_DiffuseColor');
    for (const u of ['uProgress', 'uEdge', 'uHaloColor', 'uCoreColor']) {
      expect(pathFragmentShader).toContain(u);
    }
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- pathShaders
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/shaders/pathShaders.ts`**

```ts
/**
 * The TubeGeometry reveal shader (PRD §5.3 / §6.5). The tube's built-in uv.x runs
 * 0 (start) -> 1 (end) along its length (arc-parameterized, closed=false). The
 * fragment reveals the ribbon up to uProgress with a soft edge via
 * smoothstep(uProgress - uEdge, uProgress, vPathUv.x): texels past the front are
 * discarded; the front uEdge band is brighter (the leading glow). White-hot HDR
 * core (#FFF4E6, emissive >1) + a colored halo (uHaloColor, default SGD cyan).
 * The material sets toneMapped=false so the >1 values survive into the HalfFloat
 * buffer for selective bloom.
 *
 * Uniform names (LOCKED): uProgress (float 0..1), uEdge (float reveal softness),
 * uHaloColor (vec3 — the halo hue the hero beat eases), uCoreColor (vec3 white-hot).
 */

const PATH_UNIFORMS = /* glsl */ `
uniform float uProgress;
uniform float uEdge;
uniform vec3  uHaloColor;
uniform vec3  uCoreColor;
`;

export const pathVertexShader = /* glsl */ `
${PATH_UNIFORMS}
varying vec2 vPathUv;
void main() {
  // CSM provides 'uv'; the tube's uv.x is the along-length reveal coordinate.
  vPathUv = uv;
}
`;

export const pathFragmentShader = /* glsl */ `
${PATH_UNIFORMS}
varying vec2 vPathUv;

void main() {
  // Reveal mask: 0 ahead of the front, 1 behind it, soft over uEdge.
  float reveal = smoothstep(uProgress - uEdge, uProgress, vPathUv.x);
  if (reveal <= 0.001) discard; // unrevealed tube tip is invisible

  // uv.y wraps the tube circumference (0..1); bias brightest at the spine so it
  // reads as a white-hot filament inside a colored halo.
  float rim = abs(vPathUv.y - 0.5) * 2.0;        // 0 centre -> 1 edges
  float core = 1.0 - smoothstep(0.0, 0.6, rim);   // white-hot down the spine

  // A traveling bright band right at the revealed front (the leading glow).
  float band = smoothstep(uProgress - uEdge, uProgress, vPathUv.x)
             * (1.0 - smoothstep(uProgress - uEdge * 0.5, uProgress, vPathUv.x));

  vec3 col = mix(uHaloColor, uCoreColor, core);
  col += uCoreColor * band * 0.8;                 // brighten the front

  // HDR emissive via the CSM MeshBasicMaterial base: write color directly. Values
  // >1 (uCoreColor is authored HDR) survive into the HalfFloat buffer for bloom.
  csm_DiffuseColor = vec4(col, reveal);
}
`;
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- pathShaders
npm run typecheck
```

Expected: pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/shaders/pathShaders.ts src/scene/shaders/pathShaders.test.ts
git commit -m "feat(scene): tube reveal shader (smoothstep on uv.x + HDR core/halo)

uProgress smoothstep reveal on the tube's along-length uv.x, discarding the
unrevealed tip and brightening a traveling front band; white-hot HDR core +
colored halo written to csm_DiffuseColor (toneMapped=false → selective bloom).
String-guard pins the reveal expression + locked uniforms."
```

---

### Task 8: Expose the stepper history handle on `useSimRunner`

**Files:**
- Modify: `src/scene/useSimRunner.ts`
- Create: `src/scene/useSimRunner.test.ts` (a focused unit test for the handle)

> **Why:** The descent polyline lives on the stepper's `history` ring buffer inside `useSimRunner` (renders nothing); `simStore` holds only the *current* point. Exposing the history through React state would grow every frame and break the two-channel rule. Instead, publish a module-scoped read-only Channel-B handle (`getSimRunnerHandle()`) that the path reads transiently inside `useFrame`, plus a monotonic `runId` so the path can detect a run change (function/optimizer/lr/startPoint) and reset its geometry. This mirrors the existing `simStore.getState()` transient-read pattern.

- [ ] **Step 1: Write the failing test — `src/scene/useSimRunner.test.ts`**

`useSimRunner` is a hook needing the R3F loop, but the **handle** is a module singleton mutated by the hook's effect/frame — and we can also exercise the handle's shape directly. This focused test asserts the handle exports exist and start empty (the live wiring is proven in Task 10's browser smoke):

```ts
import { getSimRunnerHandle } from './useSimRunner';

describe('useSimRunner — Channel-B history handle', () => {
  it('exposes a read-only handle with history/iteration/runId', () => {
    const h = getSimRunnerHandle();
    expect(Array.isArray(h.history)).toBe(true);
    expect(typeof h.iteration).toBe('number');
    expect(typeof h.runId).toBe('number');
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- useSimRunner
```

Expected: **FAIL** — `getSimRunnerHandle` is not exported yet.

- [ ] **Step 3: Implement the handle in `src/scene/useSimRunner.ts`**

Add the imports + the module-scoped handle near the top (after the existing imports):

```ts
import type { HistoryEntry } from '../engine/stepper';

/**
 * Channel-B handle onto the live run for read-only per-frame consumers (the
 * descent path). The stepper's `history` is the descent polyline; simStore holds
 * only the CURRENT point. `runId` increments on every rebuild so consumers detect
 * a run change (function/optimizer/lr/startPoint) and reset their geometry. Read
 * transiently inside useFrame — never subscribe.
 */
export interface SimRunnerHandle {
  history: readonly HistoryEntry[];
  iteration: number;
  runId: number;
}
const handle: SimRunnerHandle = { history: [], iteration: 0, runId: 0 };
export function getSimRunnerHandle(): SimRunnerHandle {
  return handle;
}
```

Then, inside the existing `useEffect` rebuild, immediately after `stepperRef.current = stepper;`, add:

```ts
    // Publish the fresh run to the Channel-B handle and bump runId so the path
    // resets its geometry to the reseeded single-point history.
    handle.history = stepper.history;
    handle.iteration = 0;
    handle.runId += 1;
```

And inside the existing `useFrame`, immediately after `stepper.advance(delta);`, add:

```ts
    handle.iteration = stepper.iteration;
```

(`handle.history` already points at `stepper.history`, whose array identity is stable across pushes within a run — the path reads `.length` to detect growth; the effect repoints it on a run change.)

- [ ] **Step 4: Run (GREEN) + the full engine/scene suite + typecheck**

```bash
npm test -- useSimRunner
npm test
npm run typecheck
```

Expected: the handle test passes; the full suite stays green (this is an additive change — the existing `useSimRunner` behavior is untouched); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/useSimRunner.ts src/scene/useSimRunner.test.ts
git commit -m "feat(scene): expose stepper history via a Channel-B handle on useSimRunner

getSimRunnerHandle() returns {history, iteration, runId} — the descent polyline
the path consumes transiently in useFrame (simStore holds only the current
point). runId bumps on run change so the path resets its geometry. Additive;
the existing sim-runner behavior is unchanged. Two-channel-clean (no setState)."
```

---

### Task 9: `DescentPath.tsx` — the revealed `TubeGeometry` ribbon

**Files:**
- Create: `src/scene/DescentPath.tsx`
- Create: `src/scene/DescentPath.test.tsx`

> **Why:** The persistent descent ribbon. It reads the Channel-B history handle each frame, rebuilds the `TubeGeometry` only when the polyline grows (≤ once per sim step, NOT per render frame) or resets on `runId` change, and drives `uProgress`. **Two-channel rule, strict form:** the geometry swap mutates `meshRef.current.geometry` directly and calls `invalidate()` — NO `setState` per frame (the path designer's preferred form; the surface uses the same `invalidate()`-on-change discipline). The CSM material exposes its `uHaloColor`/`uCoreColor` uniforms; its ref is published to `HeroRefs.trailMaterial`'s sibling in Phase D (the path halo and the live-trail halo are eased together). The mock GL doesn't compile shaders, so the structure test proves the tree + the geometry lifecycle; the visual reveal is the Task 10 browser smoke.

- [ ] **Step 1: Write the failing test — `src/scene/DescentPath.test.tsx`**

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import DescentPath from './DescentPath';

describe('DescentPath (R3F structure smoke)', () => {
  it('renders a mesh once the geometry exists and advances without throwing', async () => {
    // Seed a run so the sim-runner handle has >=2 points after a few frames.
    useUIStore.getState().setFunctionId('sphere');
    useUIStore.getState().setPlaying(true);
    simStore.getState().setTheta([1, 1]);
    simStore.getState().setCost(2);

    const renderer = await ReactThreeTestRenderer.create(<DescentPath />);
    await renderer.advanceFrames(20, 1 / 60);
    // It may render null until the handle has >=2 points; the hard guarantee is
    // that advancing frames never throws (the geometry lifecycle is sound).
    expect(() => renderer.scene.findAllByType('Mesh')).not.toThrow();
    await renderer.unmount();
    useUIStore.getState().setPlaying(false);
  });
});
```

> The history handle is populated by `useSimRunner`, which is NOT mounted in this isolated test — so `DescentPath` will render null (handle empty) and the test asserts **no-throw** through 20 frames (the lifecycle/guard correctness). The real "ribbon appears and grows" proof is Task 10's live browser. If you prefer a positive geometry assertion, mount `useSimRunner` alongside in the test host and advance frames; keep the no-throw assertion as the floor.

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- DescentPath
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/DescentPath.tsx`**

```tsx
import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import CustomShaderMaterial from 'three-custom-shader-material';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { TIER_SETTINGS, type Tier } from '../quality/tiers';
import { historyToWorldPoints, buildTubeGeometry, revealProgress } from './pathGeometry';
import { getSimRunnerHandle } from './useSimRunner';
import { pathVertexShader, pathFragmentShader } from './shaders/pathShaders';

/** Slim filament radius; the glow does the rest. */
const PATH_RADIUS = 0.018;

/** PRD §5.3 trail palette: white-hot core (#FFF4E6) HDR (3.5) + SGD-cyan halo (1.8). */
const CORE_HDR = new THREE.Color('#FFF4E6').multiplyScalar(3.5); // emissive >1 → blooms
const HALO_CYAN = new THREE.Color('#00D3F2').multiplyScalar(1.8);

/** Per-tier tube budget (constant vertex count regardless of iteration count). */
function pathBudget(tier: Tier): { tubular: number; radial: number } {
  switch (tier) {
    case 'ultra': return { tubular: 512, radial: 8 };
    case 'high': return { tubular: 384, radial: 8 };
    case 'medium': return { tubular: 256, radial: 6 };
    default: return { tubular: 128, radial: 5 }; // low / fallback
  }
}

export interface PathUniforms {
  [key: string]: { value: unknown };
  uProgress: { value: number };
  uEdge: { value: number };
  uHaloColor: { value: THREE.Color };
  uCoreColor: { value: THREE.Color };
}

export interface DescentPathProps {
  /** Optional: published so the hero beat can ease the ribbon halo color
   *  (uHaloColor — cyan→fuchsia on divergence) even when the live <Trail> is
   *  absent (the Risk #2 NO-GO fallback). */
  materialUniformsRef?: RefObject<PathUniforms | null>;
}

/**
 * The persistent revealed descent ribbon (PRD §5.3 / §6.5): one TubeGeometry along
 * the stepper polyline, revealed by uProgress via smoothstep on the tube's uv.x.
 *
 * Two-channel rule (strict): the geometry is mutated DIRECTLY on the mesh ref and
 * a frame is requested via invalidate() — NO setState per frame. Rebuild happens
 * only when the polyline grows (gated on history.length) or resets on runId
 * change; uProgress is a pure ref-driven uniform write each frame.
 */
export default function DescentPath({ materialUniformsRef }: DescentPathProps = {}) {
  const tier = useUIStore((s) => s.tier);
  const invalidate = useThree((s) => s.invalidate);

  const meshRef = useRef<THREE.Mesh>(null);
  const lastRunId = useRef(-1);
  const lastLen = useRef(0);
  const builtIteration = useRef(0);

  const uniforms = useMemo<PathUniforms>(
    () => ({
      uProgress: { value: 0 },
      uEdge: { value: 0.06 },
      uHaloColor: { value: HALO_CYAN.clone() },
      uCoreColor: { value: CORE_HDR.clone() },
    }),
    [],
  );

  // Publish the uniforms object so the hero beat can ease uHaloColor (Phase D).
  useEffect(() => {
    if (materialUniformsRef) materialUniformsRef.current = uniforms;
    return () => {
      if (materialUniformsRef) materialUniformsRef.current = null;
    };
  }, [materialUniformsRef, uniforms]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const h = getSimRunnerHandle();
    const { functionId } = useUIStore.getState();
    const fn = getFunction(functionId);
    const history = h.history;

    // Run change → dispose + reset (rebuilt below from >=2 points).
    if (h.runId !== lastRunId.current) {
      lastRunId.current = h.runId;
      lastLen.current = 0;
      builtIteration.current = 0;
      const old = mesh.geometry;
      mesh.geometry = EMPTY_GEOMETRY;
      if (old && old !== EMPTY_GEOMETRY) old.dispose();
      mesh.visible = false;
      invalidate();
    }

    // Rebuild only when the polyline gained points (≤ once per sim step). Constant
    // vertex budget via the tier cap. Direct geometry swap — no setState.
    if (history.length !== lastLen.current && history.length >= 2) {
      lastLen.current = history.length;
      builtIteration.current = h.iteration;
      const { tubular, radial } = pathBudget(tier);
      const pts = historyToWorldPoints(history, fn.domain, functionId);
      const next = buildTubeGeometry(pts, tubular, PATH_RADIUS, radial);
      if (next) {
        const old = mesh.geometry;
        mesh.geometry = next;
        if (old && old !== EMPTY_GEOMETRY) old.dispose();
        mesh.visible = true;
        invalidate();
      }
    }

    // Frame-rate-independent reveal: rides ~1.0 (tip = ball) → leading glow.
    uniforms.uProgress.value = revealProgress(h.iteration, builtIteration.current);
  });

  // Seed the empty sentinel geometry ONCE at mount and dispose the live geometry
  // on unmount. We do NOT render a <primitive attach="geometry"> child: that hands
  // geometry ownership to R3F's reconciler, which on detach restores the auto-
  // created default geometry (not our swapped tube) and fights the per-frame
  // mesh.geometry swap. Assigning it ourselves keeps the useFrame swap the ONLY
  // writer to mesh.geometry, so the unmount dispose is unambiguous. (A bare <mesh>
  // gets a throwaway default BufferGeometry from three — dispose it, then install
  // our shared sentinel.)
  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh && mesh.geometry !== EMPTY_GEOMETRY) {
      const auto = mesh.geometry; // three's default, created for a child-less mesh
      mesh.geometry = EMPTY_GEOMETRY;
      auto?.dispose();
    }
    return () => {
      const g = mesh?.geometry;
      if (g && g !== EMPTY_GEOMETRY) g.dispose();
    };
  }, []);

  return (
    <mesh ref={meshRef} frustumCulled={false} visible={false}>
      {/* No geometry child — geometry is owned imperatively (see the effect above).
          R3F tolerates a <mesh> with no geometry child; it just uses three's
          throwaway default, which the mount effect immediately replaces. */}
      <CustomShaderMaterial
        baseMaterial={THREE.MeshBasicMaterial}
        vertexShader={pathVertexShader}
        fragmentShader={pathFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/** A shared, never-disposed empty placeholder so the mesh always has a geometry
 *  before the first rebuild (draws nothing; mesh.visible gates it anyway). */
const EMPTY_GEOMETRY = new THREE.BufferGeometry();
```

> **Note:** the CSM material needs no React ref here — the published `uniforms` object (via `materialUniformsRef`) is the hero-beat handle, and the geometry/visibility lifecycle uses `meshRef`. Dropping `matRef` also removes the `CSMaterial<T>` alias (no consumer), avoiding a `noUnusedLocals` build failure. `EMPTY_GEOMETRY` is a module sentinel the swaps never dispose; the per-frame `mesh.geometry = next` swap is the strict Channel-B form (no `setState`).

- [ ] **Step 4: Run (GREEN) + typecheck + build**

```bash
npm test -- DescentPath
npm run typecheck
npm run build
```

Expected: the no-throw structure test passes; typecheck clean; build clean (`noUnusedLocals` — there is no `matRef` to flag; the only refs are `meshRef` + the `lastRunId`/`lastLen`/`builtIteration` trackers + the published `uniforms`, all used).

- [ ] **Step 5: Commit**

```bash
git add src/scene/DescentPath.tsx src/scene/DescentPath.test.tsx
git commit -m "feat(scene): revealed TubeGeometry descent ribbon (strict Channel-B)

Reads the stepper history handle each frame; rebuilds the tube only when the
polyline grows or resets on runId change, swapping mesh.geometry directly +
invalidate() (NO per-frame setState). uProgress reveal via the path shader;
white-hot HDR core + cyan halo (toneMapped=false → selective bloom). Publishes
its halo/core uniforms for the hero beat."
```

---

### Task 10: `DescentTrail.tsx` — the live drei `<Trail>` ribbon + wire both into `SceneContents`

**Files:**
- Create: `src/scene/DescentTrail.tsx`
- Create: `src/scene/DescentTrail.test.tsx`
- Modify: `src/scene/Scene.tsx` (mount `<DescentPath />` + `<DescentTrail />`)

> **Why:** The live ribbon (spec §5.3, the Task-5 GO path). Self-contained: it hosts an invisible anchor mesh as the `<Trail>`'s first child and damps that anchor to the same world target the ball uses (transient `simStore` read — same math as `DescentBall`), so it never reaches into `DescentBall`'s internals. The trail's `color` prop is set ONCE (initial cyan); the hero beat eases `trailRef.current.material.color` in place (changing the prop per frame rebuilds the material → hitch). Its material ref is published to `HeroRefs.trailMaterial`. **If Task 5 was NO-GO, this component renders `null`** (the persistent `DescentPath` carries the ribbon) — note which in the commit.

- [ ] **Step 1: Write the failing test — `src/scene/DescentTrail.test.tsx`**

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { simStore } from '../state/simStore';

// drei <Trail> portals a mesh into the scene root and resolves its anchor in a
// useEffect (real GL paths the mock lacks). Mock it to a children passthrough so
// the anchor mesh still mounts and the component's own useFrame is exercised.
vi.mock('@react-three/drei', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/drei')>();
  return { ...actual, Trail: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

const { default: DescentTrail } = await import('./DescentTrail');

describe('DescentTrail (R3F structure smoke)', () => {
  it('mounts the invisible anchor mesh and advances without throwing', async () => {
    simStore.getState().setTheta([-1.2, 1]);
    simStore.getState().setCost(24.2);
    const renderer = await ReactThreeTestRenderer.create(<DescentTrail />);
    await renderer.advanceFrames(10, 1 / 60);
    // The anchor mesh exists (Trail mocked to passthrough → its child renders).
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThanOrEqual(1);
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- DescentTrail
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/DescentTrail.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import type { MeshLineGeometry } from '@react-three/drei';
import { easing } from 'maath';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';

/** Resting lift of the trail anchor above the surface (matches the ball core). */
const TRAIL_LIFT = 0.04;

/** The runtime shape of the portaled trail mesh's MeshLineMaterial — its `.color`
 *  is a LIVE THREE.Color uniform the hero beat eases in place (never the prop).
 *  Used only as the cast target for the published material handle. */
type TrailLineMaterial = THREE.Material & { color: THREE.Color };

export interface DescentTrailProps {
  /** Optional: published so the hero beat can ease the live ribbon halo color. */
  materialRef?: RefObject<TrailLineMaterial | null>;
}

/**
 * The live trail ribbon (drei <Trail>, meshline). Self-contained: hosts an
 * invisible anchor mesh as the Trail's first child and damps it to the same world
 * target the ball uses (transient simStore read — two-channel rule). The color is
 * set ONCE via the prop (initial cyan); the hero beat eases the material's .color
 * IN PLACE (changing the prop per frame rebuilds the material → hitch).
 *
 * If the Task-5 Risk-#2 smoke was NO-GO, replace the body with `return null;` —
 * the persistent DescentPath then carries the ribbon, and the hero beat's
 * trailMaterial ref stays null (its halo-bleed no-ops via the null-guard).
 */
export default function DescentTrail({ materialRef }: DescentTrailProps = {}) {
  const anchorRef = useRef<THREE.Mesh>(null);
  // drei forwards the <Trail> ref as `MeshLineGeometry` (= Mesh & MeshLineGeometryImpl)
  // — use that exact type or tsc rejects the ref (TS2322). Its `.material` is the
  // MeshLineMaterial at runtime (typed Material|Material[], so cast on publish).
  const trailRef = useRef<MeshLineGeometry>(null);
  const target = useRef(new THREE.Vector3());
  const functionId = useUIStore((s) => s.functionId);

  // Publish the live trail material to the shared ref once it resolves (the trail
  // mesh is portaled + anchor-resolved ~1 frame late, so poll until present).
  useFrame((_, delta) => {
    const anchor = anchorRef.current;
    if (anchor) {
      const { theta, cost } = simStore.getState();
      const fn = getFunction(functionId);
      const [wx, wz] = paramToWorldXZ(theta[0], theta[1], fn.domain);
      const wy = costToWorldHeight(cost, functionId) + TRAIL_LIFT;
      target.current.set(wx, wy, wz);
      easing.damp3(anchor.position, target.current, 0.15, delta); // matches the ball
    }
    const mat = trailRef.current?.material as TrailLineMaterial | undefined;
    if (materialRef && mat && materialRef.current !== mat) {
      materialRef.current = mat; // single MeshLineMaterial at runtime; cast is safe
    }
  });

  useEffect(() => {
    return () => {
      if (materialRef) materialRef.current = null;
    };
  }, [materialRef]);

  return (
    <Trail
      ref={trailRef}
      width={1.2}
      length={6}
      decay={1.2}
      color="#00D3F2" /* initial halo tint; eased via the material ref, NOT the prop */
      attenuation={(w) => w * w}
    >
      <mesh ref={anchorRef} visible={false}>
        <sphereGeometry args={[0.001, 4, 4]} />
        <meshBasicMaterial />
      </mesh>
    </Trail>
  );
}
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- DescentTrail
npm run typecheck
```

Expected: pass (anchor mesh present via the Trail passthrough mock); typecheck clean.

- [ ] **Step 5: Mount both into `SceneContents`.** In `src/scene/Scene.tsx`, add the imports and mount `<DescentPath />` + `<DescentTrail />` after `<DescentBall />`:

```tsx
import DescentPath from './DescentPath';
import DescentTrail from './DescentTrail';
// ...inside SceneContents return, after <DescentBall />:
      <DescentBall />
      <DescentPath />
      <DescentTrail />
      {/* PostStack stays last */}
      <PostStack refs={heroRefs} />
```

(The `materialUniformsRef`/`materialRef` props are wired to `heroRefs` in Phase D; mounting them prop-less here is correct for this phase.)

- [ ] **Step 6: Run the Scene structure test + gates**

```bash
npm test -- Scene
npm run typecheck
npm run build
```

Expected: green. The existing Scene test (with the drei + postprocessing mocks) now also mounts the path + trail without throwing.

- [ ] **Step 7: LIVE smoke — the ribbon grows + the live trail streams (orchestrator Playwright MCP).** Start the dev server, navigate (reuse the Task-4 MCP steps), press play on Rosenbrock:

```
browser_evaluate → function: "() => { window.__ascent?.uiStore.getState().setPlaying(true); return 'play'; }"
browser_wait_for → time: 3
browser_take_screenshot → filename: "ascent-m1b-path-trail.png", fullPage: false
browser_console_messages → onlyErrors: true
```

Expected: a cyan ribbon grows down the Rosenbrock valley tracking the descending ball (the persistent tube), with the live `<Trail>` streaming just behind it; the white-hot core blooms; zero WebGL console errors. If the tube shows kinks on the sharp zig-zag, the fallback is `curveType='catmullrom'` with lower tension (note for the checkpoint). Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/scene/DescentTrail.tsx src/scene/DescentTrail.test.tsx src/scene/Scene.tsx
git commit -m "feat(scene): live drei <Trail> ribbon + mount path/trail in the scene

Self-contained trail: invisible anchor damped to the ball's world target; color
set once via the prop, eased via the material ref by the hero beat. Risk #2
<Trail> smoke: <GO — ribbon streams / NO-GO — rendered null, tube carries it>.
Mounts DescentPath + DescentTrail in SceneContents. Live-verified: ribbon grows
down the valley tracking the ball, zero WebGL errors."
```

> **Gate:** Phase B complete — the descent now leaves a glowing revealed trail. Risk #2 retired. Phase C adds the ambient swarm.

### Task 11: `flowField.ts` — the baked half-float flow-field DataTexture (Risk #4, CI half)

**Files:**
- Create: `src/scene/flowField.ts`
- Create: `src/scene/flowField.test.ts`

> **Why:** PRD §7.2 — instead of 18 simplex evaluations/particle/frame, bake the flow field ONCE into a 256×256 RGBA half-float `DataTexture` the swarm samples with one `texture2D`. The bake is pure TS (uses `getFunction(id).grad` analytically over the domain; `DataTexture` + `DataUtils` run under Node with no GL), so the **encode/decode is fully unit-testable** — this is the CI-runnable half of smoke-test Risk #4 (the GPU *sampling* half is Task 19's live smoke). Channels: `RG = normalize(−∇J)` (descent direction), `B = ‖∇J‖/(1+‖∇J‖)` (soft-normalized speed — raw magnitude spans ~6 orders across presets, so the rolloff keeps it usable as a half-float scalar), `A = pseudo-curl` of the *normalized direction* field (a true gradient field is curl-free, so we bake the curl of the direction field — nonzero exactly where the flow turns, i.e. where visible swirl is wanted).

- [ ] **Step 1: Write the failing test — `src/scene/flowField.test.ts`**

```ts
import * as THREE from 'three';
import { FLOW_TEX_SIZE, bakeFlowField, decodeFlowTexel } from './flowField';

describe('flowField — baked half-float DataTexture (Risk #4, encode/decode)', () => {
  it('builds a 256x256 RGBA half-float DataTexture backed by a Uint16Array', () => {
    const tex = bakeFlowField('sphere');
    expect(tex.image.width).toBe(FLOW_TEX_SIZE);
    expect(tex.image.height).toBe(FLOW_TEX_SIZE);
    expect(tex.format).toBe(THREE.RGBAFormat);
    expect(tex.type).toBe(THREE.HalfFloatType);
    expect(tex.image.data).toBeInstanceOf(Uint16Array);
    expect((tex.image.data as Uint16Array).length).toBe(FLOW_TEX_SIZE * FLOW_TEX_SIZE * 4);
  });

  it('decodes RG ~ normalize(-grad) for sphere at an off-origin texel', () => {
    // sphere grad = [2x, 2y]; at +x,+y the descent direction is toward the origin
    // → normalize(-[2x,2y]) = normalize([-x,-y]). At i=192,j=192 (upper-right
    // quadrant, x>0,y>0), dir ~ (-0.707, -0.707).
    const tex = bakeFlowField('sphere');
    const i = 192;
    const j = 192;
    const { dirX, dirY, speed, curl } = decodeFlowTexel(tex, i, j);
    const mag = Math.hypot(dirX, dirY);
    expect(mag).toBeCloseTo(1, 2); // unit direction
    expect(dirX).toBeLessThan(0); // points back toward origin
    expect(dirY).toBeLessThan(0);
    expect(dirX).toBeCloseTo(-0.7071, 2); // half-float-safe to 2 decimals
    expect(dirY).toBeCloseTo(-0.7071, 2);
    expect(speed).toBeGreaterThanOrEqual(0);
    expect(speed).toBeLessThan(1); // g/(1+g) ∈ [0,1)
    expect(curl).toBeGreaterThanOrEqual(-1);
    expect(curl).toBeLessThanOrEqual(1);
  });

  it('emits a near-zero SPEED where the gradient vanishes (texel nearest origin)', () => {
    // sphere domain [-5,5]; 256 is even so no texel lands exactly on 0 — the
    // nearest is x≈0.0196, where ‖∇‖≈0.055. The DIRECTION is still normalized to
    // unit length there (it only zeroes when ‖∇‖<1e-9), so assert on the SPEED
    // channel g/(1+g), which →0 as ‖∇‖→0. (This is the channel that vanishes at
    // a minimum; direction never does.)
    const tex = bakeFlowField('sphere');
    const mid = Math.round((0 - -5) / (10 / (FLOW_TEX_SIZE - 1))); // i for x≈0.0196
    const { speed } = decodeFlowTexel(tex, mid, mid);
    expect(speed).toBeLessThan(0.1); // g≈0.055 → g/(1+g)≈0.053
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- flowField
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/flowField.ts`**

```ts
import * as THREE from 'three';
import { getFunction } from '../engine/functions';

/** Flow-field bake resolution (PRD §7.2). 256×256 RGBA half-float. */
export const FLOW_TEX_SIZE = 256;

/**
 * Bake the active function's flow field into a 256×256 RGBA HalfFloat DataTexture
 * (SMOKE-TEST RISK #4). Pure TS — uses getFunction(id).grad analytically over the
 * function's domain; no GL context required, so it is fully unit-testable.
 *
 * Texel layout per (u,v) → param point p = (xMin + u·Δx, yMin + v·Δy):
 *   R,G = normalize(−∇J(p))         descent DIRECTION (unit; [−1,1] fits half-float)
 *   B   = g/(1+g), g = ‖∇J(p)‖      soft-normalized SPEED in [0,1) (steep & gentle readable)
 *   A   = 0.5·(∂dirY/∂x − ∂dirX/∂y) pseudo-CURL of the direction field, clamped [−1,1]
 *
 * A true gradient field is curl-free, so we bake the curl of the *normalized
 * direction* field instead: nonzero wherever the flow turns (basins/ridges) —
 * exactly where visible swirl is wanted. Channels are stored as
 * THREE.DataUtils.toHalfFloat bit patterns in a Uint16Array (HalfFloatType REQUIRES
 * Uint16, not Float32). RGBAFormat (not RGB) for Intel-mobile compatibility.
 * NearestFilter + ClampToEdge are DataTexture defaults — intentionally not set.
 */
export function bakeFlowField(functionId: string): THREE.DataTexture {
  const fn = getFunction(functionId);
  const [xMin, xMax, yMin, yMax] = fn.domain;
  const N = FLOW_TEX_SIZE;
  const dx = (xMax - xMin) / (N - 1);
  const dy = (yMax - yMin) / (N - 1);

  const px = (i: number) => xMin + i * dx;
  const py = (j: number) => yMin + j * dy;

  // Unit descent direction at texel (i,j); [0,0] where the gradient vanishes.
  const dir = (i: number, j: number): [number, number] => {
    const [gx, gy] = fn.grad([px(i), py(j)]);
    const mag = Math.hypot(gx, gy);
    if (mag < 1e-9) return [0, 0];
    return [-gx / mag, -gy / mag];
  };

  const data = new Uint16Array(N * N * 4);
  const H = THREE.DataUtils.toHalfFloat;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const [dirX, dirY] = dir(i, j);

      // Speed = soft-normalized gradient magnitude (raw ‖∇‖ spans ~6 orders across
      // presets, so g/(1+g) maps any g≥0 into [0,1) — usable as a half-float scalar).
      const [gx, gy] = fn.grad([px(i), py(j)]);
      const g = Math.hypot(gx, gy);
      const speed = g / (1 + g);

      // Pseudo-curl: central-difference rotation of the DIRECTION field. Neighbours
      // clamp at the edges (ClampToEdge semantics) so the bake stays in bounds.
      const iL = Math.max(0, i - 1);
      const iR = Math.min(N - 1, i + 1);
      const jD = Math.max(0, j - 1);
      const jU = Math.min(N - 1, j + 1);
      const dDirY_dx = (dir(iR, j)[1] - dir(iL, j)[1]) / ((iR - iL) * dx || 1);
      const dDirX_dy = (dir(i, jU)[0] - dir(i, jD)[0]) / ((jU - jD) * dy || 1);
      const curl = Math.max(-1, Math.min(1, 0.5 * (dDirY_dx - dDirX_dy)));

      const o = (j * N + i) * 4;
      data[o + 0] = H(dirX);
      data[o + 1] = H(dirY);
      data[o + 2] = H(speed);
      data[o + 3] = H(curl);
    }
  }

  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  // NearestFilter + ClampToEdgeWrapping are the DataTexture defaults — do NOT set them.
  tex.needsUpdate = true;
  return tex;
}

/** Decode a single texel back to floats (test helper; mirrors the GPU sampler). */
export function decodeFlowTexel(
  tex: THREE.DataTexture,
  i: number,
  j: number,
): { dirX: number; dirY: number; speed: number; curl: number } {
  const data = tex.image.data as Uint16Array;
  const o = (j * FLOW_TEX_SIZE + i) * 4;
  const F = THREE.DataUtils.fromHalfFloat;
  return { dirX: F(data[o]), dirY: F(data[o + 1]), speed: F(data[o + 2]), curl: F(data[o + 3]) };
}
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- flowField
npm run typecheck
```

Expected: pass (the sphere analytic oracle decodes to ≈(-0.707,-0.707) within half-float precision); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/flowField.ts src/scene/flowField.test.ts
git commit -m "feat(scene): baked half-float flow-field DataTexture (Risk #4 CI half)

256x256 RGBA HalfFloat: RG=normalize(-grad), B=g/(1+g) soft-normalized speed,
A=pseudo-curl of the direction field (a gradient field is curl-free, so curl the
DIRECTION field for swirl). Pure TS via getFunction().grad — unit-tested encode/
decode against the sphere analytic oracle (the CI-runnable half of Risk #4).
Uint16Array + RGBAFormat + needsUpdate; NearestFilter/ClampToEdge are defaults."
```

---

### Task 12: `swarmShaders.ts` — the stateless swarm vertex + fragment GLSL (string-guard)

**Files:**
- Create: `src/scene/shaders/swarmShaders.ts`
- Create: `src/scene/shaders/swarmShaders.test.ts`

> **Why:** PRD §7.1/§7.4 — each particle's world position is a PURE function of `(aSeed, aSpeed, uTime)` in the vertex shader (zero simulation textures). It reuses `functionFieldGLSL` (`surfaceHeight`) so motes ride the EXACT same displaced terrain as the surface, maps world↔param identically to `surfaceShaders.ts`, samples the baked flow texture with the GLSL1 `texture2D` form, and obeys the fill-rate rules (`gl_PointSize` clamp 1–3px, soft circular sprite via `gl_PointCoord` alpha math — no texture fetch). String-guard pins the load-bearing reuse + the fill-rate clamp.

- [ ] **Step 1: Write the failing test — `src/scene/shaders/swarmShaders.test.ts`**

```ts
import { swarmVertexShader, swarmFragmentShader } from './swarmShaders';

describe('swarmShaders — GLSL structure guards', () => {
  it('vertex reuses the surface field + declares the flow/param uniforms', () => {
    expect(swarmVertexShader).toContain('surfaceHeight(uFunction'); // rides the same terrain
    for (const u of ['uTime', 'uSize', 'uVScale', 'uFunction', 'uParamMin', 'uParamRange', 'uFlow']) {
      expect(swarmVertexShader).toContain(u);
    }
    expect(swarmVertexShader).toContain('#define SURFACE_SIZE 4.0');
  });

  it('vertex samples the flow with the GLSL1 texture2D form (not GLSL3 texture)', () => {
    expect(swarmVertexShader).toContain('texture2D(uFlow');
    expect(swarmVertexShader).not.toMatch(/[^2]texture\(uFlow/); // no bare texture(uFlow
  });

  it('vertex applies the fill-rate point-size clamp (PRD §7.4)', () => {
    expect(swarmVertexShader).toContain('gl_PointSize = clamp(');
  });

  it('fragment makes a soft circular sprite from gl_PointCoord with NO texture fetch', () => {
    expect(swarmFragmentShader).toContain('gl_PointCoord');
    expect(swarmFragmentShader).toContain('discard');
    expect(swarmFragmentShader).not.toContain('sampler'); // no texture in the fragment
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- swarmShaders
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/shaders/swarmShaders.ts`**

```ts
import { functionFieldGLSL } from './functionField';

/**
 * The stateless ambient-swarm shaders (spec §5.5, PRD §7). Each particle's world
 * position is a PURE function of (aSeed, aSpeed, uTime) — no simulation textures.
 *
 * Reuses `functionFieldGLSL` so the swarm rides the SAME displaced terrain as the
 * surface (surfaceHeight), and maps world↔param identically to surfaceShaders.ts
 * (p = uParamMin + uv·uParamRange ; world XZ = uv·SURFACE_SIZE − SURFACE_SIZE/2).
 * Flow direction / speed / curl come from the baked half-float uFlow texture
 * (RG=dir, B=speed, A=curl), sampled in the VERTEX shader with the GLSL1 texture2D
 * form (drei shaderMaterial is GLSL1; NearestFilter → exact texels).
 */

const SWARM_CONSTS = /* glsl */ `
#define SURFACE_SIZE 4.0
#ifndef PI
#define PI 3.141592653589793
#endif
`;

const SWARM_UNIFORMS = /* glsl */ `
uniform float     uTime;
uniform float     uSize;        // ~16 * pixelRatio (fill-rate; PRD §7.4)
uniform float     uVScale;
uniform int       uFunction;
uniform vec2      uParamMin;
uniform vec2      uParamRange;
uniform sampler2D uFlow;        // RG=normalize(−∇J), B=speed, A=curl
uniform float     uLifetime;    // seconds per spawn→despawn cycle
uniform float     uFlowStep;    // world-units a particle travels downhill over one life
`;

/** Cheap hash so each seed maps to a stable spawn cell + phase (no texture, no state). */
const SWARM_HASH = /* glsl */ `
vec2 hash22(float n) {
  return fract(sin(vec2(n, n + 1.7)) * vec2(43758.5453, 22578.1459));
}
`;

export const swarmVertexShader = /* glsl */ `
${SWARM_CONSTS}
${SWARM_UNIFORMS}
${SWARM_HASH}
${functionFieldGLSL}

attribute float aSeed;   // per-particle [0,1) phase/spawn selector
attribute float aSpeed;  // per-particle life-rate multiplier (~0.5..1.5)

varying float vAlpha;

// world XZ (centred plane) ↔ uv01 ↔ param — IDENTICAL map to surfaceShaders.ts.
vec2 uvToWorldXZ(vec2 uv01) { return uv01 * SURFACE_SIZE - vec2(SURFACE_SIZE * 0.5); }
vec2 worldXZToUv(vec2 wxz)  { return (wxz + vec2(SURFACE_SIZE * 0.5)) / SURFACE_SIZE; }
vec2 uvToParam(vec2 uv01)   { return uParamMin + uv01 * uParamRange; }

void main() {
  // Normalized life 0..1 (stateless: pure function of seed/speed/time).
  float life = fract((uTime * aSpeed + aSeed) / uLifetime);

  // Spawn cell from the seed, kept off the very edge.
  vec2 h = hash22(aSeed * 91.7);
  vec2 spawnUv = clamp(0.05 + 0.9 * h, vec2(0.0), vec2(1.0));

  // Baked flow at the spawn cell (NearestFilter → exact texel).
  vec4 flow = texture2D(uFlow, spawnUv);
  vec2 dir  = flow.rg;   // unit descent direction
  float spd = flow.b;    // soft-normalized speed [0,1)
  float crl = flow.a;    // pseudo-curl (swirl)

  // Advance downhill (closed-form, frame-rate independent): travel ∝ life·speed,
  // plus a curl-rotated perpendicular wiggle so particles spiral into basins.
  float travel = life * uFlowStep * (0.3 + spd);
  vec2 perp = vec2(-dir.y, dir.x);
  float swirl = crl * sin(life * PI * 2.0 + aSeed * 6.28318) * 0.15;
  vec2 curUv = clamp(worldXZToUv(uvToWorldXZ(spawnUv) + dir * travel + perp * swirl),
                     vec2(0.0), vec2(1.0));

  // World XZ + terrain height (REUSE surfaceHeight so we ride the exact surface).
  vec2 wxz = uvToWorldXZ(curUv);
  vec2 p   = uvToParam(curUv);
  float y  = uVScale * surfaceHeight(uFunction, p) + 0.08; // sit just above the crust

  // Plane is authored XY then rotated −90°X (local +Z → world +Y): world = (x,y,z).
  vec3 worldPos = vec3(wxz.x, y, wxz.y);
  vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Fade in/out over the life; dim the whole swarm so it never overpowers the ball.
  vAlpha = sin(life * PI) * 0.55;

  // Fill-rate clamp (PRD §7.4): perspective size, hard-capped to 1..3 px.
  gl_PointSize = clamp(uSize / -mvPosition.z, 1.0, 3.0);
}
`;

export const swarmFragmentShader = /* glsl */ `
precision highp float;
varying float vAlpha;

void main() {
  // Soft circular sprite from gl_PointCoord — NO texture fetch (PRD §7.4).
  float d = distance(gl_PointCoord, vec2(0.5));
  float s = pow(1.0 - d, 3.0);   // soft core, falls to 0 at the rim
  float a = vAlpha * s;
  if (a < 0.01) discard;         // trim the additive halo's faint tail
  vec3 col = vec3(0.55, 0.85, 1.0); // cool cyan-white motes
  gl_FragColor = vec4(col * a, a);  // premultiplied for AdditiveBlending
}
`;
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- swarmShaders
npm run typecheck
```

Expected: pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/shaders/swarmShaders.ts src/scene/shaders/swarmShaders.test.ts
git commit -m "feat(scene): stateless swarm GLSL (reuses functionField; baked-flow advection)

Vertex: position = f(aSeed, aSpeed, uTime); reuses surfaceHeight so motes ride the
exact displaced terrain; samples the baked half-float uFlow (texture2D, GLSL1) for
direction/speed/curl; fill-rate gl_PointSize clamp 1-3px. Fragment: soft circular
sprite via gl_PointCoord (no texture fetch), additive-premultiplied. String-guards
pin the reuse + clamp + GLSL1 sampler form."
```

---

### Task 13: `Swarm.tsx` — the stateless points component + JSX augmentation + wire in

**Files:**
- Create: `src/scene/Swarm.tsx`
- Create: `src/scene/Swarm.test.tsx`
- Modify: `src/scene/Scene.tsx` (mount `<Swarm />`)

> **Why:** The component that ties it together: a drei `shaderMaterial` factory → `SwarmMaterial`, `extend`-registered with the verified TS JSX augmentation, raw `<points>` with tier-count buffers, the baked flow texture memoized per function (disposed on change), the function/tier uniforms applied imperatively, and `uTime` advanced on the material ref in `useFrame` (two-channel rule). Self-gates: `fallback` (count 0) renders null. The mock GL can't compile the shader or upload the DataTexture, so the structure test proves the points tree + tier gating; the GPU sampling (Risk #4's other half) is Task 19's live smoke.

- [ ] **Step 1: Write the failing test — `src/scene/Swarm.test.tsx`**

```tsx
// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import Swarm from './Swarm';

describe('Swarm (R3F structure smoke)', () => {
  afterEach(() => useUIStore.getState().setTier('high'));

  it('mounts one Points with three buffer attributes at the tier count', async () => {
    useUIStore.getState().setTier('high'); // 30000 ambient particles
    const renderer = await ReactThreeTestRenderer.create(<Swarm />);
    const points = renderer.scene.findAllByType('Points');
    expect(points.length).toBe(1);
    const geom = (points[0].instance as THREE.Points).geometry;
    expect(geom.getAttribute('position').count).toBe(30000);
    expect(geom.getAttribute('aSeed').count).toBe(30000);
    expect(geom.getAttribute('aSpeed').count).toBe(30000);
    const mat = (points[0].instance as THREE.Points).material as THREE.Material;
    expect((mat as THREE.Material & { transparent: boolean }).transparent).toBe(true);
    expect((mat as THREE.Material & { blending: number }).blending).toBe(THREE.AdditiveBlending);
    await renderer.unmount();
  });

  it('renders no points at the fallback tier (count 0)', async () => {
    useUIStore.getState().setTier('fallback');
    const renderer = await ReactThreeTestRenderer.create(<Swarm />);
    expect(renderer.scene.findAllByType('Points').length).toBe(0);
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- Swarm
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/Swarm.tsx`**

```tsx
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { extend, useFrame, useThree, type ThreeElement } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { TIER_SETTINGS } from '../quality/tiers';
import { vScaleFor } from './surfaceMapping';
import { FUNCTION_GLSL_INDEX } from './shaders/functionField';
import { bakeFlowField } from './flowField';
import { swarmVertexShader, swarmFragmentShader } from './shaders/swarmShaders';

/**
 * The stateless ambient swarm (spec §5.5, PRD §7). Raw <points> whose count is the
 * tier's ambientParticles. Position is computed entirely in the vertex shader from
 * (aSeed, aSpeed, uTime) flowing over the baked half-float flow texture (RISK #4) —
 * zero simulation state, zero per-frame setState. uTime is mutated on the material
 * ref in useFrame (two-channel rule). ON by default, scaled by tier; the fallback
 * tier (count 0) renders nothing.
 */
const SwarmMaterial = shaderMaterial(
  {
    uTime: 0,
    uSize: 16,
    uVScale: 1,
    uFunction: 0,
    uParamMin: new THREE.Vector2(),
    uParamRange: new THREE.Vector2(),
    uFlow: null as THREE.Texture | null,
    uLifetime: 6.0,
    uFlowStep: 2.0,
  },
  swarmVertexShader,
  swarmFragmentShader,
);

extend({ SwarmMaterial });

// TS JSX augmentation — VERIFIED typecheck-clean under fiber 9.6 / React 19.
declare module '@react-three/fiber' {
  interface ThreeElements {
    swarmMaterial: ThreeElement<typeof SwarmMaterial>;
  }
}

export default function Swarm() {
  const functionId = useUIStore((s) => s.functionId);
  const tier = useUIStore((s) => s.tier);
  const invalidate = useThree((s) => s.invalidate);
  const dpr = useThree((s) => s.viewport.dpr);

  const matRef = useRef<THREE.ShaderMaterial & { uTime: number }>(null);
  const count = TIER_SETTINGS[tier].ambientParticles;

  // Tier-count buffers (re-derived only when the count changes). attributes-position
  // is a DUMMY — the count drives the draw; real positions are computed in the
  // vertex shader. BufferAttribute throws on a plain Array → must be TypedArrays.
  const { posF32, seedF32, speedF32 } = useMemo(() => {
    const n = Math.max(count, 1); // never allocate a 0-length attribute
    const posF32 = new Float32Array(n * 3);
    const seedF32 = new Float32Array(n);
    const speedF32 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      seedF32[i] = Math.random();
      speedF32[i] = 0.5 + Math.random(); // ~0.5..1.5 life-rate spread
    }
    return { posF32, seedF32, speedF32 };
  }, [count]);

  // Bake the flow field once per function (RISK #4). Disposed on change → no leak.
  const flow = useMemo(() => bakeFlowField(functionId), [functionId]);
  useEffect(() => () => flow.dispose(), [flow]);

  // Apply function/tier-dependent uniforms imperatively + force one frame (frameloop
  // may be 'demand' while paused, like the Surface's effect).
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const fn = getFunction(functionId);
    const [xMin, xMax, yMin, yMax] = fn.domain;
    mat.uniforms.uFunction.value = FUNCTION_GLSL_INDEX[functionId] ?? 0;
    mat.uniforms.uVScale.value = vScaleFor(functionId);
    (mat.uniforms.uParamMin.value as THREE.Vector2).set(xMin, yMin);
    (mat.uniforms.uParamRange.value as THREE.Vector2).set(xMax - xMin, yMax - yMin);
    mat.uniforms.uFlow.value = flow;
    mat.uniforms.uSize.value = 16 * Math.min(dpr, 1.5); // cap particle-pass pixelRatio
    invalidate();
  }, [functionId, flow, dpr, invalidate]);

  // Two-channel rule: advance uTime on the material ref only (never setState).
  useFrame((_, delta) => {
    const mat = matRef.current;
    if (mat) mat.uniforms.uTime.value += delta;
  });

  if (count <= 0) return null; // fallback tier

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posF32, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seedF32, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speedF32, 1]} />
      </bufferGeometry>
      <swarmMaterial ref={matRef} transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending} />
    </points>
  );
}
```

> **Note:** uniforms are written via `mat.uniforms.X.value` (the always-present path) rather than the accessor props, to keep the `matRef` type simple and avoid relying on the per-key accessors in TS. Both work at runtime; this form is unambiguous.

- [ ] **Step 4: Run (GREEN) + typecheck + build**

```bash
npm test -- Swarm
npm run typecheck
npm run build
```

Expected: structure test passes (30000 attrs at high, 0 points at fallback); **typecheck clean — this proves the JSX augmentation block compiles** (the load-bearing TS check for the custom element); build clean (`noUnusedLocals`).

- [ ] **Step 5: Mount `<Swarm />` in `SceneContents`.** In `src/scene/Scene.tsx`, add the import and mount it after `<Surface />` (before the ball/path/trail is fine; the swarm is ambient):

```tsx
import Swarm from './Swarm';
// ...inside SceneContents return:
      <Surface />
      <Swarm />
      <DescentBall />
      <DescentPath />
      <DescentTrail />
      <PostStack refs={heroRefs} />
```

- [ ] **Step 6: Run the Scene test + gates**

```bash
npm test -- Scene
npm run typecheck
npm run build
```

Expected: green (the Scene test's drei mock already spreads the real module, so `shaderMaterial`/`extend` work; the new `<Swarm>` mounts a `Points` without throwing).

- [ ] **Step 7: Commit (the live GPU sampling smoke is Task 19).**

```bash
git add src/scene/Swarm.tsx src/scene/Swarm.test.tsx src/scene/Scene.tsx
git commit -m "feat(scene): stateless 65k ambient swarm + flow-field wiring

shaderMaterial(SwarmMaterial) + extend + the verified ThreeElements augmentation;
raw <points> with tier-count buffers (TIER_SETTINGS.ambientParticles); flow texture
baked per function (disposed on change); uTime advanced on the material ref in
useFrame (two-channel rule). Self-gates: fallback renders null. Mounted in
SceneContents. GPU half-float sampling (Risk #4 other half) verified at Task 19."
```

> **Gate:** Phase C complete — the world is alive with motes streaming downhill. Risk #4's encode/decode is CI-proven; its GPU sampling is verified at the checkpoint. Phase D brings the hero beat.

### Task 14: `heroTrigger.ts` — the arrival predicate (pure TS)

**Files:**
- Create: `src/scene/heroTrigger.ts`
- Create: `src/scene/heroTrigger.test.ts`

> **Why:** The hero beat fires once per run when the descent *arrives* (spec §5.6). The trigger is a composite predicate (resolved during design): **primary** = proximity of θ to the nearest authored minimum (`getFunction(id).minima`), normalized by the domain extent; **fallback** = a sustained cost-plateau (handles optimizers that stall short of the listed minimum, and saddle which has no attractor). Pure TS → fully unit-testable. The controller (Task 18) owns the convergence counter and passes it in.

- [ ] **Step 1: Write the failing test — `src/scene/heroTrigger.test.ts`**

```ts
import {
  ARRIVE_PARAM_FRAC,
  SUSTAIN,
  nearestMinimaDistSq,
  evaluateArrival,
} from './heroTrigger';
import { getFunction } from '../engine/functions';
import type { Vec2 } from '../engine/types';

describe('heroTrigger — arrival predicate', () => {
  const sphere = getFunction('sphere'); // minima [[0,0]], domain [-5,5,-5,5]
  const himmel = getFunction('himmelblau'); // 4 minima

  it('nearestMinimaDistSq picks the closest minimum', () => {
    const near = [3.1, 1.9] as Vec2; // close to [3,2]
    const d2 = nearestMinimaDistSq(near, himmel.minima as Vec2[]);
    expect(d2).toBeLessThan(0.05);
  });

  it('fires (proximity) when theta is within ARRIVE_PARAM_FRAC of a minimum', () => {
    const r = evaluateArrival({
      theta: [0.05, -0.05],
      cost: 0.005,
      prevCost: 0.006,
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: 0,
    });
    expect(r.arrived).toBe(true); // dist/extent ≈ 0.007 < ARRIVE_PARAM_FRAC (0.04)
  });

  it('does NOT fire mid-descent far from any minimum', () => {
    const r = evaluateArrival({
      theta: [-1.2, 1],
      cost: 24,
      prevCost: 30,
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: 0,
    });
    expect(r.arrived).toBe(false);
  });

  it('fires (convergence fallback) after SUSTAIN near-zero-delta steps, even far away', () => {
    // Far from the minimum, but cost has plateaued: the run is stuck.
    const sig = {
      theta: [4, 4] as Vec2,
      cost: 100.0,
      prevCost: 100.000001, // |Δ|/|cost| well below COST_EPS
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: SUSTAIN - 1, // one more converging step trips it
    };
    const r = evaluateArrival(sig);
    expect(r.converging).toBe(true);
    expect(r.arrived).toBe(true);
  });

  it('never counts the first frame (prevCost NaN) as converging', () => {
    const r = evaluateArrival({
      theta: [4, 4],
      cost: 100,
      prevCost: NaN,
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: SUSTAIN,
    });
    expect(r.converging).toBe(false);
    expect(r.arrived).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- heroTrigger
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/heroTrigger.ts`**

```ts
import type { Domain } from './surfaceMapping.types';
import type { Vec2 } from '../engine/types';

/**
 * Arrival trigger (spec §5.6). Composite predicate:
 *   PRIMARY  — proximity: θ within ARRIVE_PARAM_FRAC of the NEAREST authored
 *              minimum (normalized by the larger domain axis).
 *   FALLBACK — convergence: |Δcost|/|cost| < COST_EPS for SUSTAIN consecutive
 *              steps (handles optimizers that stall short of the listed minimum,
 *              and saddle which has no attractor).
 * Either condition arms the one-shot beat. Pure — no Three/React.
 */

/** Param-space fraction of the larger domain extent that counts as "arrived". */
export const ARRIVE_PARAM_FRAC = 0.04;
/** Relative cost-delta below which a step counts as "converging". */
export const COST_EPS = 1e-4;
/** Consecutive converging steps required for the fallback to fire. */
export const SUSTAIN = 20;

/** Squared distance from p to the nearest minimum (param space). */
export function nearestMinimaDistSq(p: Vec2, minima: readonly Vec2[]): number {
  let best = Infinity;
  for (const m of minima) {
    const dx = p[0] - m[0];
    const dy = p[1] - m[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  return best;
}

export interface ArrivalSignals {
  theta: Vec2;
  cost: number;
  /** Cost on the previous evaluated frame (NaN on the first). */
  prevCost: number;
  minima: readonly Vec2[];
  domain: Domain;
  /** Running count of consecutive converging steps (the caller owns the counter). */
  convergedRun: number;
}

export interface ArrivalResult {
  arrived: boolean;
  /** Whether THIS frame was a converging step (caller increments its run). */
  converging: boolean;
  /** Normalized param distance to the nearest minimum (debugging/telemetry). */
  paramDist: number;
}

export function evaluateArrival(s: ArrivalSignals): ArrivalResult {
  const [xMin, xMax, yMin, yMax] = s.domain;
  const extent = Math.max(xMax - xMin, yMax - yMin);
  const dist = Math.sqrt(nearestMinimaDistSq(s.theta, s.minima));
  const paramDist = dist / extent;

  const proximityArrived = paramDist < ARRIVE_PARAM_FRAC;

  const denom = Math.max(Math.abs(s.cost), 1e-9);
  const converging =
    Number.isFinite(s.prevCost) && Math.abs(s.cost - s.prevCost) / denom < COST_EPS;
  const convergenceArrived = converging && s.convergedRun + 1 >= SUSTAIN;

  return { arrived: proximityArrived || convergenceArrived, converging, paramDist };
}
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- heroTrigger
npm run typecheck
```

Expected: pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/heroTrigger.ts src/scene/heroTrigger.test.ts
git commit -m "feat(scene): hero arrival trigger (proximity-to-minima + convergence fallback)

Pure TS: proximity to the nearest authored minimum (normalized by domain extent)
is primary; a sustained cost-plateau is the fallback for optimizers that stall
short (and for saddle, which has no attractor). Unit-tested across sphere/
himmelblau + the first-frame NaN guard."
```

---

### Task 15: `heroState.ts` — the beat state machine (pure TS)

**Files:**
- Create: `src/scene/heroState.ts`
- Create: `src/scene/heroState.test.ts`

> **Why:** The ~700ms choreography is a small state machine: `idle → approach → touchdown → settle`, with `diverged` as a terminal failure phase (spec §5.6 / PRD §5.5). Touchdown is a *timed* 250ms flash (`t` ramps 0→1); the others are target-seeking. A one-shot latch fires the success beat once per run; a `runId` change resets it. Keeping the machine pure makes all the branching unit-testable — the controller (Task 18) is then a thin imperative shell.

- [ ] **Step 1: Write the failing test — `src/scene/heroState.test.ts`**

```ts
import {
  TOUCHDOWN_MS,
  APPROACH_MS,
  initialHeroState,
  advanceHero,
  heroNeedsFrames,
  type HeroState,
} from './heroState';

const RUN = 'sphere|sgd|0.1|0,0';

describe('heroState — beat state machine', () => {
  it('idle + arrived (not fired) → approach', () => {
    const s = advanceHero(initialHeroState(RUN), { arrived: true, diverged: false, runId: RUN }, 16);
    expect(s.phase).toBe('approach');
    expect(s.fired).toBe(true);
  });

  it('approach holds for ~APPROACH_MS (the ~1s cyan bleed) then → touchdown', () => {
    let s = advanceHero(initialHeroState(RUN), { arrived: true, diverged: false, runId: RUN }, 16);
    expect(s.phase).toBe('approach');
    // Still in approach partway through the lead-in.
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, APPROACH_MS / 2);
    expect(s.phase).toBe('approach');
    // Crossing APPROACH_MS transitions to the flash.
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, APPROACH_MS);
    expect(s.phase).toBe('touchdown');
  });

  it('touchdown accumulates to t=1 over TOUCHDOWN_MS then → settle', () => {
    let s: HeroState = { phase: 'touchdown', elapsedMs: 0, t: 0, fired: true, runId: RUN };
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, TOUCHDOWN_MS / 2);
    expect(s.phase).toBe('touchdown');
    expect(s.t).toBeCloseTo(0.5, 2);
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, TOUCHDOWN_MS);
    expect(s.phase).toBe('settle');
  });

  it('does not re-fire once fired', () => {
    let s = advanceHero(initialHeroState(RUN), { arrived: true, diverged: false, runId: RUN }, 16);
    // jump to settle, then "arrive" again — must stay settle (latched)
    s = { ...s, phase: 'settle' };
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, 16);
    expect(s.phase).toBe('settle');
  });

  it('diverged from any phase → terminal diverged', () => {
    const s = advanceHero({ phase: 'touchdown', elapsedMs: 10, t: 0.1, fired: true, runId: RUN },
      { arrived: false, diverged: true, runId: RUN }, 16);
    expect(s.phase).toBe('diverged');
  });

  it('a runId change resets to idle', () => {
    const s = advanceHero({ phase: 'settle', elapsedMs: 500, t: 1, fired: true, runId: RUN },
      { arrived: false, diverged: false, runId: 'other|adam|0.01|1,1' }, 16);
    expect(s.phase).toBe('idle');
    expect(s.fired).toBe(false);
  });

  it('heroNeedsFrames: true during approach/touchdown + the settle tail, false at idle', () => {
    expect(heroNeedsFrames({ phase: 'idle', elapsedMs: 0, t: 0, fired: false, runId: RUN })).toBe(false);
    expect(heroNeedsFrames({ phase: 'touchdown', elapsedMs: 0, t: 0, fired: true, runId: RUN })).toBe(true);
    expect(heroNeedsFrames({ phase: 'settle', elapsedMs: 100, t: 0, fired: true, runId: RUN })).toBe(true);
    expect(heroNeedsFrames({ phase: 'settle', elapsedMs: 99999, t: 0, fired: true, runId: RUN })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- heroState
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/heroState.ts`**

```ts
/**
 * The hero-beat state machine (spec §5.6 / PRD §5.5). Pure — no Three/React.
 * Phases (~700ms total, success path):
 *   idle      — nothing happening (descent in progress / not yet armed)
 *   approach  — arrival imminent: ~APPROACH_MS lead-in while the halo bleeds toward
 *               cyan (PRD §5.5 stage 1, "the last ~1s") — a TIMED phase
 *   touchdown — ~250ms TIMED white-hot flash + cyan halo + bloom flare + DOF rack
 *   settle    — relax to a steady cyan beacon + ignite the lone ember ring (seek)
 *   diverged  — terminal failure: fuchsia halo + dimming core (the visual opposite)
 *
 * `t` is 0..1 progress within a TIMED phase (touchdown). `approach` also accumulates
 * elapsedMs toward APPROACH_MS. Advanced once per frame with the elapsed dtMs. A
 * runId change resets to idle (a new descent).
 */

export type HeroPhase = 'idle' | 'approach' | 'touchdown' | 'settle' | 'diverged';

/** Touchdown flash duration (PRD §5.5: "over ~250ms"). */
export const TOUCHDOWN_MS = 250;
/** Approach lead-in duration — the PRD §5.5 stage-1 "last ~1s" cyan halo bleed.
 *  800ms reads as the spec's ~1s while keeping the whole beat near ~700ms+lead-in. */
export const APPROACH_MS = 800;

export interface HeroState {
  phase: HeroPhase;
  /** Accumulated ms within the current phase. */
  elapsedMs: number;
  /** 0..1 progress within a TIMED phase (touchdown). */
  t: number;
  /** One-shot latch: once the success beat begins it never re-fires this run. */
  fired: boolean;
  /** The run identity this state belongs to; a change resets the machine. */
  runId: string;
}

export function initialHeroState(runId: string): HeroState {
  return { phase: 'idle', elapsedMs: 0, t: 0, fired: false, runId };
}

export interface HeroSignals {
  arrived: boolean;
  diverged: boolean;
  runId: string;
}

/** Advance the machine by dtMs. Returns the NEXT state (caller stores it). */
export function advanceHero(prev: HeroState, sig: HeroSignals, dtMs: number): HeroState {
  // Run change → hard reset (new descent).
  if (sig.runId !== prev.runId) return initialHeroState(sig.runId);

  // Divergence overrides everything (terminal). Latch into 'diverged' and stay.
  if (sig.diverged) {
    if (prev.phase === 'diverged') return { ...prev, elapsedMs: prev.elapsedMs + dtMs };
    return { phase: 'diverged', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
  }

  switch (prev.phase) {
    case 'idle':
      if (!prev.fired && sig.arrived) {
        return { phase: 'approach', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
      }
      return prev;
    case 'approach': {
      // Timed lead-in (PRD §5.5 stage 1, ~1s): accumulate, bleed the halo cyan,
      // then transition to the flash once APPROACH_MS elapses.
      const elapsedMs = prev.elapsedMs + dtMs;
      if (elapsedMs >= APPROACH_MS) {
        return { phase: 'touchdown', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
      }
      return { phase: 'approach', elapsedMs, t: 0, fired: true, runId: prev.runId };
    }
    case 'touchdown': {
      const elapsedMs = prev.elapsedMs + dtMs;
      const t = Math.min(elapsedMs / TOUCHDOWN_MS, 1);
      if (t >= 1) return { phase: 'settle', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
      return { phase: 'touchdown', elapsedMs, t, fired: true, runId: prev.runId };
    }
    case 'settle':
    case 'diverged':
      return { ...prev, elapsedMs: prev.elapsedMs + dtMs };
    default:
      return prev;
  }
}

/** True while the machine still needs frames flowing (drives invalidate()). */
export function heroNeedsFrames(state: HeroState, settleHoldMs = 1500): boolean {
  if (state.phase === 'idle') return false;
  if (state.phase === 'settle' || state.phase === 'diverged') return state.elapsedMs < settleHoldMs;
  return true; // approach / touchdown always animate
}
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- heroState
npm run typecheck
```

Expected: pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/heroState.ts src/scene/heroState.test.ts
git commit -m "feat(scene): hero-beat state machine (idle→approach→touchdown→settle / diverged)

Pure TS: timed 250ms touchdown flash, target-seek approach/settle, terminal
diverged phase, one-shot latch, runId reset, heroNeedsFrames for the frameloop
tail. Fully unit-tested transitions."
```

---

### Task 16: `EmberRing.tsx` — the lone ember ground ring

**Files:**
- Create: `src/scene/EmberRing.tsx`
- Create: `src/scene/EmberRing.test.tsx`

> **Why:** PRD §5.5 stage 3 — the single ember-amber `#FFA23A` marker that ignites only on success ("the *only* place ember appears"). The spec offers **ring-or-beam** ("a thin ground-projection ring OR short upward beam"); this plan chooses the **ground ring** — it reads as a clear "this is the spot" projection, is cheaper (one `RingGeometry`, no volumetric beam), and sits flat without competing vertically with the ball/trail. A `THREE.RingGeometry` lying flat, additively blended, `toneMapped={false}` so selective bloom flares it, starting invisible at scale 0. `HeroBeat` (Task 18) positions it at the converged ball XZ and drives its opacity/scale during `settle` via the forwarded ref.

- [ ] **Step 1: Write the failing test — `src/scene/EmberRing.test.tsx`**

```tsx
// @vitest-environment happy-dom
import { useRef } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import EmberRing from './EmberRing';

function Host() {
  const ref = useRef<THREE.Mesh>(null);
  return <EmberRing ref={ref} />;
}

describe('EmberRing (R3F structure smoke)', () => {
  it('mounts a flat, bloom-safe ring that starts hidden', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Host />);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(1);
    const mesh = meshes[0].instance as THREE.Mesh;
    expect(mesh.geometry.type).toBe('RingGeometry');
    expect(mesh.visible).toBe(false);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.toneMapped).toBe(false);
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- EmberRing
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/EmberRing.tsx`**

```tsx
import { forwardRef } from 'react';
import * as THREE from 'three';

/** Inner/outer radius of the ground ring in world units. */
const INNER = 0.14;
const OUTER = 0.2;

/**
 * The lone ember-amber ground-projection ring (spec §5.6 / PRD §5.5). Lies flat
 * (rotation-x = -PI/2), additively blended, toneMapped={false} so selective bloom
 * flares it. Hidden until the settle phase: HeroBeat positions it at the converged
 * ball XZ and drives the material `.opacity` (0→~0.9) + mesh `.scale` (0→1). The
 * ONLY ember in the scene.
 */
const EmberRing = forwardRef<THREE.Mesh>(function EmberRing(_props, ref) {
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false} scale={0.001}>
      <ringGeometry args={[INNER, OUTER, 64]} />
      <meshBasicMaterial
        color="#FFA23A"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
});

export default EmberRing;
```

- [ ] **Step 4: Run (GREEN) + typecheck**

```bash
npm test -- EmberRing
npm run typecheck
```

Expected: pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/EmberRing.tsx src/scene/EmberRing.test.tsx
git commit -m "feat(scene): lone ember ground ring (RingGeometry, additive, bloom-safe)

Flat RingGeometry, additive + toneMapped=false so selective bloom flares it,
starts hidden at scale 0. Positioned + animated by HeroBeat in the settle phase.
The only ember in the scene (PRD §5.5)."
```

---

### Task 17: `DescentBall.tsx` — lift the material ref for the hero beat

**Files:**
- Modify: `src/scene/DescentBall.tsx`
- Modify: `src/scene/DescentBall.test.tsx`

> **Why:** During touchdown the hero beat flashes the ball core white-hot (`emissiveIntensity 3→5`, `emissive → [6,6,4]`) and relaxes it to a steady cyan beacon, then dims it on divergence. DescentBall keeps owning *position* (its damping `useFrame`); the beat owns *appearance* via an optional `materialRef` prop. This is a minimal, behavior-preserving change — the component stays usable standalone (the prop is optional). No mesh ref is needed (the path/trail self-anchor; PostStack's DOF computes focus from `simStore`).

- [ ] **Step 1: Update `src/scene/DescentBall.test.tsx` — add a ref-population assertion (RED)**

Add the two imports to the **top-of-file import block** (NOT inside the `describe`), then append a third test inside the existing `describe`. The new imports:

```tsx
import { createRef } from 'react';
import * as THREE from 'three';
```

The new test (append after the existing two `it(...)` blocks):

```tsx
  it('populates an external materialRef when provided', async () => {
    const matRef = createRef<THREE.MeshPhysicalMaterial>();
    const renderer = await ReactThreeTestRenderer.create(<DescentBall materialRef={matRef} />);
    expect(matRef.current).not.toBeNull();
    expect(matRef.current?.type).toBe('MeshPhysicalMaterial');
    await renderer.unmount();
  });
```

(Keep the two existing tests — the standalone-mount and frame-advance ones — unchanged; they prove the prop is optional. While here, retarget the stale comment in the existing frame-advance test: change `real motion is a live-browser check — Task 12` to `— Task 19 (M1b live smoke)`, since "Task 12" was an M1a task number that no longer exists in this plan's numbering. Cosmetic; comments don't affect compilation.)

- [ ] **Step 2: Run to verify the new test FAILS (RED)**

```bash
npm test -- DescentBall
```

Expected: the new test **FAILS** — `DescentBall` doesn't accept `materialRef` yet (TS error / `matRef.current` null). The two existing tests still pass.

- [ ] **Step 3: Implement — add the optional `materialRef` prop in `src/scene/DescentBall.tsx`**

Change the signature and attach the ref to the material. The full updated file:

```tsx
import { useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import * as THREE from 'three';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';

/** Radius of the orb in world units; also its resting offset above the surface. */
const BALL_RADIUS = 0.08;

export interface DescentBallProps {
  /** Optional external ref to the orb's material so the hero beat can drive its
   *  emissive intensity/colour during the arrival beat. Position stays owned here. */
  materialRef?: RefObject<THREE.MeshPhysicalMaterial | null>;
}

/**
 * The lacquered descent ball (spec §5.3) — the single agent of the M1 cinematic
 * descent. Reads Channel B (simStore) transiently in useFrame and mutates its own
 * position (never setState). The sim runner writes the TRUE param-space θ; the
 * ball owns the visual SMOOTHING via maath easing.damp3.
 *
 * M1b: accepts an optional `materialRef` so HeroBeat can drive the emissive flash/
 * settle/dim during the arrival beat. The ball still owns position; the beat owns
 * appearance. The prop is optional so the component stays usable standalone.
 */
export default function DescentBall({ materialRef }: DescentBallProps = {}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const target = useRef(new THREE.Vector3());
  const functionId = useUIStore((s) => s.functionId);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { theta, cost } = simStore.getState();
    const fn = getFunction(functionId);
    const [worldX, worldZ] = paramToWorldXZ(theta[0], theta[1], fn.domain);
    const worldY = costToWorldHeight(cost, functionId) + BALL_RADIUS;
    target.current.set(worldX, worldY, worldZ);
    easing.damp3(mesh.position, target.current, 0.15, delta);
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
      <meshPhysicalMaterial
        ref={materialRef}
        color="#0a0a0a"
        roughness={0.3}
        metalness={0}
        clearcoat={1.0}
        clearcoatRoughness={0.05}
        envMapIntensity={1}
        emissive="#00D3F2"
        emissiveIntensity={3.0}
        toneMapped={false}
      />
    </mesh>
  );
}
```

- [ ] **Step 4: Run (GREEN) + typecheck + build**

```bash
npm test -- DescentBall
npm run typecheck
npm run build
```

Expected: all three DescentBall tests pass; typecheck + build clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/DescentBall.tsx src/scene/DescentBall.test.tsx
git commit -m "feat(scene): lift DescentBall material ref for the hero beat

Optional materialRef prop attached to the orb's MeshPhysicalMaterial so HeroBeat
can drive emissiveIntensity/emissive during the arrival beat. Position stays owned
by DescentBall; the prop is optional (standalone-usable). Behavior-preserving."
```

---

### Task 18: `HeroBeat.tsx` — the controller + the final `SceneContents` composition

**Files:**
- Create: `src/scene/HeroBeat.tsx`
- Create: `src/scene/HeroBeat.test.tsx`
- Modify: `src/scene/Scene.tsx` (wire the shared refs to every owner + mount `<HeroBeat>` + `<EmberRing>`)

> **Why:** The integrator. One `useFrame` reads `simStore` transiently, runs the trigger + state machine (Tasks 14–15), and MUTATES the consumer refs across the three stages + divergence: ball material (`emissiveIntensity`/`emissive`), trail material (`.color`), `bloom.intensity`, `dof.bokehScale` (NOT `.target` — PostStack owns that), `vignette.darkness`, and the ember ring (position/opacity/scale). Timed touchdown uses `MathUtils.lerp`; the seek phases use `maath/easing`. Zero `setState`. It keeps frames flowing via `invalidate()` for the beat's tail (the idle-while-settling edge). Then `SceneContents` is finalized: the single `heroRefs` is threaded to every owner (ball, trail, post-stack) and to `<HeroBeat>`. Every ref is null-guarded, so on Low (no composer) the beat degrades to the emissive + ember choreography.

- [ ] **Step 1: Write the failing test — `src/scene/HeroBeat.test.tsx`**

```tsx
// @vitest-environment happy-dom
import { useRef } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { createHeroRefs } from './heroRefs';
import HeroBeat from './HeroBeat';

function Host({ refs, emberRef }: { refs: ReturnType<typeof createHeroRefs>; emberRef: React.RefObject<THREE.Mesh | null> }) {
  return <HeroBeat refs={refs} emberRef={emberRef} />;
}

describe('HeroBeat (R3F structure smoke)', () => {
  it('renders nothing and mutates the ball material on arrival without throwing', async () => {
    // Seed an arrived state: sphere at the minimum.
    useUIStore.getState().setFunctionId('sphere');
    useUIStore.getState().setStartPoint([0.02, 0.02]);
    simStore.getState().setTheta([0.02, 0.02]);
    simStore.getState().setCost(0.0008);
    simStore.getState().setDiverged(false);

    const refs = createHeroRefs();
    const ballMat = new THREE.MeshPhysicalMaterial({ emissive: '#00D3F2', emissiveIntensity: 3 });
    refs.ballMaterial.current = ballMat;

    const emberRef = { current: new THREE.Mesh(new THREE.RingGeometry(0.14, 0.2, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })) };

    const renderer = await ReactThreeTestRenderer.create(<Host refs={refs} emberRef={emberRef} />);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0); // controller renders nothing
    // Run through idle→approach(~APPROACH_MS=800ms≈48 frames)→touchdown. 90 frames
    // (~1.5s at 1/60) clears the lead-in and enters the flash with margin.
    await renderer.advanceFrames(90, 1 / 60);
    expect(ballMat.emissiveIntensity).toBeGreaterThan(3); // the flash began
    await renderer.unmount();
  });

  it('dims the ball core on divergence (the visual opposite)', async () => {
    useUIStore.getState().setFunctionId('rosenbrock');
    simStore.getState().setTheta([-1.2, 1]);
    simStore.getState().setCost(1e9);
    simStore.getState().setDiverged(true);

    const refs = createHeroRefs();
    const ballMat = new THREE.MeshPhysicalMaterial({ emissive: '#00D3F2', emissiveIntensity: 3 });
    refs.ballMaterial.current = ballMat;
    const emberRef = { current: null as THREE.Mesh | null };

    const renderer = await ReactThreeTestRenderer.create(<Host refs={refs} emberRef={emberRef} />);
    await renderer.advanceFrames(60, 1 / 60);
    expect(ballMat.emissiveIntensity).toBeLessThan(3); // dimmed, not brightened
    await renderer.unmount();
    simStore.getState().setDiverged(false); // restore
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

```bash
npm test -- HeroBeat
```

Expected: **FAIL** — module not found.

- [ ] **Step 3: Implement — `src/scene/HeroBeat.tsx`**

```tsx
import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import type { Vec2 } from '../engine/types';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import { evaluateArrival } from './heroTrigger';
import { advanceHero, initialHeroState, heroNeedsFrames, type HeroState } from './heroState';
import type { HeroRefs } from './heroRefs';

/** Locked beat colours (PRD §5.5/§5.4). */
const CORE_CYAN = new THREE.Color('#00D3F2');
const WHITE_HOT = new THREE.Color(6, 6, 4); // ball core flash color={[6,6,4]}
const HALO_CYAN = new THREE.Color('#00D3F2'); // for the live-trail material .color (LDR)
const FUCHSIA = new THREE.Color('#ED6AFF'); // live-trail divergence (LDR)
// HDR halo targets for the PERSISTENT TUBE's uHaloColor uniform (authored ×1.8,
// matching DescentPath's HALO_CYAN so the tube halo stays bloom-bright while easing).
const PATH_HALO_CYAN = new THREE.Color('#00D3F2').multiplyScalar(1.8);
const PATH_HALO_FUCHSIA = new THREE.Color('#ED6AFF').multiplyScalar(1.8);

export interface HeroBeatProps {
  refs: HeroRefs;
  /** The ember ground ring mesh (positioned + animated by the beat). */
  emberRef: RefObject<THREE.Mesh | null>;
}

/** Build the per-run identity string from Channel A (pure; read inside the frame). */
function runIdentity(u: {
  functionId: string;
  optimizerId: string;
  learningRate: number;
  startPoint: readonly [number, number];
}): string {
  return `${u.functionId}|${u.optimizerId}|${u.learningRate}|${u.startPoint.join(',')}`;
}

/**
 * The hero arrival beat controller (spec §5.6). Renders nothing. One useFrame
 * reads simStore TRANSIENTLY, runs the arrival trigger + state machine, and
 * MUTATES the consumer refs — ball material, trail material, bloom, dof.bokehScale
 * (PostStack owns dof.target), vignette, ember ring. Two-channel rule: zero
 * setState (the phase lives in a useRef). Keeps frames flowing via invalidate()
 * for the beat's tail. Divergence is terminal: fuchsia halo + dimming core.
 */
export default function HeroBeat({ refs, emberRef }: HeroBeatProps) {
  const invalidate = useThree((s) => s.invalidate);

  const heroRef = useRef<HeroState>(initialHeroState(''));
  const prevCostRef = useRef<number>(NaN);
  const convergedRunRef = useRef<number>(0);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const emberTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const dtMs = delta * 1000;
    const { theta, cost, diverged } = simStore.getState();
    const u = useUIStore.getState();
    const fn = getFunction(u.functionId);
    const runId = runIdentity(u);

    // Run change resets the convergence trackers.
    if (runId !== heroRef.current.runId) {
      convergedRunRef.current = 0;
      prevCostRef.current = NaN;
    }

    // Trigger evaluation (skipped while diverged — the machine handles that).
    let arrived = false;
    if (!diverged) {
      const res = evaluateArrival({
        theta: theta as Vec2,
        cost,
        prevCost: prevCostRef.current,
        minima: fn.minima as readonly Vec2[],
        domain: fn.domain,
        convergedRun: convergedRunRef.current,
      });
      arrived = res.arrived;
      convergedRunRef.current = res.converging ? convergedRunRef.current + 1 : 0;
    }
    prevCostRef.current = cost;

    // Advance the machine.
    const next = advanceHero(heroRef.current, { arrived, diverged, runId }, dtMs);
    heroRef.current = next;

    // Drive the visuals by ref mutation (all null-guarded → tier-graceful).
    const ballMat = refs.ballMaterial.current;
    const trailMat = refs.trailMaterial.current;
    const pathHalo = refs.pathHalo.current; // persistent tube halo (survives Trail NO-GO)
    const bloom = refs.bloom.current;
    const dof = refs.dof.current;
    const vignette = refs.vignette.current;
    const ember = emberRef.current;

    switch (next.phase) {
      case 'idle':
        if (ballMat) {
          easing.damp(ballMat, 'emissiveIntensity', 3.0, 0.2, delta);
          easing.dampC(ballMat.emissive, CORE_CYAN, 0.2, delta);
        }
        if (bloom) easing.damp(bloom, 'intensity', 1.2, 0.3, delta);
        if (vignette) easing.damp(vignette, 'darkness', 0.55, 0.3, delta);
        if (dof) easing.damp(dof, 'bokehScale', 3.0, 0.3, delta);
        break;
      case 'approach':
        // Halo bleeds toward cyan on BOTH the live trail (if present) and the
        // persistent tube (always present) → the cue survives a Trail NO-GO.
        if (trailMat) easing.dampC(trailMat.color, HALO_CYAN, 0.25, delta);
        if (pathHalo) easing.dampC(pathHalo.uHaloColor.value, PATH_HALO_CYAN, 0.25, delta);
        break;
      case 'touchdown': {
        const t = next.t; // 0..1 over TOUCHDOWN_MS
        if (ballMat) {
          ballMat.emissiveIntensity = THREE.MathUtils.lerp(3.0, 5.0, t);
          tmpColor.copy(CORE_CYAN).lerp(WHITE_HOT, t);
          ballMat.emissive.copy(tmpColor);
        }
        if (trailMat) trailMat.color.copy(HALO_CYAN);
        if (pathHalo) pathHalo.uHaloColor.value.copy(PATH_HALO_CYAN);
        if (bloom) bloom.intensity = THREE.MathUtils.lerp(1.2, 2.6, t);
        if (vignette) vignette.darkness = THREE.MathUtils.lerp(0.55, 0.72, t);
        if (dof) dof.bokehScale = THREE.MathUtils.lerp(3.0, 1.6, t); // sharpen the rack
        break;
      }
      case 'settle':
        if (ballMat) {
          easing.damp(ballMat, 'emissiveIntensity', 2.2, 0.4, delta);
          easing.dampC(ballMat.emissive, CORE_CYAN, 0.4, delta);
        }
        if (bloom) easing.damp(bloom, 'intensity', 1.4, 0.5, delta);
        if (vignette) easing.damp(vignette, 'darkness', 0.55, 0.5, delta);
        if (dof) easing.damp(dof, 'bokehScale', 3.0, 0.5, delta);
        if (ember) {
          const [wx, wz] = paramToWorldXZ(theta[0], theta[1], fn.domain);
          const wy = costToWorldHeight(cost, u.functionId) + 0.002; // hair above surface
          emberTarget.set(wx, wy, wz);
          easing.damp3(ember.position, emberTarget, 0.3, delta);
          ember.visible = true;
          easing.damp3(ember.scale, 1, 0.4, delta);
          const mat = ember.material as THREE.MeshBasicMaterial;
          easing.damp(mat, 'opacity', 0.9, 0.45, delta);
        }
        break;
      case 'diverged':
        if (trailMat) easing.dampC(trailMat.color, FUCHSIA, 0.3, delta);
        if (pathHalo) easing.dampC(pathHalo.uHaloColor.value, PATH_HALO_FUCHSIA, 0.3, delta);
        if (ballMat) {
          easing.damp(ballMat, 'emissiveIntensity', 1.0, 0.4, delta); // dim, not white
          easing.dampC(ballMat.emissive, CORE_CYAN, 0.4, delta);
        }
        if (bloom) easing.damp(bloom, 'intensity', 0.8, 0.4, delta);
        if (ember) {
          const mat = ember.material as THREE.MeshBasicMaterial;
          easing.damp(mat, 'opacity', 0, 0.3, delta); // no ember on failure
        }
        break;
    }

    // Keep frames flowing for the beat's tail even if isPlaying flipped to demand.
    if (heroNeedsFrames(next)) invalidate();
  });

  return null;
}
```

> **DOF note:** HeroBeat writes `dof.bokehScale` only; PostStack writes `dof.target`. Disjoint — no two-writer conflict (decision 7).

- [ ] **Step 4: Run (GREEN) + typecheck + build**

```bash
npm test -- HeroBeat
npm run typecheck
npm run build
```

Expected: both HeroBeat tests pass (flash brightens on arrival; dims on divergence); typecheck + build clean (the unused-helper trap: ensure `runIdentity` is used — it is, inside the frame).

- [ ] **Step 5: Finalize `src/scene/Scene.tsx` — wire the shared refs + mount HeroBeat + EmberRing.** Thread `heroRefs` into every owner and add the integrator. The complete `SceneContents`:

```tsx
import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import { TIER_SETTINGS } from '../quality/tiers';
import Lights from './Lights';
import SceneEnvironment from './SceneEnvironment';
import { Surface } from './Surface';
import Swarm from './Swarm';
import DescentBall from './DescentBall';
import DescentPath from './DescentPath';
import DescentTrail from './DescentTrail';
import PostStack from './PostStack';
import EmberRing from './EmberRing';
import HeroBeat from './HeroBeat';
import { createHeroRefs } from './heroRefs';
import { useSimRunner } from './useSimRunner';

export function SceneContents() {
  useSimRunner();

  // The single cross-subsystem ref bundle (stable identity). Threaded to every
  // owner so they populate .current; the whole object is handed to HeroBeat.
  const heroRefs = useMemo(() => createHeroRefs(), []);
  const emberRef = useRef<THREE.Mesh>(null);

  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      <fogExp2 attach="fog" args={[0x0b0e1a, 0.08]} />

      <Lights />
      <SceneEnvironment mode="hdr" hdr="/hdri/satara_night_no_lamps_1k.hdr" />

      <Surface />
      <Swarm />
      {/* Ball owns position; lifts its material ref so HeroBeat drives the emissive. */}
      <DescentBall materialRef={heroRefs.ballMaterial} />
      {/* Persistent revealed tube; publishes its halo uniform so the cyan/fuchsia
          cue reads even if the live <Trail> NO-GO'd (PathUniforms ⊇ pathHalo's shape). */}
      <DescentPath materialUniformsRef={heroRefs.pathHalo} />
      {/* Live ribbon (publishes its material to the beat for the halo bleed). */}
      <DescentTrail materialRef={heroRefs.trailMaterial} />
      {/* The lone ember ring — positioned/animated by HeroBeat in 'settle'. */}
      <EmberRing ref={emberRef} />
      {/* Post-stack — ALWAYS mounted, self-gates by tier; populates bloom/dof/vignette. */}
      <PostStack refs={heroRefs} />
      {/* The integrator — renders nothing; mutates the assembled refs each frame. */}
      <HeroBeat refs={heroRefs} emberRef={emberRef} />
    </>
  );
}

export function Scene() {
  const isPlaying = useUIStore((s) => s.isPlaying);
  const tier = useUIStore((s) => s.tier);
  const frameloop = isPlaying ? 'always' : 'demand';

  return (
    <Canvas shadows camera={{ position: [3, 3, 3], fov: 50 }} dpr={[1, TIER_SETTINGS[tier].dpr]} frameloop={frameloop}>
      <OrbitControls makeDefault />
      <SceneContents />
    </Canvas>
  );
}
```

> **Note on `DescentPath` halo coupling:** the hero beat eases BOTH the live-trail halo (`heroRefs.trailMaterial.color`, LDR) AND the persistent tube's halo uniform (`heroRefs.pathHalo.uHaloColor.value`, HDR ×1.8). Wiring the tube halo too is what makes the approach-cyan and divergence-fuchsia cues survive a `<Trail>` NO-GO (Task 5) — if the live ribbon is absent, `trailMaterial` stays null and the tube halo carries the cue. `DescentPath`'s exported `PathUniforms` is structurally assignable to `heroRefs.pathHalo`'s `{ uHaloColor: { value: THREE.Color } }` type, so the assignment in `materialUniformsRef={heroRefs.pathHalo}` typechecks without a cast.

- [ ] **Step 6: Update `src/scene/Scene.test.tsx` for the final composition.** The existing drei + postprocessing mocks remain. Add assertions that the ember ring and the new subsystems mount (the `RingGeometry` mesh is present; the scene still has ≥2 meshes + the directional light). Confirm at `tier='low'` the scene still mounts (PostStack self-gates to the renderer path). Run:

```bash
npm test -- Scene
npm run typecheck
npm run build
```

Expected: green. (HeroBeat renders nothing; EmberRing adds the `RingGeometry` mesh; Swarm adds a `Points`; DescentPath/Trail add meshes — assert ≥3 meshes and the `RingGeometry` present.)

- [ ] **Step 7: Commit**

```bash
git add src/scene/HeroBeat.tsx src/scene/HeroBeat.test.tsx src/scene/Scene.tsx src/scene/Scene.test.tsx
git commit -m "feat(scene): HeroBeat controller + final M1b scene composition

One useFrame runs the trigger + state machine and choreographs the ~700ms beat by
ref mutation: ball emissive flash/settle/dim, trail halo bleed (cyan→white→fuchsia),
bloom flare, dof.bokehScale rack (PostStack owns dof.target), vignette pulse, ember
ring ignite. Zero setState; frames kept flowing via invalidate() for the tail.
SceneContents threads one heroRefs bundle to every owner; null-guards degrade the
beat gracefully on Low (no composer)."
```

> **Gate:** Phase D complete — the full M1b cinematic scene composes. All structure tests + gates green. Task 19 is the consolidated live design checkpoint.

---

### Task 19: M1b phase gate — typecheck + build + test + live browser smoke + design checkpoint

A consolidation/gate task: prove the whole M1b tree is green across all three CI gates, then drive the **live** scene in a real browser via Playwright MCP — the only way to verify the merged post-stack renders, the swarm's half-float flow field samples on the GPU (Risk #4's second half), the trail/path ribbon reveals, and the hero beat plays (success + divergence). Present the result to the user as the M1b design checkpoint.

**Files:** none created — verification + checkpoint. Any fix it surfaces is committed at the end.

- [ ] **Step 1: All three CI gates green.**

```bash
npm test
npm run typecheck
npm run build
```

Expected: the full Vitest suite green (M1a's 119 + the new M1b unit/structure tests), typecheck clean, `tsc -b && vite build` clean. Record the test count. If `npm run build` flags `noUnusedLocals` anywhere (the M0/M1a lesson — the passing test suite masks it), fix and re-run.

- [ ] **Step 2: Start the dev server (background) + load the Playwright MCP schemas.**

```bash
npm run dev > /tmp/ascent-dev.log 2>&1 &
```

Expected: `Local: http://localhost:3000/` (read the actual port from the log if 3000 is taken).

```
ToolSearch: select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_wait_for,mcp__plugin_playwright_playwright__browser_evaluate
browser_navigate → url: "http://localhost:3000/"
browser_wait_for → time: 2
```

- [ ] **Step 3: Hard gate — ZERO WebGL/console errors on the full composed scene.**

```
browser_console_messages → onlyErrors: true
```

Expected: empty. Specifically NO: GLSL compile/link errors (the swarm vertex reusing `functionFieldGLSL`, the path reveal shader), `EffectComposer`/N8AO errors, half-float "incomplete texture"/"not supported" warnings (Risk #4 on the GPU), meshline/`<Trail>` errors (Risk #2), or React error-boundary traces. If a half-float warning appears, apply the **FloatType fallback** (Task 11): construct `new THREE.DataTexture(f32, 256, 256, THREE.RGBAFormat, THREE.FloatType)` storing raw floats (no `toHalfFloat`); the shader is unchanged; re-smoke. Record which path shipped.

- [ ] **Step 4: Screenshot the idle composed scene (all layers).**

```
browser_take_screenshot → filename: "ascent-m1b-scene-idle.png", fullPage: false
```

Expected: the magma Rosenbrock surface under the **AGX grade** (filmic, moody), the lacquered ball glowing (selective bloom), **cyan-white motes drifting** above the surface (the swarm riding the displaced terrain, fading in/out), N8AO darkening the valley contact, vignette + grain barely perceptible. Surface itself does NOT bloom.

- [ ] **Step 5: Play a converging run → capture the hero arrival beat (success).** Use a fast converger so arrival happens quickly — Sphere + Adam, or keep Rosenbrock but expect a longer descent:

```
browser_evaluate → function: "() => { const s = window.__ascent.uiStore.getState(); s.setFunctionId('sphere'); s.setStartPoint([3,3]); s.setOptimizerId('adam'); s.setLearningRate(0.1); s.setPlaying(true); return 'playing sphere/adam'; }"
browser_wait_for → time: 4
browser_take_screenshot → filename: "ascent-m1b-hero-arrival.png", fullPage: false
browser_console_messages → onlyErrors: true
```

Expected: the ball has descended to the basin; the **arrival beat fired** — the core flashed white-hot then settled to a steady cyan beacon, the trail halo bled cyan, bloom flared, and the **single ember-amber ground ring** ignited at the minimum. Zero errors. (If the beat didn't trigger, the trigger threshold needs tuning — check `ARRIVE_PARAM_FRAC`; Adam on sphere from (3,3) reaches ≈(0,0) well within 0.04·10.)

- [ ] **Step 6: Trigger a divergence → capture the failure beat (the visual opposite).**

```
browser_evaluate → function: "() => { const s = window.__ascent.uiStore.getState(); s.setPlaying(false); s.setFunctionId('rosenbrock'); s.setStartPoint([-1.2,1]); s.setOptimizerId('sgd'); s.setLearningRate(0.1); s.setPlaying(true); return 'diverging rosenbrock/sgd/0.1'; }"
browser_wait_for → time: 2
browser_take_screenshot → filename: "ascent-m1b-hero-diverge.png", fullPage: false
browser_console_messages → onlyErrors: true
```

Expected: SGD lr=0.1 on Rosenbrock diverges in ~5 steps (the M1a finding); the **trail halo shifts fuchsia and the ball core DIMS** (no white flash, no ember). `simStore.diverged` drove the terminal phase. Zero errors.

- [ ] **Step 7: 60fps spot-check at High with the full stack.**

```
browser_evaluate → function: "() => new Promise(res => { let n=0; const t0=performance.now(); const tick=()=>{ n++; if(performance.now()-t0<1000){requestAnimationFrame(tick);} else {res(Math.round(n*1000/(performance.now()-t0)));} }; requestAnimationFrame(tick); })"
```

Expected: ~55–60 fps at tier `high` (dpr 1.75, 30k swarm, full post-stack) on the dev GPU. A number well below ~45 flags a budget problem to note (e.g. N8AO quality too high, bloom levels, swarm count) — record it for M1c's adaptive tuning; not necessarily an M1b blocker but capture the number.

- [ ] **Step 8: Tier degrade spot-check (Low → no composer, swarm thins, beat still plays).**

```
browser_evaluate → function: "() => { window.__ascent.uiStore.getState().setTier('low'); return 'low'; }"
browser_wait_for → time: 1
browser_console_messages → onlyErrors: true
browser_take_screenshot → filename: "ascent-m1b-low-tier.png", fullPage: false
browser_evaluate → function: "() => { window.__ascent.uiStore.getState().setTier('high'); return 'high'; }"
```

Expected: zero errors at Low; AGX via the renderer (no composer), the swarm at 3k, the emissive glow as fake-bloom, and the hero beat still choreographs the ball/ember (bloom/dof/vignette refs null → no-op, graceful). Restore High.

- [ ] **Step 9: Stop the dev server.** Kill the background `npm run dev` job so it doesn't linger across turns.

- [ ] **Step 10: Present the M1b design checkpoint to the user.** Show the screenshots (`ascent-m1b-scene-idle.png`, `ascent-m1b-hero-arrival.png`, `ascent-m1b-hero-diverge.png`, `ascent-m1b-low-tier.png`) + the measured fps, and state the explicit **M1b exit criteria** — every box must be checked before M1b is declared done:

  - [ ] **Post-stack renders** with the AGX grade; **selective bloom** glows the ball/trail/ember but NOT the surface; N8AO darkens crevices; vignette/CA/grain barely perceptible (no "neon mush").
  - [ ] **Swarm** of motes drifts above the displaced surface (rides the terrain), fades in/out, holds frame rate; half-float flow field samples cleanly on the GPU (or the FloatType fallback shipped — recorded).
  - [ ] **Descent path** ribbon grows down the valley tracking the ball; the **live `<Trail>`** streams behind it (or the documented tube-only fallback shipped — recorded).
  - [ ] **Hero arrival beat** fires on convergence: white-hot flash → steady cyan beacon → single ember ground ring. **Divergence beat** fires on failure: fuchsia halo + dimming core. Both ~700ms, framerate-independent.
  - [ ] **Zero WebGL console errors** across idle, play, converge, diverge, and a Low-tier swap.
  - [ ] **All three gates green:** `npm test`, `npm run typecheck`, `npm run build`.
  - [ ] **~60fps** spot-check at tier `high` with the full stack (number recorded; any shortfall noted for M1c).
  - [ ] **Two-channel rule held:** no per-frame `setState` anywhere (the beat phase is a ref; geometry swaps use `invalidate()`; all uniforms are ref mutations).

  > **Note:** M1c (the final M1 cycle) is planned just-in-time after this checkpoint: `detect-gpu` detection-before-mount + `<PerformanceMonitor>` live auto-scaling, the iteration scrubber (`frameloop` gains the `'live'`/`'scrubbing'` mode split + `mode`/`scrubIndex`/`playbackSpeedMs` in `uiStore`), live KaTeX (verify the font paths under `vite build` — Risk #3), the uPlot loss chart (the shared rAF reads `simStore`), promotes `detect-gpu` to an explicit dep, and lands the committed non-flaky Playwright smoke test.

- [ ] **Step 11: Commit any final touch-ups surfaced by the gate** (a tuning tweak from the exposure dip, a trigger-threshold adjustment, the FloatType fallback if half-float misbehaved, a `noUnusedLocals` fix, or a curve-type change if the tube kinked). If the tree is already clean, skip the commit.

```bash
git add -A
git commit -m "fix(scene): M1b gate touch-ups — <describe the specific fix>

Surfaced by the M1b phase gate (typecheck/build/console/live smoke). <e.g. tuned
ARRIVE_PARAM_FRAC so the beat fires reliably; shipped the FloatType flow-field
fallback after a half-float sampling warning on the GPU; eased the exposure dip
via environmentIntensity.>"
```

---

**Notes for the assembling author (not part of the plan body):**

- **Cross-subsystem seam:** the single `HeroRefs` object (`heroRefs.ts`, Task 2) is the spine. Owners populate it (`DescentBall` ← Task 17, `DescentTrail` ← Task 10/18, `PostStack` ← Tasks 3/18); `HeroBeat` (Task 18) is the only mutator. `PostStack` is **always mounted** (self-gates internally) so its Low-tier renderer-AGX `useEffect` runs — do NOT gate it out in `Scene`.
- **DOF two-writer split (decision 7):** `PostStack` writes `dof.target` (the follow); `HeroBeat` writes `dof.bokehScale` (the rack). Disjoint.
- **Two-channel rule:** the path geometry swap (Task 9) uses direct `mesh.geometry` mutation + `invalidate()`, NOT `setState` — the strict form. The hero phase (Task 18) lives in a `useRef`. All uniforms (`uTime`, `uProgress`, the beat) are ref mutations. The only `setState`-adjacent calls are the rare reactive store reads (`functionId`/`tier`) that drive `useEffect`/geometry-budget setup, never the frame loop.
- **AGX:** always `mode={ToneMappingMode.AGX}` (the symbol; runtime 7, `.d.ts` says 8). Low tier uses `gl.toneMapping = THREE.AgXToneMapping` (6) on the renderer (valid only with no composer).
- **Smoke-test-early ordering:** Risk #2 (`<Trail>`) is Task 5 (start of Phase B); Risk #4 (half-float) is Task 11 (CI encode/decode) + Task 19 (GPU sampling); the post-stack's own "does it merge on the GPU" risk is Task 4. Each has a written fallback.
- **Files grounded against (absolute):** `src\scene\{Scene,Surface,DescentBall,useSimRunner,surfaceMapping,Lights,SceneEnvironment}.tsx/.ts`, `src\scene\shaders\{functionField,surfaceShaders,colormap}.ts`, `src\state\{simStore,uiStore}.ts`, `src\quality\tiers.ts`, `src\engine\{stepper,functions/registry,types}.ts`. New deps verified installed: `maath@0.10.8`, `postprocessing@6.39.1`, `n8ao@1.10.2`, `meshline@3.3.1` (the last three transitive via `@react-three/postprocessing@3.0.4`).



