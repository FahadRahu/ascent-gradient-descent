# ASCENT Production Readiness Audit Handoff

Audit date: 2026-07-20

## Verdict

ASCENT is **not ready for a public responsive production release**.

A controlled desktop beta is defensible, but the confirmed educational
correctness defects and mobile layout failure should be fixed before a general
release.

Release blockers:

1. Render frames can falsely trigger the convergence choreography.
2. The concept and control panels overlap on common phone sizes.
3. The accessible loss summary can report data from the previous landscape.

## Repository State

- Repository: `gradient-descent-app`
- Baseline commit: `0deac233865833226c547b20dff8b8f5d513c3e0`
- Audited dirty-worktree snapshot:
  `codex-security-snapshot/v1:sha256:69bdfe15a019d4a588fcaabbc1be56265088512d331aedd0ce35eba660d10759`
- The worktree had 33 modified or untracked entries when the audit ended.
- The audit did not change application source.

Do not reset, restore, or otherwise discard the existing worktree changes. They
predate this handoff and must be reviewed as user-owned work.

## Findings

### PR-001: Render frames can falsely signal convergence

Priority: P1

Status: Confirmed by direct reproduction

Affected code:

- `src/scene/heroTrigger.ts:61-63`
- `src/scene/HeroBeat.tsx:84-98`
- `src/scene/useSimRunner.ts:29`

`heroTrigger.ts` describes `SUSTAIN` as consecutive optimizer steps, but
`HeroBeat` evaluates and increments the counter on every render frame.
Simulation cost is updated only every 250 ms (`SIM_DT = 1 / 4`).

Using the checked-out implementation with a point far from the Sphere minimum:

| Refresh rate | First false arrival | Before optimizer update |
| --- | ---: | --- |
| 60 Hz | None | Yes |
| 90 Hz | 233.33 ms, frame 21 | Yes |
| 120 Hz | 175 ms, frame 21 | Yes |
| 144 Hz | 145.83 ms, frame 21 | Yes |

The normalized distance from the minimum was `0.565685`, versus the real
proximity threshold of `0.04`. The false signal advanced the real hero state
machine into `approach`.

Authoritative `runOutcome`, theta, cost, history, and HUD convergence remain
correct. This is therefore a product/educational integrity defect, not a
security vulnerability.

Recommended implementation:

- Pass the optimizer iteration or simulation `runId` into the arrival tracker.
- Update `prevCost` and `convergedRun` only when the optimizer iteration changes.
- Reset the tracker whenever the run changes.

Required regression tests:

- Repeating render frames without a new iteration never increments convergence.
- Twenty real low-delta optimizer iterations can still trigger the fallback.
- Run changes reset all convergence tracking.
- Test representative 60, 90, 120, and 144 Hz frame schedules.

### PR-002: Phone layouts contain overlapping panels

Priority: P1

Status: Confirmed by browser geometry and screenshot review

Affected code:

- `src/styles/globals.css:1187-1299`
- `src/styles/globals.css:1301-1354`

Measured overlap:

| Viewport | Concept panel bottom | Control panel top | Overlap |
| --- | ---: | ---: | ---: |
| 320x568 | 345.30 px | 217.69 px | 127.61 px |
| 375x667 | 329.91 px | 275.00 px | 54.91 px |

The mobile rules independently position the concept panel from the top and the
control panel from the bottom. Their heights are content-dependent, so no rule
reserves space between them. The overlap obscures the latest-step and scene
content.

Recommended implementation:

- Use one coordinated mobile layout rather than independent absolute placement.
- Preserve the scene as a usable middle region or deliberately collapse
  nonessential lesson content on short screens.
- Keep the transport separate and safe-area aware.

Required regression tests:

- Assert that the concept, control, and transport bounding boxes do not overlap.
- Cover at least 320x568, 375x667, 430x932, 768x1024, and 812x375.
- Check both initial and post-interaction content heights.

### PR-003: Loss summary remains stale after a run change

Priority: P1

Status: Confirmed in Chromium

Affected code:

