<!--
==============================================================================
DOCUMENT MAP — how to use these two docs (read first)
==============================================================================
This file is the AUTHORITATIVE PLAN for PHASE 1:
  UI/UX overhaul + mobile support + the LIGHTWEIGHT iteration scrubber.
It is what was researched, mocked up, and approved. Build this first.

The FULL per-optimizer step inspector + visual optimizer-state overlays are
OUT OF SCOPE here. They are the PHASE 2 vision, specified in the sibling doc:
  ./step-inspector-iteration-scrubber.md
That doc still has ~18 open product questions that must be resolved before it
is implemented. Do NOT conflate the lightweight scrubber (in scope below —
scrub/step/speed over existing history) with the full inspector (Phase 2 —
per-step optimizer internals + overlays).

FOR CODEX / ANY IMPLEMENTER — build order:
  1. Execute the 6 phases in THIS document first (UI/mobile + lightweight scrubber).
  2. Only then treat step-inspector-iteration-scrubber.md as the deep-dive spec
     for the inspector, resolving its open questions first.

VERIFIED TECHNICAL SUBSTRATE (from the exploration behind this plan — reuse, don't rediscover):
  - The engine already keeps a bounded ring buffer of {iteration, theta, cost}
    in src/engine/stepper.ts. The lightweight scrubber reads this directly —
    NO engine data-model change needed.
  - Per-step optimizer internals (gradient, velocity, Adam moments, etc.) are
    computed every step as StepResult.aux and then DISCARDED. Persisting aux is
    the key enabler for the Phase 2 inspector — not needed for Phase 1.
  - Two-channel Zustand rule (follow strictly): Channel A = uiStore (reactive,
    rare updates, may re-render); Channel B = simStore (per-frame, imperative,
    must NEVER trigger React re-renders). Scrubber config is Channel A.
==============================================================================
-->

# ASCENT — UI/UX Overhaul, Mobile Support & Iteration Scrubber

## Context

ASCENT is a polished 3D gradient-descent visualization (React 19 + TypeScript + React-Three-Fiber, Vite, Zustand). It teaches how 9 optimizers descend 9 cost surfaces, and doubles as a portfolio showpiece. It is live on Vercel.

This effort addresses three things the app needs before it reads as a finished, credible product:

1. **Mobile is not genuinely right.** The app already has a responsive CSS layer, but the production-readiness audit (`docs/production-readiness-audit-2026-07-20.md`) confirmed phone panels **overlap by up to 127px** (PR-002), 3D labels clip/collide (PR-005), and mobile hides teaching content (`display:none` on the formula, concept steps, and legend) rather than reorganizing it — so phone users lose the pedagogy.
2. **The UI can feel "assembled" rather than crafted.** Tailwind is installed but unused; the real styling is 1,849 lines of hand-written CSS with its own CSS-variable tokens, plus a *second, unsynced* Tailwind palette (a generic violet/Inter theme — the textbook "AI-generated" tell). Readouts don't use tabular figures, so numbers jitter.
3. **The single biggest missing affordance** — per the original PRD, an **iteration scrubber** to scrub back/forth through optimizer steps — was designed (M1 spec §5.8, the never-built M1c cycle) but never implemented. The substrate exists: the engine already keeps a bounded ring buffer of history.

**Intended outcome:** a mobile experience genuinely designed for a canvas-plus-controls teaching tool; a single, intentional design system; the lightweight scrubber; and a polish pass that removes "vibecoded" tells — while keeping the 3D scene the hero.

## Locked decisions (from brainstorming)

- **Scope:** UI/UX + mobile + **lightweight** iteration scrubber. The full per-optimizer *step inspector* (momentum/Adam-moment vectors for past steps) and visual optimizer-state overlays from `ideas/step-inspector-iteration-scrubber.md` are **out of scope**.
- **Theme:** dark-only (no light theme, no toggle).
- **CSS foundation:** migrate to Tailwind, **incrementally, component-by-component** — set up the token system first, migrate each component's CSS to utilities as it's reworked, delete old CSS per-component. Port the app's **real** cyan/amber/fuchsia palette into the Tailwind theme; **discard** the generic violet/indigo + Inter aspirational palette.
- **Mobile layout (approved via mockup):** one coordinated layout that **separates the visualization region from the controls region** (no more floating overlap).
  - **Portrait:** scene fills the top (~60%); a fixed bottom panel with **tabs** (Setup / Signal / Playback / Learn) and a **persistent Run/Step/Restart transport that stays visible under every tab**.
  - **Landscape:** scene left (~56%), controls in a **right-hand side column** (~44%) with the same tabs + persistent transport at its base.
- **Guided run:** opt-in **coach-marks tour** triggered by a button — **never** auto-shown on first load.
- **Scrubber (approved via mockup):** step-based (not a video seek-bar). Big **Prev/Next** buttons are the precise control; a discrete slider is a coarse overview labelled as the "retained window"; speed control (0.5–4×); a **Review-mode** badge when scrubbed off latest; full keyboard map; `role=slider` with spoken `aria-valuetext`, transport as plain `<button>`s.
- **Audit fixes folded in:** PR-001 (false convergence flash), PR-003 (stale loss summary), PR-004 (mobile load speed), PR-005 (3D label clipping). PR-002 (overlap) is resolved by construction via the new layout.

## Out of scope (deferred, not dropped)

Full step inspector & optimizer-state overlays; light theme; migrating the loss chart to uPlot or formulas to KaTeX (the existing Canvas 2D chart and HTML formula are kept — swapping them is unrequested churn); custom `f(x,y)` editor; multi-run/racing; export/share.

## Approach — phased, always-shippable

The migration is incremental so the app stays deployable after every phase. Desktop parity is preserved throughout; mobile is where the visible gains land.

### Phase 0 — Design-system foundation (Tailwind tokens)
Establish the single token system before touching components.
- Rewrite `tailwind.config.js`: replace the generic `primary`(violet)/`accent`/Inter theme with the **real** palette from `src/styles/globals.css:5-24` (void/panel/border/text/muted/cyan/amber/fuchsia/focus + chart tokens) as semantic Tailwind colors. Keep the system-UI font stack + `Cascadia Mono` for numerics (do **not** add Inter — it's a generic tell). Define the spacing scale (4/8/12/16/24/32/48/64), a 4–6 step type scale, and a small radius scale.
- Add a `tabular-nums` utility/base rule and plan to apply it to every changing numeric readout.
- Keep `globals.css` in place for now; components migrate off it per-phase. New components are Tailwind-native.
- Critical files: `tailwind.config.js`, `src/styles/globals.css` (tokens section).

### Phase 1 — Responsive layout architecture
Build the coordinated layout that separates scene from controls; this resolves PR-002 by construction.
- Restructure the HUD in `src/ui/Hud.tsx` from four absolutely-positioned regions into a responsive shell: desktop keeps today's floating panels; mobile (portrait & landscape) uses the approved grid — scene region + a tabbed control region + persistent transport.
- Introduce a small **tab system** component (Setup / Signal / Playback / Learn) and a **persistent transport** component extracted from the current `.transport` block (`Hud.tsx:599-647`). The transport renders once, outside the tab content, on all breakpoints.
- Ensure the scene container has an explicit sized box so R3F's `<Canvas>` ResizeObserver resizes the renderer/camera correctly when it shares space with the panel (verify no canvas overflow — the known failure mode for canvas-beside-panel).
- Rework the mobile media queries in `src/styles/globals.css:1369-1837` to the new model; delete the `display:none` teaching-content hides (that content moves to the Learn tab in Phase 2).
- Critical files: `src/ui/Hud.tsx`, `src/App.tsx` (`.app-shell`/`.scene-layer` sizing), `src/styles/globals.css`.

### Phase 2 — Mobile teaching depth (the Learn tab)
Give the pedagogy a real home on mobile instead of hiding it.
- Move the concept explainer, height/cost cue, the update-rule formula, the "every iteration" loop, and the scene legend (currently in `.concept-panel`, `Hud.tsx:399-490`) into a **Learn tab** so phone users get the full teaching content. Desktop keeps showing them in the concept panel.
- Audit for truncated strings / cramped labels the user flagged; ensure text wraps or resizes rather than clipping. Reflow, don't hide.

### Phase 3 — Iteration scrubber (the Playback tab)
The one new interactive feature. Reads the existing ring buffer; no engine data-model change.
- **State (Channel A):** add `mode: 'live' | 'review'`, `scrubIndex`, `playbackSpeedMs` to `src/state/uiStore.ts` (+ actions). This is exactly the shape the M1 spec §5.8 specified.
- **Runner:** in `src/scene/useSimRunner.ts`, when `mode==='review'`, drive `frameloop` to `'demand'`, read `history[scrubIndex]` from the ring buffer (`getSimRunnerHandle()`), write theta/iteration/cost into `simStore`, call `invalidate()`. Playback speed replaces the hardcoded `SIM_DT` cadence during timed playback (presentation-only; does not change the numeric sequence).
- **Consumers read the selected index:** `LiveSignal`, `LossChart`, `DescentBall`/`DescentPath` currently assume `history[last]` = current; in review mode they read the selected entry. The "Signal" tab shows cost/gradient/position for the scrubbed step.
- **UI:** new `Scrubber` component in `src/ui/` — transport (first / −10 / prev / play / next / +10 / latest), discrete `step=1` slider driven off `history[i].iteration` (honest "retained window" labelling, never a 0..N lie over a capped buffer), speed selector, cost readout, Review-mode badge. Pointer Events + `setPointerCapture`, `touch-action:pan-y` on the track, ≥44px targets. Keyboard: Space, ←/→, Shift+←/→, Home/End. `role=slider` + `aria-valuetext="Step N of M, cost X"`; transport are plain buttons.
- Critical files: `src/state/uiStore.ts`, `src/scene/useSimRunner.ts`, `src/ui/Hud.tsx`, new `src/ui/Scrubber.tsx`, `src/ui/LossChart.tsx`, `src/ui/costFeedback.ts` (reuse `classifyCostStep`).

### Phase 4 — Guided run (opt-in coach-marks tour)
- Add a "Guided run" button (not auto-shown). On press, run a coach-marks tour that points at each control (landscape, optimizer, learning rate, transport, scrubber) and advances on tap. Recommend **driver.js** (lightweight, anticipated in the PRD); a minimal custom overlay is the fallback if a dependency is unwanted.
- Persist "seen" state so it's never nagging. Respect `prefers-reduced-motion`.

### Phase 5 — Audit correctness fixes
- **PR-001** false convergence: pass optimizer iteration/`runId` into the arrival tracker; only advance on iteration change; reset on run change. Files: `src/scene/heroTrigger.ts`, `src/scene/HeroBeat.tsx`, `src/scene/useSimRunner.ts`. Add the refresh-rate regression tests the audit specifies (60/90/120/144Hz).
- **PR-003** stale loss summary: track both `runId` and iteration when deciding to refresh accessible history. Files: `src/ui/LossChart.tsx`, `src/state/simHistory.ts`.
- **PR-005** 3D label clipping: clamp/offset/hide `Current point`/`Goal` labels on constrained viewports and add collision behaviour near the goal. Files: `src/scene/DescentBall.tsx`, `src/scene/OptimizationCues.tsx`.
- **PR-004** mobile load: profile the scene chunk, defer/trim unused Three.js/postprocessing, evaluate a smaller HDR asset, make controls usable before all scene resources load. Measure against a documented SLO.

### Phase 6 — Anti-"vibecoded" polish pass
Apply the researched checklist across the migrated UI.
- `tabular-nums` on every changing number (loss, gradient, position, iteration, learning rate).
- One accent that encodes meaning (cyan=current, amber=goal) — no decorative neon glow; hairline borders over heavy shadows; consistent radius scale; no pure `#000/#fff/#808080` (tint neutrals with the panel hue, already true).
- **Six states per interactive control**: default/hover/focus(visible ring)/active/disabled/loading.
- **Microcopy audit**: remove any marketing diction / Title Case; every label states what the control does. Design empty/loading/error states (the WebGL-unavailable card already exists — extend the pattern).
- Delete the now-unused generic Tailwind palette remnants and any dead CSS.

## Verification

- **Unit (Vitest):** scrubber state transitions (live↔review, index clamping to retained window, speed), PR-001 tracker (repeated frames don't converge; 20 real low-delta iterations still can; run change resets; 60/90/120/144Hz), PR-003 (function/optimizer/lr/start change and restart at iter 0 refresh the summary).
- **E2E (Playwright, Chromium + WebKit):** extend `e2e/app.spec.ts` responsive matrix (320×568, 375×667, 430×932, 768×1024, 812×375) with **bounding-box no-overlap assertions** for scene/tabs/transport in both orientations and both initial & post-interaction heights; scrubber keyboard + prev/next; axe pass. Keep `e2e/performance.spec.ts` mobile SLO green.
- **Live browser (Playwright MCP) on real GPU:** screenshots at each breakpoint; **verify the OrbitControls-vs-panel touch behaviour on real iOS Safari** (the documented R3F gesture-conflict risk) — canvas `touch-action:none`, panel scroll isolated; confirm no canvas overflow when scene shares space with the panel.
- **Design checkpoints:** screenshot review with the user after Phase 1 (layout), Phase 3 (scrubber), and Phase 6 (polish).
- **Release gate:** `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundle`, `npm run test:e2e` all green before shipping.

## Notes for execution
- Follow the two-channel Zustand rule strictly: scrubber config is Channel A (`uiStore`); per-frame values stay Channel B (`simStore`) and must never trigger React renders.
- Keep every phase committable and the app deployable; desktop must not regress while mobile improves.
- The `ideas/step-inspector-iteration-scrubber.md` doc's MR-01–13 (mobile) and AR-01–12 (accessibility) are a ready-made requirements checklist for Phases 1–3 even though the full inspector is out of scope.
