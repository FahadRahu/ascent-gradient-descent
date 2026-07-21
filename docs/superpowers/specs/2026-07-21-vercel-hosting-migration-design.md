# ASCENT — GitHub + Vercel Hosting Migration Design

Date: 2026-07-21

## Goal

Take ASCENT from an unpublished local repository to a publicly launched site
hosted on Vercel, reached through Vercel's free `*.vercel.app` subdomain. The
target rigor is a **rigorous public launch**: strict security headers, hosted
error monitoring, availability monitoring, release verification, and a rollback
story — all ported from the current Netlify-oriented setup.

This is a deployment-port job, not an app-correctness job. The three P1
readiness-audit blockers (PR-001 false convergence, PR-002 phone overlap,
PR-003 stale loss summary) are already resolved on `main`. Verified on
2026-07-21: `npm run typecheck` is clean and `npm test` is green (49 files, 199
tests). `heroTrigger.ts` now gates convergence on `runId`/iteration.

## Locked Decisions

- **Hosting goal:** rigorous public launch.
- **Error logging:** swap the custom Netlify function for a hosted service
  (Sentry). Flexible — may be revisited, but this design targets Sentry.
- **Domain:** Vercel's free `*.vercel.app` subdomain. No DNS work. A custom
  domain can be added later without rework.
- **Repo visibility:** public GitHub repo, with internal planning docs trimmed
  from the browsable tree.
- **Git history:** forward-trim only (see Phase A). No history rewrite, because
  a full scan of all 79 commits found no secrets, keys, or credentials.

## What Is Netlify-Coupled Today

Five files hard-code Netlify. All must change:

1. `netlify.toml` — build, SPA redirect, security headers, cache rules.
2. `netlify/functions/client-errors.mjs` — serverless client-error logger.
3. `vite.config.ts:6-7` — reads Netlify's `COMMIT_REF` to stamp the release SHA.
4. `scripts/verify-deployment.mjs:114-121` — probes
   `/.netlify/functions/client-errors`.
5. `src/monitoring.ts:1` — POSTs client errors to the Netlify function endpoint.

Host-agnostic, no change needed: `.github/workflows/ci.yml` (already pins action
SHAs and declares `permissions: contents: read`, satisfying PR-008),
`.github/workflows/production-monitor.yml` (reads `PRODUCTION_URL` repo variable).

## Phases

### Phase A — Repository hygiene

**Git history (forward-trim):** Move internal planning docs out of the
browsable HEAD tree without rewriting history. Candidates: `PRD.md`, the
readiness-audit handoff, and `docs/superpowers/**` plans and specs. Options are
(a) delete from HEAD, or (b) relocate under a gitignored `internal/` path.
History retains them, which is acceptable: the scan confirmed no secrets, and a
79-commit development narrative is itself a portfolio asset.

**Keep and publish:** `docs/asset-licenses.md` (documents the HDR provenance —
required for a public repo), `docs/production-runbook.md` (rewritten for Vercel
in Phase D).

**Add:**

- `LICENSE` — a permissive license (MIT unless the user prefers otherwise).
- `README.md` — public-facing: what ASCENT is, live link, local dev
  (`npm ci && npm run dev`), tech stack, test commands. No README exists today.
- Confirm `.gitignore` covers `.env` and `.env.*` (currently covers `*.local`
  but not a bare `.env`). Add explicit `.env*` before any Sentry env work.

### Phase B — Vercel configuration port

Create `vercel.json` translating every `netlify.toml` rule:

- SPA rewrite: `/(.*) → /index.html` (Vercel `rewrites`, not `redirects`, to
  preserve status 200 client-side routing).
- Full security-header block, byte-for-byte equivalent to the current headers:
  CSP, HSTS (`max-age=63072000; includeSubDomains; preload`), COOP, CORP,
  Permissions-Policy, Referrer-Policy, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, and the `must-revalidate` HTML cache rule.
- Immutable one-year cache for `/assets/*` and `/hdri/*`.