- `src/ui/LossChart.tsx:75-83`
- `src/state/simHistory.ts:15-18`

Reproduction:

1. Load Sphere at iteration 0.
2. Observe `Starting cost 18.500 at iteration 0.`
3. Change the landscape to Matyas.
4. The visible and accessible summary still says
   `Starting cost 18.500 at iteration 0.`

`LossChart` updates `accessibleHistory` only when the latest iteration changes.
Changing a function resets iteration to 0 but increments `simHistory.runId`, so
the new run is ignored.

Recommended implementation:

- Track both `runId` and iteration when deciding whether to update accessible
  history.
- Ensure the visible summary and screen-reader table update together.

Required regression tests:

- Switching function, optimizer, learning rate, or start point at iteration 0
  immediately replaces the summary.
- Restarting at iteration 0 replaces the previous run's accessible history.

### PR-004: Mobile loading performance needs improvement

Priority: P2

Status: Measured on a production preview with emulated slow 4G

Measurements:

- DOM content loaded: 1.37 s
- Controls ready: 7.38 s
- Canvas visible: 7.84 s
- Initial JavaScript: 164.82 KB gzip
- Scene chunk: 444.17 KB gzip, 1.357 MB minified
- Total JavaScript: 608.99 KB gzip
- HDR asset: 1.859 MB

The bundle budget passes, but total JavaScript has about 91 KB of margin against
the 700 KB budget and the HDR has about 140 KB against the 2 MB asset budget.

Recommended work:

- Define an explicit mobile readiness SLO before changing the budget.
- Profile the scene chunk and remove or defer unused Three.js/postprocessing
  code.
- Evaluate a smaller or more efficiently encoded environment asset.
- Make the controls usable without waiting for all scene resources.
- Add repeatable throttled-load measurements to release QA.

### PR-005: Three-dimensional labels collide or clip

Priority: P2

Status: Confirmed visually

Affected code:

- `src/scene/DescentBall.tsx:82-92`
- `src/scene/OptimizationCues.tsx:107-117`

`Current point` and `Goal: lowest cost` can overlap as the point converges.
Labels also clip at the viewport or disappear beneath the mobile control panel.
Both are unconstrained Drei `Html` overlays with no collision, clamping, or
responsive visibility policy.

Recommended work:

- Add collision/priority behavior near the goal.
- Clamp, offset, or hide nonessential labels on constrained viewports.
- Verify labels during initial, mid-descent, converged, and landscape states.

### PR-006: Frontend and scene coverage is incomplete

Priority: P2

Status: Confirmed from test configuration

Affected configuration:

- `vite.config.ts:31-35`
- `e2e/app.spec.ts`

Reported coverage was:

- Statements: 91.61%
- Branches: 77.46%

However, coverage includes only `src/engine/**`, `src/state/**`, and
`src/quality/**`. UI and scene code are excluded. The E2E suite contains six
logical flows, run across Chromium and WebKit, and did not detect PR-001,
PR-002, or PR-003.

Recommended work:

- Add focused tests for the three release blockers.
- Include meaningful UI/scene modules in coverage or track them through an
  explicit E2E coverage matrix.
- Add overlap assertions rather than checking only viewport containment.
- Exercise keyboard shortcuts from body focus and from interactive controls.

### PR-007: Production deployment controls are not defined

Priority: P2

Status: Not verifiable from this repository

No production hosting configuration was found for:

- Content Security Policy
- HSTS and TLS policy
- `frame-ancestors` or equivalent framing protection
- Immutable hashed-asset caching and short-lived HTML caching
- Compression
- Error and availability monitoring
- Deployment rollback
- HDR asset provenance/licensing documentation

These are deployment obligations, not confirmed source vulnerabilities. A
public production verdict remains incomplete until the selected host and its
response headers are audited.

### PR-008: CI should use explicit supply-chain hardening

Priority: P3

Status: Defense in depth

Affected code:

- `.github/workflows/ci.yml:13-14`

The workflow uses `actions/checkout@v4` and `actions/setup-node@v4`, which are
mutable major tags. The security policy pass did not classify these as
reportable vulnerabilities because exploitation requires compromise of the
official GitHub action publication path and this workflow does not deploy or
publish artifacts.

