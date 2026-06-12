# ASCENT — Product Requirements Document

> **An interactive, high-end 3D gradient-descent simulation for the web.**
> Simultaneously as *rigorous* as Distill, as *beautiful* as losslandscape.com, and as *playful* as TensorFlow Playground — in WebGL. A genuine teaching instrument and a portfolio-grade visual showpiece, with neither goal compromising the other.

- **Status:** Approved design — ready for implementation planning
- **Author:** Lead Creative Technologist (design session)
- **Date:** 2026-06-11
- **Working title:** ASCENT *(rename TBD; descent toward the minimum is the "ascent" of understanding)*
- **Repository branches:** `legacy` (original implementation, preserved) · `main` (this build)
- **Supersedes:** the original single-surface MSE demo on the `legacy` branch (scrapped from the ground up)

---

## 1. Vision & Positioning

### 1.1 The opportunity

Research across the field shows existing gradient-descent / loss-landscape tools split into **three camps that almost never overlap**:

| Camp | Exemplar | Strength | Gap |
|---|---|---|---|
| **Rigorous but 2D/abstract** | [Distill — "Why Momentum Really Works"](https://distill.pub/2017/momentum/) | Gold-standard math, sliders beside each figure | No 3D, no rolling-ball intuition, no multi-optimizer race; assumes a mathematical reader |
| **Beautiful but doesn't teach** | [losslandscape.com (Ideami)](https://losslandscape.com/) | The most beautiful loss surfaces in existence | Never shows the update rule or compares optimizers; pretty → "what a learning rate does" link is loose |
| **Functional but utilitarian** | [lilipads](https://github.com/lilipads/gradient_descent_viz), [simulations4all](https://simulations4all.com/), [TF Playground](https://playground.tensorflow.org/) | Racing, internal-state viz, fearless UX | Dated desktop app / one-optimizer-at-a-time / not 3D |

**The unclaimed intersection — rigorous + beautiful + playful, in WebGL — is the entire opportunity.** ASCENT occupies all three at once.

### 1.2 What "AAA / put game devs to shame" means here

Not more meshes, more effects, more toggles. It means a tight loop of **physically based lighting + a real merged post-processing stack + bespoke shader detail + obsessively tuned motion**, all in service of *one memorable idea*. The render must read as **cinematic, not webby**. The single highest-ROI move — present from day one — is filmic tone mapping (AGX) + image-based lighting (HDRI). One memorable beat (arrival at the minimum) beats a pile of competing effects.

### 1.3 Reference bar (experiences to rival)

1. [Lusion](https://lusion.co/) — restraint + art direction; pick one mechanic, execute flawlessly.
2. [Bruno Simon](https://bruno-simon.com/) — one strong concept, tasteful restraint; his "Realistic Render" lesson (AGX/ACES, HDRI, directional intensity) is our literal roadmap.
3. [losslandscape.com](https://losslandscape.com/) — the *beauty* bar. We beat it on pedagogy.
4. [three.js examples](https://threejs.org/examples/) — `webgl_postprocessing_unreal_bloom_selective`, `_dof`, `_gtao`, `_smaa`, `webgl_materials_physical_*`, `webgl_materials_envmaps_hdr` are our reference implementations.
5. [pmndrs/postprocessing](https://github.com/pmndrs/react-postprocessing) — merged `EffectPass` architecture that runs heavy chains at 60fps.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- **G1 — Dual mandate.** Be a genuine teaching tool *and* a visual showpiece, co-equal. A "Study mode" swaps spectacle visuals for perceptually-honest ones when classroom accuracy matters.
- **G2 — Deep interactivity.** Custom mathematical landscapes (user-entered `f(x,y)`), adjustable learning rates and optimizer hyperparameters, real-time path visualization, click-to-place start points.
- **G3 — Visual excellence.** A cinematic-dark, HD/"rendered"-quality scene at a locked 60fps on desktop, degrading gracefully to mobile.
- **G4 — Correctness.** Exact analytic gradients (autodiff), mathematically faithful optimizer update rules, validated against finite differences.
- **G5 — Always shippable.** Phased milestones; each milestone is a coherent, demoable product.

### 2.2 Non-Goals (v1)

- **No audio.** Strictly silent in v1 (clean toggle architecture left in place for a later addition).
- **No backend / accounts / persistence beyond local.** Client-only app; share-by-URL state is a stretch goal, not a requirement.
- **No training of large models in-browser.** The "real ML loss surface" is a tiny 2-parameter model, not a deep net (the filter-normalized full-net slice is a deliberately deferred future milestone).
- **No >3-parameter optimization.** The visualization is inherently a 2-parameter (`x,y`) → cost (`z`) surface; higher dimensions are addressed conceptually via the NN-bridge panel, not rendered.

---

## 3. Audience & Device Targets

| Persona | Need | Implication |
|---|---|---|
| **ML student / self-learner** | Build intuition for what gradient descent, learning rate, momentum, and adaptive methods actually *do* | Clarity, guided onboarding, honest colormaps, live formulas |
| **Educator** | A vivid classroom demonstrator that works on a mid-range laptop | Graceful degradation, presets, scrubber to freeze on teaching moments |
| **ML practitioner** | Compare optimizer behavior on hard landscapes | Racing mode, internal-state viz, custom equations |
| **Portfolio / showcase viewer** | Be impressed in 10 seconds | Cinematic mode, the hero beat, the swarm |

**Device target:** **Desktop-first** for full spectacle (good GPU); **mobile stays fully functional at a graceful lower tier**. Adaptive performance auto-scales between them (see §9).

---

## 4. Functional Requirements

### 4.1 Two hero modes (co-equal)

A prominent mode switch toggles between:

- **Cinematic Descent.** One descending agent, gorgeous rack-focus follow-camera, the "arrival at the minimum" hero beat (bloom flare, DOF rack-focus, elastic settle). Optimized for beauty and focus.
- **Optimizer Racing.** Multiple optimizers descend the **same** surface from the **same** start point simultaneously — color-coded trails, a live loss leaderboard, internal-state visualization. The field's #1 unclaimed gap; the headline differentiator.

### 4.2 Optimizers (full suite of 9)

Each implemented as a uniform `step(θ, grad) → θ'` holding its own state. Update rules (θ = point, g = gradient, elementwise; t starts at 1):

| Optimizer | Update rule | Default hyperparams |
|---|---|---|
| **SGD** | `θ = θ − η·g` | η=0.1 |
| **Momentum** | `v = γv + ηg; θ = θ − v` | γ=0.9 |
| **Nesterov (NAG)** | `v = γv + η·∇f(θ − γv); θ = θ − v` *(grad at look-ahead)* | γ=0.9 |
| **AdaGrad** | `G += g²; θ = θ − η/√(G+ε)·g` | η=0.01, ε=1e-8 |
| **RMSProp** | `E = 0.9E + 0.1g²; θ = θ − η/√(E+ε)·g` | η=0.001, ε=1e-8 |
| **Adam** | `m=β₁m+(1−β₁)g; v=β₂v+(1−β₂)g²; m̂=m/(1−β₁ᵗ); v̂=v/(1−β₂ᵗ); θ=θ−η·m̂/(√v̂+ε)` | β₁=0.9, β₂=0.999 |
| **AdamW** | as Adam, but first `θ = θ − ηλθ` (decoupled decay, NOT into g) | λ=1e-2 |
| **Newton** *(2nd-order)* | `θ = θ − H⁻¹g`; 2×2 closed-form inverse; Levenberg-Marquardt damping | with clear "diverges/seeks saddles on non-convex" UI warning |

> **Newton note:** requires second derivatives (symbolic-twice or hyper-dual). It legitimately diverges and seeks saddles on non-convex landscapes — this is surfaced as a teaching point with explicit UI warnings, not hidden.

### 4.3 Landscapes

**Curated test-function ladder** (each teaches one phenomenon):

| Function | Formula | Global min | Teaching role |
|---|---|---|---|
| Sphere | `x²+y²` | (0,0)=0 | convex baseline |
| Matyas | `0.26(x²+y²)−0.48xy` | (0,0)=0 | mild conditioning |
| Booth | `(x+2y−7)²+(2x+y−5)²` | (1,3)=0 | clean convex |
| **Rosenbrock** | `(1−x)²+100(y−x²)²` | (1,1)=0 | narrow curved valley / zig-zag **(headline)** |
| Beale | `(1.5−x+xy)²+(2.25−x+xy²)²+(2.625−x+xy³)²` | (3,0.5)=0 | sharp ill-conditioning |
| Saddle | `x²−y²` | saddle (0,0) | momentum vs Adam behavior at saddles |
| Himmelblau | `(x²+y−11)²+(x+y²−7)²` | four minima =0 | different starts → different minima |
| Rastrigin (A=10) | `20+x²+y²−10(cos2πx+cos2πy)` | (0,0)=0 | many local minima / escape story |
| Ackley | `−20·exp(−0.2√(0.5(x²+y²)))−exp(0.5(cos2πx+cos2πy))+e+20` | (0,0)=0 | local minima + flat outer region |

Rosenbrock gradient (validation anchor; must be `[0,0]` at (1,1)): `∂x = −2(1−x)−400x(y−x²)`, `∂y = 200(y−x²)`.

**Plus:**
- **Live custom `f(x,y)`** — user types an equation, KaTeX-rendered, parsed and rendered in real time with exact gradients (§5).
- **Real ML loss surface** — a genuine trained 2-parameter model (logistic/linear regression on a real dataset), so "cost" is a real ML objective, not just a math function.

### 4.4 Math engine

- **Parser:** [math.js](https://mathjs.org/) for parsing only. **Parse-and-compile once** on equation submit (~24× faster than re-parsing per step); never touch the parser inside the descent loop. Use the modular `create()` API to keep the Vite bundle lean.
- **Gradients:** **forward-mode dual-number autodiff** walking the math.js AST (~100 lines). Full exact gradient of `f(x,y)` in two evaluations (seed `x` then `y`). No step-size error, no dependence on `derivative()` coverage. Built-in functions get **hardcoded analytic gradients** (cheap, exact, and they validate the autodiff layer).
- **Validation:** every gradient checked against central differences `(f(x+h)−f(x−h))/2h`, h≈1e-5, to ~1e-6.
- **Robustness:** guard non-finite values (log of negative, div-by-zero, adaptive blowup) — clamp / early-stop and surface a UI error rather than break the scene.

### 4.5 UI / UX features

- **Glassmorphic HUD** (custom, branded) as the primary UI — borrows Leva's *input ergonomics* (real draggable sliders, vector start-point input), not its debug aesthetic. shadcn/ui (Radix + Tailwind) primitives where accessibility/theming demand grows. On mobile, the panel moves into a `Sheet`/`Drawer` so it never covers the canvas.
- **Live KaTeX formulas** — render the cost `J(w,b)`, gradient `∇J`, and update rule `w := w − α·∂J/∂w`, splicing **current numeric values** into the LaTeX each step so the formula animates alongside the ball. `throwOnError:false`, `output:'htmlAndMathml'` for accessibility.
- **Iteration scrubber** (the biggest affordance other tools miss) — horizontal timeline bound to iteration index, with play / pause / step-forward / step-back + speed control (25–500ms/step). Lets users freeze on failure modes. Switches `frameloop` to `"demand"` while scrubbing.
- **Loss-vs-iteration chart** — [uPlot](https://github.com/leeoniya/uPlot) (~48KB canvas, 60fps streaming) sparkline with area fill and a live current-value dot; multi-series with cursor sync in racing mode.
- **Click-anywhere-to-set-start-point** + per-iteration gradient arrows (Ben Frederickson interaction); drag-to-orbit camera.
- **Presets gallery** — named scenarios bundling function + start + LR + camera: *Smooth bowl*, *Saddle point*, *Ravine / oscillation*, *Divergence at high α*, *Local-minimum trap*.
- **Onboarding tour** — [driver.js](https://driverjs.com/) (MIT — avoids Shepherd's AGPL), opt-in ~5-step spotlight (start point, surface, learning-rate control, scrubber, loss chart). First-visit `localStorage` flag + a "?" replay button. Skippable, non-intrusive.
- **Internal-state visualization** (racing mode) — velocity arrows (momentum), accumulator squares (AdaGrad/RMSProp/Adam) so users *see why* Adam adapts and AdaGrad stalls.
- **Divergence drama** — crank α and the ball flies off the surface; a deliberate, legible *moment*, not a silent side effect.
- **NN bridge** — (a) a 3Blue1Brown-style conceptual panel ("this 2D bowl is a slice of a million-D weight space," animated) **and** (b) a real trained 2-param model loss surface to descend on.

---

## 5. Visual Design System — "Cinematic Dark" (locked)

> Direction: deep indigo void → electric cyan, with an indigo bridge and a hot ember/amber payoff. **90% dark void, 10% precise neon.** Fact-checked (0 claims refuted). Two surface colormap modes: **Spectacle (magma)** default, **Study (cividis)** for perceptual honesty.

### 5.1 Core palette

| Token | Hex | Role |
|---|---|---|
| **void / surface-0** | `#0B0E1A` | app background, fog color (blue-tinted near-black, *not* `#000` — pure black flattens depth, kills glass blur, causes OLED halation) |
| surface-1 | `#121626` | subtle panel base (white @ 5% over void) |
| surface-2 | `#1A1F33` | card / glass panel (white @ 9%) |
| surface-3 | `#252B42` | raised panel / hover (white @ 14%) |
| glass border (hairline) | `rgba(255,255,255,0.10)` | panel edge |
| glass border (focus) | `#43484E` | focus ring |

**Accents — 3-accent split-complementary (OKLCH, near-constant L so all pop evenly):**

| Role | Hex | OKLCH | Use |
|---|---|---|---|
| **Primary — Electric Cyan** | `#00D3F2` | `oklch(0.789 0.154 211.5)` | world identity: edge-lighting, focus rings, key data, convergence beacon |
| **Secondary — Indigo bridge** | `#6977F0` | `oklch(0.62 0.18 275)` | bridges cyan↔magenta; UI selection, secondary buttons, active states |
| **Hero — Ember/Amber** | `#FFA23A` | `oklch(0.80 0.155 62)` | the warm complement; reserved almost entirely for the trail halo + the "arrival" beat (the 10% in 60-30-10) |

**Text (never pure `#FFF` — kills halation):**

| Role | Hex | Contrast on surface-2 |
|---|---|---|
| Primary | `#EBEEF5` | ≈13.5:1 — AA & AAA |
| Secondary | `#A0A5AE` | ≈6.2:1 — AA |
| Muted | `#6B7180` | ≈3.3:1 — large/UI only |

> Never put body text on a saturated accent fill; use the lighter cyan `#4CCCE6` when an accent must carry text.

**Semantic:**

| State | Hex | Notes |
|---|---|---|
| Success / converged | `#00D3F2` (cyan) → cool-white core | convergence reads as the hero cyan beacon, not generic green |
| Warning / diverging | `#ED6AFF` (fuchsia) | trail/cost climbing/exploding — visually opposite the calm cyan arrival |
| Error (hard) | `#FF5C8A` (warm-pink) | neon-noir error tone |

### 5.2 Surface colormaps

- **Spectacle (default) — MAGMA, range-remapped.** Perceptually uniform *and* literally a glowing-hot-metal luminance ramp (black→purple→magenta→orange→yellow) matching the emissive aesthetic and "low cost = cool/dim, high cost = hot." Sample over **`t ∈ [0.12, 1.0]`** (Moreland low-end remap) so valleys never read as fake shadow. GPU path: LUT-accurate stop interpolation from [glslify/glsl-colormap](https://github.com/glslify/glsl-colormap) (BSD-2). Key stops: `#150E37 · #3B0F70 · #641A80 · #8C2981 · #B73779 · #DD513A · #F8765C · #FCA50A · #FCFDBF`.
- **Study mode — CIVIDIS.** Colorblind-safe (deuteranopia/protanopia perceive near-identically), monotonic lightness. Sample over `t ∈ [0.15, 0.95]`. Stops: `#00204D · #00336F · #3C4D6E · #666970 · #948F78 · #BCAF6F · #FFEA46`.
- **Optional high-contrast — TURBO** (Anton Mikhailov; verified 5th-order GLSL polynomial fit by Ruofei Du, [gist](https://gist.github.com/mikhailov-work/0d177465a8151eb6ede1768d51d476c7), Apache-2.0). Tooltip: *"high-contrast view — not perceptually uniform, not colorblind-safe; equal colors ≠ equal cost steps."*
- **Shading note:** render the surface with flat/low diffuse (or low-emissive) so Lambertian shadows don't stack with the colormap's own luminance ramp.

### 5.3 Optimizer trail colors

**Rule: white-hot HDR core (`#FFF4E6`, emissive >1) + thin colored halo.** Every trail shares the white-hot core so it reads as "the light" against "the terrain." Identity comes from the halo hue — chosen from the cool/green/blue side of the wheel that **magma does not occupy**, so trails never camouflage:

| Optimizer | Halo | Optimizer | Halo |
|---|---|---|---|
| SGD | `#00D3F2` cyan | Adagrad | `#A0F0FF` ice |
| Momentum | `#6977F0` indigo | Nesterov | `#B57BFF` lilac |
| RMSProp | `#34E89E` mint | AdamW | `#7CFFB2` spring |
| Adam | `#FFFFFF` white (lead) | Newton | `#5BC8FF` sky |

Separate by **value + saturation**, not hue alone. Halo `emissiveIntensity ≈ 1.5–2.0`, core `≈ 3–4`. For ≤4 racers, use SGD/Momentum/RMSProp/Adam (cyan/indigo/mint/white — the four most separable).

### 5.4 Bloom + tone mapping + grade recipe

**Pipeline order (locked):** `HalfFloatType EffectComposer` → render scene in linear HDR → **N8AO** (ambient occlusion applied to the lit scene first, so darkened crevices don't bloom) → **Bloom (mipmapBlur)** → **DOF** → **SMAA** → **Vignette** → **ChromaticAberration** → **Noise (grain)** → **ToneMapping/OutputPass (AGX) LAST**. Tone mapping last so bloom accumulates in linear HDR before the filmic rolloff.

```js
renderer.toneMapping = THREE.AgXToneMapping;   // preserves hue/saturation at top end — neon stays colored, not clipped white
renderer.toneMappingExposure = 0.9;            // dip below 1.0 for a moody dark scene
```

**Emissive intensity (HDR, >1 — selective bloom by physics).** All glowing materials set `toneMapped={false}` or the value is clamped before bloom sees it.

| Element | emissiveIntensity |
|---|---|
| Trail core (white-hot) | 3.5 |
| Trail halo (colored) | 1.8 |
| Descent ball | 3.0 |
| Convergence beacon (core) | 5.0 (`color={[6,6,4]}`) |
| Beacon halo | 2.2 (cyan) |
| Surface | 0 (or ≤0.4) — stays sub-1.0 so it never blooms |

**Bloom params (pmndrs):** `mipmapBlur`, `intensity={1.2}`, `luminanceThreshold={0.9}` (high → only HDR pixels glow → selective by physics), `luminanceSmoothing={0.025}`, `radius={0.7}`, `levels={9}`. Composer: `{ frameBufferType: THREE.HalfFloatType, multisampling: 0 }` (HalfFloat **required** or >1.0 clamps and the HDR trick silently fails). **Drive glow brightness with emissiveIntensity, not bloom intensity** — lowering the threshold to catch dim pixels is what produces neon mush.

**Bloom safety on the amber/yellow magma peak** (it will clip to flat white under additive bloom — erase peak structure):
```glsl
vec3 emissive = surf * (0.55 + 0.45 * tCost);   // less glow in valley, more on peaks
emissive = emissive / (1.0 + emissive);          // soft rolloff before bloom
```

**Cinematic seasoning (each barely perceptible — if you notice one individually, it's too strong):** `<Vignette offset={0.35} darkness={0.55} />`, `<ChromaticAberration offset={[0.0008, 0.0005]} />` (never exceed ~0.003), `<Noise>` at opacity ~0.04 animated per-frame to shimmer.

**Lift the blacks (don't crush to flat):** `scene.background = #0B0E1A`; `scene.fog = FogExp2('#0B0E1A', 0.025)`; faint vertical background gradient top `#0B0E1A` → bottom `#10152B`; shadows lean cool-blue/purple, never `#000`.

### 5.5 The one hero color beat — arrival at the minimum (~700ms)

1. **Approach (last ~1s):** the racing trail's colored halo **bleeds toward cyan `#00D3F2`** regardless of its identity color — the whole field pulled toward "the answer."
2. **Touchdown:** the ball's core flashes **white-hot** (`color={[6,6,4]}`, emissive 3.0 → 5.0 over ~250ms), surrounded by a **cyan `#00D3F2` halo at intensity 2.2**. The only moment anything goes near-white.
3. **Settle / hold:** the beacon relaxes to a steady **cyan** glow (~2.2), and **one single ember-amber `#FFA23A` ring** ignites — a thin ground-projection ring or short upward beam. The *only* place ember appears: cool cyan = "converged/correct," the lone warm beat = "this is the goal."

**Divergence beat (failure):** a runner's halo shifts to **fuchsia `#ED6AFF`** and its core *dims* rather than brightening — the visual opposite of the white-hot cyan arrival.

---

## 6. Rendering — the "HD / rendered" look

### 6.1 Resolution & anti-aliasing

- **DPR:** `Math.min(devicePixelRatio, 2)` (cost is squared in DPR); make it **tier-driven** (Ultra 2 → High 1.75 → Medium 1.25 → Low 1). `PerformanceMonitor` moves the upper bound live.
- **Anti-aliasing: `SMAAEffect` at `SMAAPreset.HIGH` (~95%).** Once `EffectComposer` renders into its HalfFloat offscreen target, hardware MSAA is bypassed; and N8AO (depth-based) forbids MSAA on the composer target anyway. SMAA runs **before** `OutputPass`/tone-mapping (it works in linear-sRGB). Bump to `ULTRA` only at Ultra tier.
- **SSAA/supersampling:** export/screenshot mode only — never during interaction.

### 6.2 Materials & lighting (CGI-crispness)

- **Descent ball (lacquered orb):** `MeshPhysicalMaterial` `roughness=0.3, metalness=0.0, clearcoat=1.0, clearcoatRoughness=0.05, envMapIntensity=1.0`.
- **Cost surface:** `roughness=0.45, metalness=0.1, clearcoat=0.4, clearcoatRoughness=0.2`.
- **HDRI via PMREM is mandatory** for physical materials. drei `<Environment>` (self-host the `.hdr` for production — the `preset` prop uses a dev-only CDN). Dark studio/night HDRI at `environmentIntensity ≈ 0.6`. Keep one key directional light for the shadow.
- **Color textures** (if added): `colorSpace = SRGBColorSpace`; data maps → `NoColorSpace`; `anisotropy = maxAnisotropy` (~16), mipmaps on.

### 6.3 Ambient occlusion & shadows

- **N8AO** (`npm i n8ao`) after the render pass. Scale to our small scene: `aoRadius=0.4`, `distanceFalloff=1.0`, `intensity=3`, `color=(0,0,0)`. `setQualityMode('High')` (64 samples) at Ultra / `'Medium'` (16) at High, **set once at startup** (it recompiles). `halfRes=true` at every tier except Ultra. Camera mostly idle → `accumulate=true`, `denoiseRadius=0` for near-noise-free AO. (GTAOPass is the dep-free stock alternative.)
- **Soft shadows:** drei `<SoftShadows>` (PCSS) `size=25, samples=10, focus=0`, or `<ContactShadows>` as the cheaper grounding option at Medium. `shadow.mapSize=2048` (4096 at Ultra), `PCFSoftShadowMap`, `shadow.bias=-0.0005`, `shadow.normalBias=0.02`.

### 6.4 Surface geometry & color correctness

- **GPU displacement, not CPU rebuilds:** keep a *static* high-res plane (UVs only); displace Y in the **vertex shader** from uniforms, so a live equation change is a uniform update + `invalidate()`, not a ~250k-float re-upload. Compute normals **analytically** in-shader: `normal = normalize(vec3(-df/dx, 1, -df/dz))` (~5× cheaper, exact). **Chain-rule caveat:** raw `dCost/dParam` gradients must be scaled by the mesh-space Jacobian (`HEIGHT_SCALE · paramRange/surfaceSize` per axis) before use as slopes, or lighting normals are wrong.
- **In-shader contours + wireframe** via `fwidth()` for pixel-consistent anti-aliased iso-bands; animate by subtracting `uTime` from the height coord (replaces separate contour/wireframe meshes).
- **Tessellation:** 128 segments Ultra → 64 High → 48 Medium → 24–32 Low; smooth normals to avoid faceting.
- **Color management:** `ColorManagement.enabled = true`, `outputColorSpace = SRGBColorSpace` (r152+ defaults). **`material.dithering = true`** on the surface and the background gradient (cheapest fix for 8-bit banding, which our smooth ramp will exhibit). Keep the composer at `HalfFloatType` so HDR gradients survive tone mapping without posterizing.

### 6.5 Path rendering

Replace stacked `<Line>` layers with a single `TubeGeometry` + `u_progress` uniform: reveal via `smoothstep` on a baked arc-length attribute, with a traveling emissive band — one draw call, frame-rate-independent reveal. drei `<Trail>` (MeshLine) on the live ball for the ribbon.

### 6.6 Motion ("juice")

Expressive easing curves (not linear) and GSAP-style orchestration. The hero arrival beat (§5.5) is the one orchestrated moment: bloom flare, DOF rack-focus, vignette pulse, `easeOutBack`/elastic settle.

---

## 7. The Ambient Swarm

### 7.1 Technique — stateless, not ping-pong

Each particle's position is a **pure function of `(seed, uTime)`** evaluated in the vertex shader. **Zero simulation textures, zero render targets, ~0.3ms CPU/frame**, one draw call for 65k particles. This is the single biggest cost win — the swarm is *not* what threatens 60fps; overdraw and the post-stack are.

```
life   = mod(uTime * aSpeed + aSeed, uLifetime) / uLifetime;   // 0..1
spawn  = ridgePosition(aSeed);                                  // high-cost edge by seed
pos.xz = spawn.xz + flowOffset(spawn, life);                    // streamed downhill
pos.y  = surfaceHeight(pos.xz) + 0.08;                          // sit just above surface
alpha  = sin(life * PI);                                        // fade in/out
```

**Ping-pong FBO is reserved only for Ultra-tier "semantic agents"** (≤2,048) that need memory — momentum integration, surface collision, respawn with accumulated velocity — via `GPUComputationRenderer` or drei `useFBO` + `createPortal`. Pack `pos.xyz + life` into one `RGBA16F` texture (`RGBAFormat` not `RGBFormat` — Intel-mobile compat; `NearestFilter`, `ClampToEdge`).

### 7.2 Flow field — precomputed, not analytic

Analytic curl noise is 18 simplex evaluations/particle/frame — it dominates at 65k. Instead, **bake once** at mount: a single **256×256 `RGBA16F` DataTexture** over the `(w,b)` domain storing `RG = normalized(−∇J)` (descent direction), `B = gradient magnitude` (drives speed), `A = baked curl scalar` (swirl). One `texture2D` fetch replaces all the noise. The field is static (the loss surface doesn't move) — never re-bake; animate the swirl with one cheap in-shader `sin`/`hash` term if breathing is wanted.

### 7.3 Behavior (the motion *is* the lesson)

Motes advance along `−∇J` (slide downhill into the bowl), step speed scaled by gradient magnitude (**fast on steep walls, crawl near the flat minimum**), with a small perpendicular curl swirl so flow isn't sterile. On `life` wrap, re-seed at a high-cost ridge — the cloud continuously rains down the slopes and pools, glowing, at the cyan minimum beacon.

### 7.4 Fill-rate rules (what actually protects 60fps)

- **`gl_PointSize` 1–3px** for ambient dust, size-attenuated: `clamp(uSize * (1.0/-mvPosition.z), 1.0, 3.0)`, `uSize ≈ 16·pixelRatio`. **Never** large overlapping additive sprites.
- **`AdditiveBlending`** (also removes depth-sort need), **`depthWrite: false`**, `depthTest: true`.
- **Soft circular sprite via alpha math, no texture fetch:** `float s = pow(1.0 - distance(gl_PointCoord, vec2(0.5)), 3.0);`
- Cap `pixelRatio` at 1.5 for the particle pass on laptops (overdraw scales with DPR²).

### 7.5 Decision — ON by default, auto-tiered

The swarm ships **on by default** and scales by tier, not on/off. It's GPU-trivial and reinforces the core message (streaming downhill *is* gradient descent — disabling it removes a teaching signal). Particle counts per tier in §9. Only the no-WebGL fallback drops it to 0.

---

## 8. Architecture

### 8.1 Stack

| Layer | Choice |
|---|---|
| Render core | **React Three Fiber** (R3F *is* Three.js — `<mesh/>` → `new THREE.Mesh()`; every Three.js feature available, zero rendering-ceiling loss) |
| Versions | fiber 9.6.x · React 19 · drei 10.x · @react-three/postprocessing 3.x · three ~0.184 · zustand 5 |
| Helpers | drei, @react-three/postprocessing, `postprocessing`, `n8ao`, `@pmndrs/detect-gpu` |
| Math | mathjs (parse only) + custom dual-number autodiff |
| 2D UI | Tailwind + shadcn/ui (Radix), custom glassmorphic HUD, KaTeX, uPlot, driver.js, lucide-react |
| Build | Vite + TypeScript |
| Test | Vitest + @react-three/test-renderer (logic) · Playwright (real-GPU visual/perf smoke) |

> **Why not vanilla or hybrid:** R3F gives the full Three.js ceiling *plus* the drei/postprocessing/leva/zustand ecosystem and built-in adaptive-performance tooling. A hybrid (vanilla core + React overlay) only pays off when preserving a large existing vanilla engine — this is greenfield, so it would add a manual bridge for no gain. `@react-three/postprocessing` v3 requires React 19, making the version upgrade a prerequisite for the modern post-stack.

### 8.2 The two-channel state rule (protects the frame budget)

- **Channel A (slow / UI) — Zustand reactive selectors:** play/pause, learning rate, function choice, optimizer set, camera presets, tier. May trigger React re-renders. Changes rarely.
- **Channel B (fast / sim) — refs + `useFrame`:** optimizer per-step position/gradient/loss read transiently via `getState()`/`subscribe()` into refs; mutate 3D objects **directly in `useFrame`**. **Never `setState` per frame.** Re-pool objects (`vec.set()`), use `delta`, share geometries/materials via `useMemo`, toggle `visible` over mount/unmount, instance everything, keep draw calls in the hundreds.

### 8.3 Simulation loop

Fixed-timestep accumulator inside one `useFrame` (deterministic, refresh-rate independent), interpolate render between solver steps. `frameloop={isPlaying ? 'always' : 'demand'}`; `invalidate()` on any external state change while in demand. Gate the follow-camera `useFrame` so it doesn't force `always` when idle.

### 8.4 Module boundaries (each independently testable)

- **`engine/`** — pure TS, no React/Three: cost-function registry, autodiff, optimizer implementations, simulation stepper. Fully unit-testable in isolation.
- **`scene/`** — R3F components: surface, ball(s), trails, swarm, beacon, lights, environment, post-stack.
- **`state/`** — Zustand stores (UI channel) + the ref-based sim bridge.
- **`ui/`** — HUD, controls, KaTeX panel, scrubber, loss chart, presets, onboarding.
- **`quality/`** — tier detection, PerformanceMonitor wiring, the tier→settings map.

---

## 9. Performance Budget & Adaptive Quality

### 9.1 Tier ladder

| | DPR | Surface (seg) | Ambient particles | Semantic agents | Shadow map | Post-effects | Bloom |
|---|---|---|---|---|---|---|---|
| **Ultra** | 2.0 | 128 | 65,536 | 2,048 (GPGPU) | 4096 | N8AO(High,full) + DOF + Bloom + SMAA(ULTRA) + vignette/grain | mipmapBlur, LARGE, full res |
| **High** | 1.75 | 64 | 30,000 | 512 (instanced) | 2048 | N8AO(Med,½) + DOF(½) + Bloom + SMAA(HIGH) + vignette/grain | MEDIUM |
| **Medium** | 1.25 | 48 | 12,000 | 128 (CPU) | 1024 | **DOF off** → Bloom(SMALL,0.5×) + vignette/grain; N8AO(Low,½) or off | SMALL, 0.5× |
| **Low** | 1.0 | 24–32 | 3,000 | 0 | off | **No EffectComposer** — emissive-mesh fake glow | fake |
| **Fallback** | — | — | 0 | — | — | Don't mount Canvas — WebGL error fallback | — |

### 9.2 Drop order under strain (strict, by cost)

**N8AO/SSAO dies first** (heaviest — convolution + multi-sample depth) → **DOF** → reduce **Bloom** kernel/resolution before disabling → **DPR** → **particle count** → **surface segments**. **Never** cut vignette/grain/tone-map — pmndrs merges all non-convolution fragment effects into a single `EffectPass`, effectively free. The swarm only *thins* (never blinks out) down to the 3,000 floor.

### 9.3 Initial tier detection

Run `@pmndrs/detect-gpu` **once before mounting Canvas**:
```js
const { tier, isMobile, type } = await getGPUTier({ glContext });
const start =
  type === 'WEBGL_UNSUPPORTED' || tier === 0 ? 'fallback'
  : isMobile || navigator.hardwareConcurrency < 4 ? 'low'
  : tier >= 3 ? (navigator.hardwareConcurrency >= 8 ? 'ultra' : 'high')
  : tier === 2 ? 'medium'
  : 'low';
```
**Self-host `benchmarks.tar.gz`** (the public CDN can be CSP-blocked); on fetch failure default to Medium and let PerformanceMonitor correct upward.

### 9.4 Live auto-scaling

drei `<PerformanceMonitor>` driving both dpr and tier — **set `bounds` explicitly** (the documented default is stale; real default never inclines on 60–100Hz panels):
```jsx
<PerformanceMonitor
  bounds={(r) => (r > 90 ? [55, 90] : [45, 58])}
  flipflops={3}
  onChange={({ factor }) => { setDpr(round(0.75 + 1.25 * factor, 2)); setTier(...); }}
  onFallback={() => { setDpr(1); setTier('low'); }}>
  <AdaptiveDpr pixelated />
  <AdaptiveEvents />
</PerformanceMonitor>
```
`regress()` + `invalidate()` fire automatically on OrbitControls interaction. Keep adaptation **out of the React render path** — mutate dpr via `setDpr`, read `performance.current` in `useFrame`; tier is the only thing in `setState`.

### 9.5 Frame-budget allocation (High tier, ~16.6ms target, aim ~10–12ms GPU)

| Subsystem | Budget |
|---|---|
| Surface shader + scene draw | 3–4ms |
| Shadows (2048 map) | ~2ms |
| Ambient swarm (sim + draw) | ~1–2ms |
| Bloom (mip-chain) | 1.5–2ms |
| DOF | 2–3ms |
| N8AO half-res | 1.5–2.5ms |
| Fragment effects (merged) | <0.5ms |

---

## 10. Accessibility

- **Colormap honesty:** cividis "Study mode" is colorblind-safe; turbo carries an explicit "not colorblind-safe" tooltip.
- **Text contrast:** all text tokens meet WCAG AA on their intended surfaces (§5.1); never body text on saturated fills.
- **KaTeX** emits `htmlAndMathml` for screen readers.
- **Controls** built on Radix primitives (keyboard nav, focus management, ARIA) where used.
- **Reduced motion:** honor `prefers-reduced-motion` — damp camera orchestration, swarm, and the hero beat.
- **Keyboard:** play/pause, step, reset, mode switch reachable without a mouse.

---

## 11. Milestones (phased — always shippable)

| Milestone | Delivers | Exit criteria |
|---|---|---|
| **M0 — Foundation** | Modern R3F stack upgrade; Zustand two-channel architecture; `engine/` (cost-function registry, dual-number autodiff, 9 optimizers, fixed-timestep stepper); preset functions; Vitest harness with gradient-vs-finite-difference validation | All optimizers + autodiff pass numerical tests; empty scene renders; CI green |
| **M1 — The Stunning Core** | HD cinematic single-descent on presets: GPU-displaced magma surface shader + analytic normals + in-shader contours; full AGX/HalfFloat post-stack (selective bloom, N8AO, DOF, SMAA, grade); PMREM HDRI + physical materials + soft shadows; stateless ambient swarm + baked flow field; iteration scrubber; live KaTeX; uPlot loss chart; adaptive tier system; the hero arrival beat | 60fps at High tier on desktop; graceful Low tier; the "wow" is demoable |
| **M2 — Racing & Full Suite** | Multi-optimizer racing mode; shared-start; color-coded trails + live leaderboard; internal-state viz (velocity arrows, accumulator squares); divergence drama | N optimizers race smoothly on one surface; leaderboard syncs with chart |
| **M3 — Deep Interactivity** | Live custom `f(x,y)` editor (KaTeX-rendered, autodiff gradients, robustness guards); presets gallery; driver.js onboarding; Study/Spectacle mode toggle; mobile drawer UI | Arbitrary valid `f(x,y)` renders + descends with exact gradients; tour works |
| **M4 — Closing the Loop** | Conceptual NN-bridge panel; real 2-param ML loss surface; export/screenshot (SSAA) mode; polish pass | ML surface descends as a real objective; screenshot mode produces hi-res stills |

> **Deferred to a future milestone (explicit non-goal for v1):** the Goldstein filter-normalized 2D slice of a real trained neural net; audio; share-by-URL state.

---

## 12. Success Metrics

- **Performance:** sustained 60fps at the detected tier on target hardware; no `setState`-in-frame regressions; cold load to interactive < 3s on desktop broadband.
- **Correctness:** 100% of optimizers and the autodiff layer pass gradient-vs-finite-difference tests to ~1e-6; Rosenbrock gradient is `[0,0]` at (1,1).
- **Teaching:** a first-time user can, unaided, (a) see why a too-large learning rate diverges, (b) see why momentum overshoots, (c) see why Adam adapts where AdaGrad stalls — via presets + racing.
- **Showpiece:** the hero beat and racing mode read as portfolio-grade in a 10-second glance; screenshot mode produces shareable stills.
- **Robustness:** no scene-breaking crash from any user-entered equation (non-finite values are caught and surfaced as UI errors).

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Maximal scope → never ships | Phased milestones; M1 alone is a complete, stunning product |
| Post-stack blows the frame budget | Strict drop order (§9.2); swarm is cheap by design; tier detection + live PerformanceMonitor |
| Custom equations break the renderer | Non-finite guards, clamp/early-stop, UI error surface; parse-and-compile once |
| Newton diverges confusingly | Explicit "diverges/seeks saddles on non-convex" UI warnings — framed as a teaching point |
| Magma amber peak clips under bloom | Soft emissive rolloff before additive accumulation (§5.4) |
| Banding on the dark gradient surface | `material.dithering = true` + HalfFloat composer |
| detect-gpu CDN blocked by CSP | Self-host benchmarks; default Medium on fetch failure, correct upward live |
| R3F v9 / React 19 migration friction | Treat the version upgrade as M0 step one; `extend()` registration; drei 10 ↔ fiber 9 pairing |

---

## Appendix A — Source references (fact-checked, 0 refuted)

- Color management & tone mapping: [three.js color-management](https://threejs.org/docs/#manual/en/introduction/Color-management), [glsl-tone-map](https://github.com/dmnsgn/glsl-tone-map)
- Colormaps: [Kenneth Moreland color advice](https://www.kennethmoreland.com/color-advice/), [BIDS colormaps](https://bids.github.io/colormap/), [glslify/glsl-colormap](https://github.com/glslify/glsl-colormap), [Turbo gist](https://gist.github.com/mikhailov-work/0d177465a8151eb6ede1768d51d476c7)
- Palette/OKLCH: [evilmartians OKLCH](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl), [Material dark theme](https://m2.material.io/design/color/dark-theme), [WebAIM contrast](https://webaim.org/articles/contrast/)
- Postprocessing: [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing), [react-postprocessing docs](https://react-postprocessing.docs.pmnd.rs/), [N8AO](https://github.com/N8python/n8ao), [effect merging](https://github.com/pmndrs/postprocessing/wiki/Effect-Merging)
- Particles/GPGPU: [Maxime Heckel — magical world of particles](https://blog.maximeheckel.com/posts/the-magical-world-of-particles-with-react-three-fiber-and-shaders/), [barradeau GPGPU](http://barradeau.com/blog/?p=621), [GPUComputationRenderer](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/misc/GPUComputationRenderer.js), [miketuritzin particle overdraw](https://miketuritzin.com/post/rendering-particles-with-compute-shaders/)
- Performance: [R3F scaling-performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [drei PerformanceMonitor](https://drei.docs.pmnd.rs/performances/performance-monitor), [detect-gpu](https://github.com/pmndrs/detect-gpu)
- Math/optimizers: [Ruder — overview of gradient descent](https://www.ruder.io/optimizing-gradient-descent/), [mathjs](https://mathjs.org/), [optimization test functions](https://en.wikipedia.org/wiki/Test_functions_for_optimization)
- Prior art: [Distill momentum](https://distill.pub/2017/momentum/), [losslandscape.com](https://losslandscape.com/), [lilipads](https://github.com/lilipads/gradient_descent_viz), [Ben Frederickson numerical optimization](https://www.benfrederickson.com/numerical-optimization/), [tomgoldstein/loss-landscape](https://github.com/tomgoldstein/loss-landscape), [3Blue1Brown gradient descent](https://www.3blue1brown.com/lessons/gradient-descent)
- Explorable explanations / UX: [Bret Victor](https://worrydream.com/ExplorableExplanations/), [TF Playground](https://playground.tensorflow.org/), [uPlot](https://github.com/leeoniya/uPlot), [driver.js](https://driverjs.com/), [KaTeX](https://katex.org/)

## Appendix B — Decision log

| Decision | Choice | Date |
|---|---|---|
| Purpose | Teaching tool + showpiece (co-equal) | 2026-06-11 |
| Tech stack | React Three Fiber (modern: fiber 9 / React 19 / drei 10 / postprocessing 3 / three ~0.184 / zustand 5) | 2026-06-11 |
| Hero feature | Both — cinematic descent + optimizer racing | 2026-06-11 |
| Optimizers | Full suite of 9 incl. Newton | 2026-06-11 |
| Landscapes | Presets + live custom f(x,y) + real ML loss | 2026-06-11 |
| Audience | Both, desktop-first (graceful mobile) | 2026-06-11 |
| Aesthetic | Cinematic Dark (magma surface, cyan/indigo/ember) | 2026-06-11 |
| Audio | None in v1 | 2026-06-11 |
| Ambient swarm | Stateless GPU swarm, on by default, auto-tiered | 2026-06-11 |
| HD render | SMAA + N8AO + PMREM + physical materials + soft shadows + dithering | 2026-06-11 |
| NN bridge | Conceptual panel + real ML loss surface | 2026-06-11 |
| Build sequencing | Phased milestones (M0–M4), always shippable | 2026-06-11 |
