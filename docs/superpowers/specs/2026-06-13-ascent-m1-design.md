# ASCENT M1 — "The Stunning Core" Design Spec

- **Status:** Approved design — ready for implementation planning (M1a plan first; M1b/M1c planned just-in-time)
- **Date:** 2026-06-13
- **Supersedes nothing; extends:** the M0 foundation (engine, two-channel state, tier-settings map, empty R3F scene) merged to `main` as `v0.1.0-m0`.
- **Source of truth:** `PRD.md` §5, §6, §7, §9, §11 — **with the four corrections recorded in §3 below** (verified against installed library source; the PRD's §5.4 recipe predates the actual library behavior).

> **For implementers:** this is the architecture + decisions spec. The task-by-task work lives in the per-cycle plans under `docs/superpowers/plans/`. Read `PRD.md` once, then this, then your cycle's plan. The PRD is canonical for *look and intent*; where this spec's §3 corrects a PRD *mechanism*, this spec wins (with citations).

---

## 1. Goal & scope

Turn the M0 placeholder cube into PRD milestone M1: an **HD cinematic single-descent** on the preset landscapes that is demonstrably "the wow" — 60fps at High tier on desktop, graceful Low tier. M1 delivers everything in PRD §11's M1 row:

GPU-displaced magma surface (analytic normals, in-shader contours) · full AGX/HalfFloat post-stack (selective bloom, N8AO, DOF, SMAA, grade) · PMREM environment + physical materials + soft shadows · stateless ambient swarm + baked flow field · iteration scrubber · live KaTeX · uPlot loss chart · adaptive tier system · the hero arrival beat.

**Explicitly NOT in M1** (later milestones, do not build): multi-optimizer racing & leaderboard & internal-state viz (M2); live custom `f(x,y)` editor, presets gallery, driver.js onboarding, Study/Spectacle toggle, mobile drawer (M3); NN-bridge, real ML loss surface, export/screenshot (M4). M1 ships with the curated preset functions and a single descending agent.

### 1.1 Exit criteria (from PRD §11, made concrete)

- Cinematic single-descent runs on the preset ladder at a **locked 60fps at High tier** on desktop; degrades to a functional **Low tier** (no `EffectComposer`, emissive-mesh fake glow).
- The **hero arrival beat** is demoable.
- No `setState`-per-frame regressions (the two-channel rule holds).
- A committed Playwright smoke test guards: canvas mounts, zero WebGL console errors, tier resolves, frame-cadence sanity.

---

## 2. Delivery strategy — three short cycles

M1 is sliced into three plan→execute→review→ship cycles (the user-selected "finer 3-way split"). Each cycle is independently demoable.

| Cycle | Delivers | Why this boundary |
|---|---|---|
| **M1a — Scene & Surface** | Engine hardening (the two carryover fixes); GPU-displaced magma surface (CSM); physical materials; procedural `<SceneEnvironment>` + soft shadows; lacquered ball; the `useFrame` sim runner; the **lighting A/B decision**. | The terrain + the descent reading as real geometry is the foundation everything else composes onto. The lighting A/B needs the real ball + surface on screen to judge. |
| **M1b — Post-stack, Swarm & Hero Beat** | Full AGX/HalfFloat merged post-stack; stateless 65k swarm + baked flow-field DataTexture; `TubeGeometry` path + live `<Trail>`; the ~700ms hero arrival beat. | This is the "cinematic" layer — it sits on top of a working scene and is where the bloom/HDR/selective-glow tuning happens against real geometry. |
| **M1c — Adaptive Tiers & Instrumentation** | `detect-gpu` detection-before-mount + `<PerformanceMonitor>` live scaling; iteration scrubber; live KaTeX; uPlot loss chart; committed Playwright smoke test. | Robustness + teaching overlays come last: the tier system needs the full render cost present to tune drop-order, and the overlays read a sim that's already running. |

**Planning cadence:** the **M1a detailed plan is written now**, alongside this spec. **M1b and M1c plans are written at the start of their cycle**, informed by what M1a teaches (the lighting A/B outcome; the CSM depth-material smoke-test result; measured frame cost). This is the point of three cycles — each plan is grounded in the prior cycle's reality rather than guessed up front.

---

## 3. PRD corrections (signed off 2026-06-13)

The M1 research fan-out verified each post-stack claim against the **installed** source (`@react-three/postprocessing` 3.0.4 wrapping `postprocessing` 6.39.1, `three` 0.184.0). Four PRD §5.4/§6.3 mechanisms are wrong as written. The **visual intent is unchanged**; only the mechanism changes.

1. **AGX comes from the tone-mapping *effect*, not the renderer.** PRD §5.4 says `renderer.toneMapping = THREE.AgXToneMapping`. The `EffectComposer` wrapper sets `gl.toneMapping = NoToneMapping` for its entire mounted lifetime (three disallows tone-mapping into render targets), so the renderer setting **silently does nothing**. **Correct:** `<ToneMapping mode={ToneMappingMode.AGX} />` (import `ToneMappingMode` from `postprocessing`) as the **last** effect child.
   *Exception:* the **Low tier mounts no composer**, so there the renderer path `renderer.toneMapping = THREE.AgXToneMapping` IS valid and is how Low gets AGX.
   *Source: `@react-three/postprocessing/src/EffectComposer.tsx` (the `gl.toneMapping = NoToneMapping` lifetime effect); `three` 0.184 exposes `AgXToneMapping===6` and `ToneMappingMode.AGX===7`.*

2. **`toneMappingExposure = 0.9` is ignored on the composer path.** `ToneMappingEffect` does not read `renderer.toneMappingExposure`. The PRD's "moody dip below 1.0" must instead come from `environmentIntensity` / emissive levels / light intensity, tuned in-browser at the M1a checkpoint. (Do not rely on the exposure knob while a composer is mounted.)

3. **Effect order: move ChromaticAberration adjacent to SMAA.** The wrapper merges only *contiguous* non-convolution effects into one `EffectPass`. SMAA and ChromaticAberration are **convolution** effects; the PRD's literal order (`…SMAA → Vignette → CA → Noise → ToneMapping`) strands Vignette in its own pass because CA splits it from Noise+ToneMapping. **Correct order:** `N8AO → Bloom → DOF → SMAA → ChromaticAberration → Vignette → Noise → ToneMapping`, which merges Vignette+Noise+ToneMapping into one final pass. The PRD §9.2 claim "pmndrs merges all non-convolution fragment effects into a single EffectPass" is only true when they are contiguous.
   *Source: runtime `getAttributes()` on each effect — `EffectAttribute.CONVOLUTION===2`; SMAA & ChromaticAberration set it, Bloom/DOF/Vignette/Noise/ToneMapping do not.*

4. **N8AO `accumulate` and `denoiseRadius` are not JSX props.** PRD §6.3 wants `accumulate=true, denoiseRadius=0` for near-noise-free idle AO. The `<N8AO>` wrapper exposes `aoRadius, distanceFalloff, intensity, color, halfRes, quality` as props; `accumulate`/`denoiseRadius` are set imperatively via a ref: `n8aoRef.current.configuration.accumulate = true` in a `useEffect`. Also: the `quality` prop and `setQualityMode()` **recompile shaders** — set once per tier, never bind to an interactive value.

These four are recorded here as the canonical correction; the per-cycle plans reference this section rather than restating it.

---

## 4. Architecture

### 4.1 Module boundaries (PRD §8.4 — extended, not changed)

```
engine/     pure TS, no React/Three. M1 change: ONLY the two Phase-0 hardening fixes.
state/      zustand. uiStore (reactive) gains scrubber/playback fields. simStore unchanged.
quality/    tiers.ts (exists) + NEW: detect.ts (detection-before-mount) + QualityGovernor (PerformanceMonitor wiring).
scene/      R3F components + GLSL. The bulk of M1. Surface, ball, environment, lights, post-stack, swarm, path, beacon, sim-runner, hero-beat.
ui/         NEW: DOM overlays (siblings of <Canvas>, NOT drei <Html>): LossChart, FormulaPanel, Scrubber.
```

### 4.2 The two-channel rule in practice (PRD §8.2 — the spine of M1)

This is the single most important runtime constraint and the thing the committed test guards.

- **Channel A — reactive (`uiStore`):** function choice, optimizer, learning rate, isPlaying, tier, start point, **and new for M1**: scrubber `mode` (`'live' | 'scrubbing'`), `scrubIndex`, `playbackSpeedMs`. Changing these may re-render React. They change rarely (user actions).
- **Channel B — transient (`simStore`, vanilla):** `theta`, `iteration`, `cost`, `diverged`. Written **only** by the sim runner's single `useFrame`. Read transiently via `getState()`/`subscribe()` — by the 3D objects (mutated directly in `useFrame`) and by the overlays' shared rAF. **Never** `setState` per frame, anywhere.

The overlays (chart, formulas) do **not** read Channel B through React. A **single shared `requestAnimationFrame` loop** reads `simStore.getState()` once per frame, pushes a point to uPlot every frame, and re-renders KaTeX every ~5th frame (~12Hz). Started/stopped by a `useEffect` keyed on `isPlaying`. This guarantees overlay/scene consistency and keeps the instruments off the GPU frame budget.

### 4.3 Render loop & frameloop

One `useFrame` (the **sim runner**) owns the fixed-timestep stepper: it advances the stepper by `delta`, writes the result into `simStore`, and the scene's objects read it transiently. `frameloop` is driven by React state:

- `isPlaying && mode==='live'` → `'always'` (the sim steps every frame; `<PerformanceMonitor>` also needs steady frames to sample).
- paused, or `mode==='scrubbing'` → `'demand'`; the scrubber writes a history frame into `simStore` and calls `invalidate()` per scrub step.
- The hero beat needs frames flowing for its ~700ms: it runs while `isPlaying` (already `'always'`), or flips to `'always'` for its duration if triggered while idle.

Note (verified): switching `frameloop` resets `clock.elapsedTime` to 0. The stepper uses **delta** accumulation (safe), but any `elapsedTime`-based easing must tolerate the reset — use `delta`, never absolute clock time, for the follow-camera and hero-beat easing.

---

## 5. Component & data-flow design

### 5.1 The cost surface (M1a — the thorniest piece)

**Material strategy: `three-custom-shader-material` (CSM) v6.4.0 wrapping `THREE.MeshPhysicalMaterial`.** This is the one significant new architectural decision. Rationale:

- A raw `THREE.ShaderMaterial` gets **none** of the PBR pipeline (clearcoat, PMREM env reflections, shadow receiving, fog, dithering) — reimplementing it by hand is hundreds of lines of fragile GLSL re-synced on every three bump. Rejected.
- `MeshPhysicalMaterial.onBeforeCompile` string-patching works (it's what drei's `MeshDistortMaterial` does) but makes us own the brittle chunk-name matching and the typing gap. Kept only as the **depth-material fallback** (see below).
- **CSM** does exactly that patching as a maintained, R3F-native, typed package: it ships its own `<primitive>`-based component (no `extend()` needed for the main material), infers base-material props from the `baseMaterial` generic (so `roughness/metalness/clearcoat/fog/dithering` pass through, correctly typed), and patches at the right chunks so the displaced surface relights correctly. Peer `three >=0.159` (no upper bound) → **no three bump**, stays under the postprocessing `<0.185` cap.

**Mechanism (PRD §6.4):** a *static* UV-only `planeGeometry` at the tier's segment count (128/64/48/32), rotated −90° about X. The vertex shader writes:
- `csm_Position` — Y displacement from uniforms (the packed equation params). Geometry never re-uploads; a function/coeff change is a uniform write + `invalidate()`.
- `csm_Normal` — the **analytic** normal `normalize(vec3(-df/dx·Jx, -df/dz·Jz, 1))`, where `Jx, Jz = HEIGHT_SCALE·(paramRange/surfaceSize)` per axis (the mesh-space Jacobian; PRD §6.4's chain-rule caveat — without it, lighting normals are wrong). **Analytic partials, not screen-space `dFdx`** — screen-space derivatives are flat per-triangle and would kill smooth clearcoat/env reflections.

The fragment shader writes `csm_Emissive` — the magma LUT (sampled over `t∈[0.12,1.0]`) + in-shader **`fwidth()` anti-aliased contours/wireframe** (animated by subtracting `uTime`), with the soft rolloff `emissive = emissive/(1.0+emissive)` as the **last** op so highlights stay sub-1.0 and never trip the bloom threshold (PRD §5.4). Optionally a subtle `csm_DiffuseColor` tint so the PBR shading still reads.

**Shadows from a displaced surface** (PRD §6.4 implication): a normal depth pass uses *undisplaced* geometry, so shadows detach from peaks/valleys. The surface needs a `customDepthMaterial` running the **same** displacement, sharing the **same uniforms object**. Plan A: a second CSM with `baseMaterial={THREE.MeshDepthMaterial}`, `attach="customDepthMaterial"`. **⚠️ Smoke-test first (M1a):** CSM's availability map enumerates only lit materials, not `MeshDepthMaterial`. If it fails to compile, Plan B is a hand-rolled `THREE.MeshDepthMaterial` + `onBeforeCompile` injecting the same displacement into `#include <begin_vertex>` (three's documented pattern). Directional key light → only `customDepthMaterial` needed (no `customDistanceMaterial`).

**Uniform discipline:** create the uniforms object once with `useMemo` (stable identity); mutate `ref.current.uniforms.X.value` imperatively. R3F merges the uniforms into the material once — mutating the original memo object after mount does nothing. Keep shader **source static** (drive all variation via uniforms) or CSM's `customProgramCacheKey` thrashes and recompiles.

### 5.2 Environment & lighting (M1a — the A/B lives here)

A single **`<SceneEnvironment mode="procedural" | "hdr">`** component (the swappable boundary the user approved).

- **Procedural (default):** `<Environment frames={1} resolution={256} background={false} environmentIntensity={0.6}>` with 2–4 `<Lightformer>` rect emitters as a dark-studio softbox rig — a dim white key, a cyan (`#00D3F2`) rim, an ember (`#FFA23A`) rim. `frames={1}` = a single static cube-camera bake (zero per-frame cost). The palette-tinted rims are the genuine upside: the ball's reflections carry the world's accents.
- **HDR (`.hdr`):** `<Suspense><Environment files="/hdri/<asset>_1k.hdr" background={false} environmentIntensity={0.6} /></Suspense>` (RGBELoader). Self-hosted under `public/hdri/`.

**Both** keep `background={false}` so the locked void `#0B0E1A` + fog remain the backdrop; the env is reflections + low-frequency fill only. **PMREM is automatic** — three's r184 renderer auto-prefilters any texture assigned to `scene.environment` when read by a `MeshStandardMaterial`-derived material; no manual `PMREMGenerator`. The single global fill knob is `environmentIntensity` on `<Environment>` (writes `scene.environmentIntensity`).

**The A/B (M1a checkpoint):** I build procedural as primary, then screenshot it in the real scene next to the candidate `.hdr` on the actual ball + surface. **`.hdr` is the presumed winner** (user's stated lean); the boundary makes the final pick a one-component swap. Candidates, all CC0, self-hostable from `dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<slug>_1k.hdr`:
1. **`satara_night_no_lamps`** — dim, low-contrast, near-pure starlight; cleanest for a dark scene.
2. **`dikhololo_night`** — clear low-contrast safari night; this is the exact asset drei's `night` preset uses (battle-tested).
3. **`moonless_golf`** — very dark, strong void feel with faint highlights.

**Shadows:** `<Canvas shadows>` (→ `PCFSoftShadowMap`). High tier mounts drei `<SoftShadows size={25} samples={10} focus={0} />` **once** at scene root (it globally patches `THREE.ShaderChunk` and recompiles all materials on mount *and on any prop change* — treat its props as static per-tier config, **never animate**). One `<directionalLight castShadow>` with `shadow-mapSize` 2048 (4096 Ultra), `shadow-bias={-0.0005}`, `shadow-normalBias={0.02}`, and a **tight** ortho frustum fit to the small scene (±6–8 units) — frustum tightness, not just map size, drives sharpness. Medium tier swaps SoftShadows for `<ContactShadows frames={1} />` (cheaper, render-once — `frames={1}` is essential or it re-renders every frame).

### 5.3 The descent ball & path (M1a ball, M1b path)

- **Ball:** `MeshPhysicalMaterial` lacquered orb (`roughness=0.3, metalness=0, clearcoat=1.0, clearcoatRoughness=0.05`), emissive core for selective bloom. Position mutated directly in the sim runner's `useFrame` from `simStore.theta` (interpolated by the stepper's `alpha`).
- **Path (M1b):** a single `TubeGeometry` along the descent polyline + a `u_progress` uniform revealing it via `smoothstep` on the normalized arc-length (`TubeGeometry`'s built-in `uv.x` is already `i/tubularSegments`; an explicit `aArc` from `curve.getLengths()` only if true arc-length-even spacing is wanted). One draw call, frame-rate-independent reveal (driven by a sim clock value in [0,1], not dt accumulation). Plus drei **`<Trail target={ballRef}>`** (meshline) for the live ribbon. **⚠️ Smoke-test `<Trail>` early (M1b)** — most reconciler-coupled component.

### 5.4 Post-processing stack (M1b)

`<EffectComposer multisampling={0} frameBufferType={HalfFloatType}>` — `multisampling={0}` is **mandatory** (the wrapper defaults to 8; SMAA + N8AO depth both require MSAA off). Children in the **corrected order** (§3.3):

`N8AO → Bloom → DOF → SMAA → ChromaticAberration → Vignette → Noise → ToneMapping(AGX, last)`

- **N8AO** first (runs right after the internal RenderPass, on the lit scene → crevices don't bloom). `aoRadius=0.4, distanceFalloff=1.0, intensity=3, color=black, halfRes` (all but Ultra). `quality` set once per tier (recompiles); `accumulate`/`denoiseRadius` via ref (§3.4).
- **Bloom** `mipmapBlur, intensity=1.2, luminanceThreshold=0.9, luminanceSmoothing=0.025, radius=0.7, levels=9`. **Selective by physics:** glow materials set `emissiveIntensity>1` **and** `toneMapped={false}`; the HalfFloat buffer keeps values >1 un-clamped so only they exceed the 0.9 threshold. Drive glow via emissiveIntensity, never by lowering the threshold (PRD's "neon mush" warning).
- **DOF** rack-focus via a `target` ref eased toward the ball position with `maath/easing.damp3` (passing `target` enables autofocus; a static target gives a fixed plane, so mutate it each frame).
- **SMAA** `preset={HIGH}` (`ULTRA` at Ultra tier).
- **ToneMapping** `mode={ToneMappingMode.AGX}` — **last** (§3.1).

**Tier shape:** Medium turns **DOF off** (Bloom small/0.5×, N8AO low/half or off). **Low mounts no `EffectComposer` at all** — emissive-mesh fake glow + `renderer.toneMapping = AgXToneMapping` (valid with no composer). Conditionally render the composer subtree per tier. Prefer toggling composer `enabled` over unmount/remount (the N8AO wrapper has a documented dispose/leak TODO).

### 5.5 The ambient swarm + flow field (M1b)

- **Swarm:** raw `<points frustumCulled={false}>` + `<bufferGeometry>` with a dummy `attributes-position` (count drives the draw) + custom `attributes-aSeed` / `attributes-aSpeed`, driving a custom material from drei's `shaderMaterial()` factory (drei `<Points>` can't carry custom attributes — dead end). Each particle's position is a **pure function of `(attributes, uTime)`** in the **vertex shader** — zero simulation textures. `uTime` mutated on the material ref in `useFrame` (no setState). Fill-rate rules (PRD §7.4): `gl_PointSize = clamp(uSize/-mvPosition.z, 1.0, 3.0)`, `uSize≈16·pixelRatio`, `AdditiveBlending`, `depthWrite:false`, `depthTest:true`, soft circular sprite via `gl_PointCoord` alpha math (no texture fetch).
- **Flow field:** a `THREE.DataTexture(uint16Data, 256, 256, RGBAFormat, HalfFloatType)` baked **once** at mount in `useMemo`. **`RGBAFormat`** (not RGB — Intel-mobile compat) and the data array **must** be a `Uint16Array` of `THREE.DataUtils.toHalfFloat()` bit patterns (a Float32Array would need FloatType). `RG = normalized(−∇J)`, `B = |∇J|`, `A = curl`. Sampled in the **vertex** shader via `texture2D` (NearestFilter → exact texels; GLSL1 default is fine, no `glslVersion` needed). Constructor already defaults Nearest + ClampToEdge; set `needsUpdate = true` once. **⚠️ Smoke-test the half-float DataTexture on target GPU (M1b).**

### 5.6 The hero arrival beat (M1b)

The one orchestrated ~700ms moment (PRD §5.5): trail halo bleeds toward cyan → ball core flashes white-hot (`color=[6,6,4]`, emissive 3→5) with a cyan halo → relaxes to steady cyan + one ember-amber ground ring. Animated entirely by **ref mutation in `useFrame`** via `maath/easing.damp`/`damp3`/`dampC` (already transitively installed, pmndrs-idiomatic, framerate-independent) — bloom intensity flare, DOF target rack, vignette pulse, the color choreography. No per-frame setState. Frames must flow for its duration (§4.3). Divergence beat (failure): halo → fuchsia `#ED6AFF`, core *dims* (the visual opposite).

### 5.7 Adaptive tiers (M1c)

**Two distinct mechanisms** (the research's key clarification — easy to conflate):

1. **Detection-before-mount:** `getGPUTier({ benchmarksURL: '/benchmarks' })` (async, runs **once before `<Canvas>`**). `detect-gpu` is already installed (transitive via drei) — promote to an explicit dep, pinned to the installed `5.0.x` (import `detect-gpu`, **not** `@pmndrs/detect-gpu` which is the unreleased 6.0 rename). **Self-host** the benchmark JSON: a `prebuild` step copies `node_modules/detect-gpu/dist/benchmarks` → `public/benchmarks/` (no unpkg/CSP runtime dependency). Map `TierResult` → our `Tier` (`WEBGL_UNSUPPORTED`/`tier 0`→`fallback`; mobile or `<4` cores→`low`; `tier≥3`→`ultra` if `≥8` cores else `high`; `tier 2`→`medium`; else `low`). `.catch()` → `'low'` (OutdatedError rejects). Gate `<Canvas>` mount on `TIER_SETTINGS[tier].mountCanvas`.
2. **Live auto-scaling:** drei `<PerformanceMonitor>` as the first `<Canvas>` child (it uses `useFrame`). **`bounds` MUST be set explicitly** — the installed default never inclines on a 60Hz panel. `onChange({factor})` → `setDpr()` imperatively (via `useThree`) + quantize `factor` to a coarse `Tier` written to `uiStore` **only on boundary crossing** (ref-guarded). Plus drei `<AdaptiveDpr pixelated />` + `<AdaptiveEvents />` + `<OrbitControls makeDefault regress />` for the **separate** transient regression channel (`performance.current`, driven by orbit). Both channels compose; `setDpr` is last-writer.

Runtime decision (recorded): `setTier` at runtime scales **dpr only**; segment/particle **counts stay at the detected start tier** to avoid mid-session geometry-rebuild hitches. (Re-applying full `TIER_SETTINGS` live is deferred — flagged, not silently dropped.)

### 5.8 Instrumentation overlays (M1c)

All three are **DOM siblings of `<Canvas>`** (in `App.tsx`, layered with CSS `position:absolute`), **never** drei `<Html>` (which reprojects inside the R3F loop and drags them into the GPU budget). Fed by the shared rAF (§4.2).

- **uPlot loss chart:** **hand-rolled** create-once (`useLayoutEffect` → `new uPlot(opts, [[],[]], host)`, `destroy()` in the *same* effect's cleanup → StrictMode-double-mount-safe). **Not `uplot-react`** — its `data`-prop flow forces a React render per point, breaking the two-channel rule. Stream via `u.setData([xs,ys], false)` (the `false` preserves scales) once per rAF, coalescing per-step pushes. Bounded buffer mirrors the engine ring-buffer cap. Area fill + cyan current-value point. `ResizeObserver` → `u.setSize()` (uPlot has no built-in observer). Series array designed to grow for M2 racing, instantiated with one series now.
- **Live KaTeX:** `katex.render(latex, el, { throwOnError:false, output:'htmlAndMathml' })` into stable DOM nodes, splicing current numerics into the cost/gradient/update-rule templates. Throttled to ~12Hz on the shared rAF (per-step 60Hz re-render is wasteful; values change imperceptibly between frames). Pre-format numbers with fixed `toFixed`/`toExponential` to avoid width jitter. Import `katex/dist/katex.min.css` once at entry — **⚠️ verify Vite rewrites the `url(fonts/…)` refs under production `vite build`** (silent box-glyph failure otherwise).
- **Iteration scrubber:** `mode`/`scrubIndex`/`playbackSpeedMs` in `uiStore`. Scrubbing flips `frameloop` to `'demand'`, reads `history[scrubIndex]` from the ring buffer, writes theta/iteration/cost into `simStore` (the existing `useFrame` mutation picks it up), calls `invalidate()`. **Honest range:** the ring-buffer cap means old iterations are gone — drive the slider from `history[i].iteration` values and label the retained window; never map a `0..N` slider onto a capped buffer (it would lie about which iteration is shown).

---

## 6. Engine hardening (M1a Phase 0 — the two carryover fixes)

Both must land **before** the sim runner drives the stepper at 60fps. Both are pure-TS, test-first (TDD), in the existing `engine/` module. Source: the M0 final-audit carryover (memory `m1-carryover-fixes`).

1. **Stepper `history` → bounded ring buffer + store cost.** `src/engine/stepper.ts` currently pushes one `HistoryEntry` per step with no cap → O(n) memory growth at sustained 60fps. Cap it (ring buffer or max length). The scrubber legitimately needs history, so **cap thoughtfully** (a window, not removal). **Also:** populate `HistoryEntry.cost` (currently optional and unset) — the scrubber needs it for the chart marker and the formula panel. The live chart streams cost from `simStore` (always populated); the scrubber reads it from history, so history must carry it.
2. **Adam-family `aux` → bias-corrected moments.** `adam.ts`/`adamw.ts`/`nadam.ts` put **raw** `m`,`v` into `StepResult.aux`, but `types.ts` documents `aux` as carrying **bias-corrected** moments for the M2 internal-state viz. The step math is correct (bias correction is applied in the θ update); only the `aux` debug/viz payload is inconsistent with its doc. Align `aux` to expose `m̂`,`v̂` (bias-corrected). M1 doesn't render `aux` yet, but fixing it here keeps the contract honest before M2 consumes it.

These keep the engine's public surface stable except `HistoryEntry.cost` becoming reliably populated and `aux` semantics matching the doc.

---

## 7. New dependencies

| Package | Version | Why | three bump? |
|---|---|---|---|
| `three-custom-shader-material` | `^6.4.0` | Surface material — displacement + custom normals/emissive while keeping the full PBR pass (§5.1). | No (peer `three >=0.159`, open upper bound) |
| `uplot` | `~1.6` | Loss chart (hand-rolled wrapper, not `uplot-react`). | n/a |
| `katex` + `@types/katex` | `^0.17` | Live formulas. | n/a |
| `detect-gpu` | pin installed `5.0.x` | Promote transitive→explicit (we import it directly). **Not** `@pmndrs/detect-gpu`. | No |
| `maath` | pin installed `0.10.x` | Promote transitive→explicit (hero-beat + DOF easing). | No |

`n8ao` and `meshline` stay **transitive** (used only via their pmndrs wrappers). Build script: add `prebuild` to copy detect-gpu benchmarks into `public/benchmarks/`. **No change to the `three ~0.184` pin** — nothing in M1 forces it (verified across all six research streams); the postprocessing `<0.185` cap holds.

---

## 8. Verification (layered — user-selected "Both + layered QA")

1. **Per-task fan-out review** (the proven M0 workflow): spec-compliance + code-quality + the independent typecheck/build re-run that caught M0's `noUnusedLocals` build-gate failures the passing test suite masked. Every task.
2. **Live MCP browser checks** during dev: I drive the real browser (Playwright MCP) for screenshots, console-error checks, and FPS spot-checks **on your GPU** — this is the *real* 60fps proof (CI has no real GPU). Also the mechanism for the lighting A/B.
3. **Your design checkpoint** at the end of each of M1a/M1b/M1c — screenshots for your eyes before the cycle ships.
4. **Committed Playwright smoke test** (final M1c task): canvas mounts, **zero WebGL console errors**, tier resolves, coarse frame-cadence sanity. Deliberately **minimal and non-flaky** — a regression tripwire for M2+, *not* a pixel-diff judge (the scene is intentionally stochastic: animated grain, swarm, shimmer — pixel-diffing would be flaky and is explicitly out).
5. **Unit tests** (Vitest, headless) for Phase-0 engine hardening and any pure logic; the existing `@react-three/test-renderer` smoke test stays green.

### 8.1 Four "smoke-test-early" integration risks

Each is verified at the **start** of its phase with a ready fallback so it can't stall the cycle:

| # | Risk | Phase | Fallback |
|---|---|---|---|
| 1 | CSM `customDepthMaterial` (displaced shadows) — not in CSM's availability map | M1a | Hand-rolled `MeshDepthMaterial` + `onBeforeCompile` (three's documented pattern) |
| 2 | drei `<Trail>` + meshline under R3F 9.6 — most reconciler-coupled | M1b | Fall back to the `TubeGeometry`-only path reveal (drop the live ribbon, or a thin custom line) |
| 3 | KaTeX CSS font paths under production `vite build` | M1c | Explicit Vite asset handling / copy fonts to `public/` |
| 4 | Half-float DataTexture on target GPU | M1b | Debug-quad verify; FloatType fallback if half-float sampling misbehaves |

---

## 9. Risks (M1-specific, beyond PRD §13)

- **Surface material is the critical path.** CSM is the linchpin of M1a; the depth-material smoke test (risk #1) is the first real task after Phase 0 so a fallback decision happens early, not late.
- **Post-stack frame budget** (PRD §13) — mitigated by the strict drop order (§5.4 tier shape) + the adaptive system; M1b tunes against measured cost on your GPU.
- **`r180→r181` PBR energy-conservation change** makes rough materials read slightly brighter — tune `envMapIntensity`/emissive against the **actual r184 render**, not older reference screenshots.
- **`<SoftShadows>` global recompile** — only mount once; never bind its props to a live control.

---

## 10. Open questions deferred to in-cycle tuning (not blockers)

These are aesthetic/measured calls the research correctly refused to guess; they resolve **in-browser during the relevant cycle**, not now:

- The "moody exposure dip" realization (env intensity vs. emissive vs. a small brightness effect before ToneMapping) — M1a/M1b checkpoint.
- Whether N8AO `accumulate` is on always vs. only when the follow-camera is idle — M1b.
- `<Autofocus manual>` (raycast hitpoint) vs. plain `<DepthOfField target>` driven by `ballRef` — M1b (lean: direct target, simpler/cheaper for a known ball position).
- Final lighting A/B winner — M1a checkpoint (your call, `.hdr` presumed).
- Exact tier `factor`→`Tier` cut-points and `<PerformanceMonitor>` bounds — M1c, tuned on real hardware.
- Colormap delivery: in-shader stop interpolation vs. a 1D LUT DataTexture — M1a (PRD says "LUT-accurate"; confirm which is exact + cheap).

---

## Appendix — research provenance

The four PRD corrections (§3) and the API specifics throughout (§5) were produced by a six-stream research fan-out (2026-06-13) that verified every claim against the **actually-installed** source in `node_modules` (not documentation or model memory) — `@react-three/postprocessing` 3.0.4 / `postprocessing` 6.39.1, `three` 0.184.0, `@react-three/fiber` 9.6.1, `@react-three/drei` 10.7.7, `three-custom-shader-material` 6.4.0, `detect-gpu` 5.0.70, `maath` 0.10.8, `uplot` 1.6.x, `katex` 0.17.0. Confidence was rated per claim; the high-confidence claims are runtime-verified, and the medium ones are flagged in the per-cycle plans where they matter.