Recommended work:

- Pin each action to a reviewed full commit SHA.
- Declare `permissions: contents: read`.
- Use `persist-credentials: false` for checkout unless later steps need it.
- Keep dependency and browser installation inputs lockfile controlled.

### PR-009: Dependency and runtime warning maintenance

Priority: P3

Status: Nonblocking maintenance

- Production dependency audit: zero vulnerabilities.
- Full audit: one low-severity development-only `esbuild` advisory,
  `GHSA-g7r4-m6w7-qqqr`.
- Browser console: no page errors, but repeated Three.js `Clock` and
  `PCFSoftShadowMap` deprecation warnings.
- Headless Chromium also emitted expected GPU `ReadPixels` stall warnings.

Upgrade or adjust the deprecated Three.js integrations before the warnings
become breaking changes.

### PR-010: Release the reviewed state, not the dirty workspace

Priority: P2

Status: Release-process blocker

The audit ended with 33 modified or untracked worktree entries. Before release:

1. Review and commit the intended changes.
2. Run CI against the exact commit.
3. Verify the production deployment from that commit.
4. Record the deployed revision and retain a rollback target.

## Verification Results

Passed:

- `npm run typecheck`
- `npm test`: 48 files, 191 tests
- `npm run coverage`
- `npm run build`
- `npm run check:bundle`
- `npm run test:e2e`: 11 passed, one intentional WebKit axe skip
- `npm audit --omit=dev`: zero vulnerabilities

Browser audit:

- All 81 landscape/optimizer combinations advanced to iteration 1 with finite
  displayed costs.
- Three Sphere rows were marked as harness timeouts for RMSProp, Adam, and
  AdamW, but iteration and cost changed; these were test-predicate false
  negatives, not optimizer failures.
- Sphere plus SGD converged at iteration 23.
- Restart reset iteration to 0.
- Reduced-motion handling worked.
- No page errors were observed.

Formula tooltip:

- The formula explanation is present and understandable.
- It is reachable from an accessible button.
- It passed dedicated Chromium and WebKit interaction tests.
- Escape closes it and restores `aria-expanded="false"`.

## Security Review

The completed repository security scan reviewed 71 shipped runtime/release
files and explicitly closed 182 non-runtime inventory rows. All three candidates
received discovery, validation, and attack-path receipts.

Result: **zero reportable security vulnerabilities**.

The formal sealed report is currently at:

`C:\Users\rahuaf\AppData\Local\Temp\codex-security-scans\gradient-descent-app\0deac233865833226c547b20dff8b8f5d513c3e0_20260720T174338Z\report.md`

That location is temporary. This handoff contains the durable conclusions
needed for release work.

## Recommended Fix Order

1. Fix PR-001, PR-002, and PR-003.
2. Add their regression tests before further visual changes.
3. Resolve PR-005 while retesting every target viewport.
4. Profile and improve PR-004 against a documented SLO.
5. Define deployment controls in PR-007.
6. Apply CI and dependency hardening from PR-008 and PR-009.
7. Commit the intended state and complete PR-010.
8. Rerun the complete release gate and browser audit against the final commit.

## Exit Criteria

Do not call the app publicly ship-ready until:

- The three P1 defects have regression tests and no longer reproduce.
- Target phone layouts have no cross-panel overlap or clipped required controls.
- Scene labels remain legible or are intentionally suppressed at constrained
  viewports.
- A mobile load SLO is documented and met.
- Production hosting headers, caching, monitoring, and rollback are verified.
- The exact release commit passes typecheck, unit, coverage, build, bundle,
  browser, accessibility, and dependency checks.

## Prompt For A New Codex Session

Use this prompt from the repository root:

> Read `docs/production-readiness-audit-2026-07-20.md` in full. Treat it as the
> authoritative audit handoff. Do not discard or reset existing worktree
> changes. Start by fixing PR-001, PR-002, and PR-003 with focused regression
> tests, then run the documented release gates and report remaining findings.
