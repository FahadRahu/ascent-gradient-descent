# AGENTS.md — working instructions for AI coding agents

This file is the standing set of conventions for any AI agent (Codex, Claude, etc.)
working in this repository. Follow it on every task unless the user's explicit
instructions for a specific task override it.

For product context and a full feature/architecture overview, read `README.md`
first — this file does not duplicate it.

## What this project is

ASCENT: an interactive 3D gradient-descent visualization. React 19 + TypeScript,
React-Three-Fiber (Three.js) for the WebGL scene, Vite build, Zustand state,
Tailwind for styling tokens. It is a **public** GitHub repo, deployed to Vercel.
It is both a teaching tool and a portfolio piece — correctness and visual polish
both matter.

## Git & PR workflow (required)

- **Never commit directly to `main`.** `main` is branch-protected: pull requests
  are required, the `build-and-test` CI check must pass, and branches must be up
  to date with `main` before merging.
- **Branch per unit of work.** Create a feature branch off the latest `main`
  (e.g. `feat/…`, `fix/…`, `ci/…`, `docs/…`). Keep each branch focused on one
  logical change so its PR is small and reviewable.
- **Open a PR and stop for human review.** Do not self-merge. In the PR
  description, state what changed, why, and exactly what the reviewer should test
  manually (especially on mobile for UI work).
- If a branch falls behind `main`, merge `main` into it (or rebase) and re-push so
  CI re-runs on the combined result before merging.
- Do not force-push shared branches or delete branches you did not create.

## Build, test, and the release gate

Run the relevant checks before declaring any task done. The full release gate:

```sh
npm run typecheck        # tsc --noEmit
npm test                 # Vitest unit/component tests
npm run build            # tsc -b && vite build
npm run check:bundle     # compressed bundle budget
npm run test:e2e         # Playwright (Chromium + WebKit) — for UI/layout changes
```

- `npm run test:ops`, `npm run coverage`, and `npm run test:performance` exist too;
  run them when your change touches deployment config, coverage-tracked code, or
  mobile load performance respectively.
- CI (`.github/workflows/ci.yml`, job `build-and-test`) runs the audit, typecheck,
  tests, coverage, build, bundle budget, e2e, and the mobile slow-4G SLO. Assume a
  PR is not mergeable until that job is green.
- First-time Playwright setup: `npx playwright install chromium webkit`.

## Architecture rules that bite

- **Two-channel Zustand state — do not violate this.** Channel A (`src/state/uiStore.ts`)
  holds slow, reactive UI config (function, optimizer, learning rate, play state);
  it may trigger React re-renders and changes rarely. Channel B (`src/state/simStore.ts`,
  a vanilla store) holds per-frame simulation state (theta, iteration, cost) and is
  read/written imperatively inside the render loop — it must **never** trigger React
  re-renders. Per-frame values belong in Channel B; never route them through Channel A.
- **The engine is pure and separate from the scene/UI.** `src/engine/` (objective
  functions, autodiff, optimizers, stepper) has no React/Three dependencies. Keep it
  that way; add unit tests for engine changes.
- **The stepper keeps a bounded ring buffer** of `{iteration, theta, cost}`
  (`src/engine/stepper.ts`) — this is the history the scrubber reads. Per-step
  optimizer internals are returned as `StepResult.aux` and currently discarded.
- **Dark theme only.** No light theme or theme toggle.
- **Styling:** the real design tokens live as CSS custom properties in
  `src/styles/globals.css`. Prefer those tokens (or the Tailwind aliases that map to
  them) over hardcoded colors. Numeric readouts use `tabular-nums`.
- Match existing conventions in the file you're editing (naming, comment density,
  idiom). Read neighboring code before adding new patterns.

## Active plans (build order)

Two planning docs live in `ideas/`:

1. **`ideas/ui-mobile-scrubber-plan.md`** — the **active** project: a UI/UX overhaul
   + mobile support + a lightweight iteration scrubber, in Phases 0–6. This is the
   authoritative plan. Build its phases **one at a time, in order**, each as its own
   branch/PR with a human review between phases. Design checkpoints (screenshot
   review) come after Phases 1, 3, and 6.
2. **`ideas/step-inspector-iteration-scrubber.md`** — a **future** project (the full
   per-optimizer step inspector + visual overlays), with ~18 unresolved open
   questions. Do **not** build it until the plan above is complete. It overlaps the
   active plan only at "the scrubber," where the active plan builds the lightweight
   version the inspector will later extend.

Do not start a new phase or project without the user's go-ahead.

## Scope discipline

- Do only what the current task asks. Don't bundle unrelated refactors into a PR.
- If the plan or a task conflicts with what the code actually does, surface it and
  ask before proceeding — don't silently "fix" the plan or the code.
- Prefer reusing existing utilities over adding new ones; search first.