CSP change for Sentry: `connect-src` becomes
`'self' https://*.ingest.sentry.io` (verify the exact ingest host for the chosen
Sentry region/project during implementation).

Delete `netlify.toml` and the `netlify/` directory.

In `vite.config.ts`, replace `process.env.COMMIT_REF` with
`process.env.VERCEL_GIT_COMMIT_SHA` (keep `VITE_RELEASE_SHA` as the explicit
override and `'development'` as the fallback).

Vercel auto-detects Vite (build `npm run build`, output `dist`); no build
command override needed unless detection fails.

### Phase C — Sentry error monitoring

- Add `@sentry/react` as a dependency.
- Initialize Sentry in `src/main.tsx`, guarded by `import.meta.env.PROD`, with
  the release SHA (`import.meta.env.VITE_RELEASE_SHA`) as the Sentry `release`
  and a low `tracesSampleRate`.
- Rewrite `src/monitoring.ts` to forward captured errors to Sentry instead of
  POSTing to the function. Preserve the existing behavior contract: PROD-only,
  message/stack truncation, and the `error` / `unhandledrejection` handlers.
  `installErrorMonitoring(release)` keeps its signature and teardown return.
- Update `src/monitoring.test.ts` to assert Sentry capture instead of the
  `sendBeacon`/`fetch` transmit path.
- The Sentry DSN is a client-visible value by design, injected as a Vite env
  var (`VITE_SENTRY_DSN`). Documented as an env var; not treated as a secret.

### Phase D — Release verification and runbook

- Rewrite `scripts/verify-deployment.mjs`: remove the Netlify-function probe
  (lines 114-121). Keep every header, cache, compression, and release-SHA
  assertion. Keep `scripts/verify-deployment.test.mjs` green (update any
  function-probe expectation).
- Rewrite `docs/production-runbook.md` Netlify sections: hosting contract
  (Vercel + `vercel.json`), rollback (Vercel instant rollback / "Promote to
  Production" on a prior deployment — no rebuild), and monitoring (Sentry for
  client errors; the production-monitor workflow for availability).

### Phase E — GitHub and Vercel wiring

- Create a public GitHub repository; push `main`.
- Connect the repo in Vercel via the GitHub app: auto-deploy on push to `main`,
  preview deploys on pull requests.
- Set Vercel environment variable `VITE_SENTRY_DSN` (Production + Preview).
- Set the GitHub repository variable `PRODUCTION_URL` to the `*.vercel.app` URL
  so `production-monitor.yml` verifies the live site every 15 minutes.

### Phase F — Go-live and verification

1. First production deploy from a clean, reviewed `main` commit.
2. Run:
   `EXPECTED_RELEASE_SHA=<sha> node scripts/verify-deployment.mjs https://<app>.vercel.app`
3. Launch checklist: security headers live (verify against `vercel.json`),
   immutable caching + compression on hashed assets, Sentry receives a
   deliberately triggered test error, production monitor green, release SHA
   stamped in the served HTML.
4. Record the deployed commit SHA and Vercel deployment ID; retain the previous
   deploy as the rollback target.

## Out of Scope

- Custom domain / DNS (deferred; `*.vercel.app` for launch).
- App feature work and the M1c milestone.
- PR-004 mobile-load SLO tuning and PR-005 label collision (tracked separately;
  not launch blockers for this migration).
- Any git history rewrite.

## Success Criteria

- Site reachable at a public `https://*.vercel.app` URL.
- `verify-deployment.mjs` passes against the live URL, including release-SHA
  match and Sentry-compatible CSP.
- All Netlify-coupled files removed or ported; no `netlify` reference remains in
  shipped config, source, or scripts.
- Sentry receives a test error from production.
- Production-monitor workflow green against `PRODUCTION_URL`.
- CI (`npm test`, typecheck, coverage, build, bundle, e2e, performance) green on
  the release commit.
- Public repo has a LICENSE and a public-facing README; internal planning docs
  trimmed from HEAD.
