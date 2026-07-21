# ASCENT Production Runbook

## Hosting Contract

ASCENT ships as a static Vite site on Vercel using `vercel.json`. Builds use
Node 22, install the locked dependency tree with `npm ci`, publish `dist`, and
stamp Vercel's `VERCEL_GIT_COMMIT_SHA` into the HTML and application.

The hosting policy defines:

- TLS-only production with two-year HSTS.
- CSP with `frame-ancestors 'none'`, plus `X-Frame-Options: DENY`.
- MIME sniffing, referrer, opener, resource, and permissions protections.
- Revalidated HTML and one-year immutable caching for fingerprinted assets.
- Vercel Brotli/gzip compression, verified after deployment.
- A real 404 for unknown paths; there is no client-side router or SPA fallback.

Set the GitHub repository variable `PRODUCTION_URL` to the canonical HTTPS URL.
The `Production monitor` workflow verifies availability and the response
contract every 15 minutes. Use a hosted uptime monitor for independent alerting;
GitHub's schedule is a best-effort verification job.

## Error Monitoring

Sentry captures production and preview browser errors. The SDK does not collect
default PII, breadcrumbs, logs, metrics, browser sessions, request headers,
request bodies, user data, or extra context. Query strings and URL fragments
are removed before an event is sent.

Configure these Vercel environment variables for Preview and Production:

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | Browser-visible | Identifies the Sentry project receiving events. |
| `SENTRY_ORG` | Build-only | Selects the Sentry organization for source maps. |
| `SENTRY_PROJECT` | Build-only | Selects the Sentry project for source maps. |
| `SENTRY_AUTH_TOKEN` | Secret, build-only | Authorizes private source-map upload. |

Never prefix the auth token with `VITE_`. Vite exposes every `VITE_*` value to
browser JavaScript.

Source maps are generated only when all three build-only Sentry values and a
real release SHA are present. The build uploads them to Sentry under that SHA,
then deletes every `.map` file from `dist` before deployment. A missing or
failed upload fails the build rather than publishing unsymbolicated errors.

After deployment, open the browser console on the live site and run:

```js
setTimeout(() => {
  throw new Error('ASCENT Sentry verification');
}, 0);
```

Confirm the event appears in the expected Sentry environment and release, has a
readable source-mapped stack, and contains no URL query data.

## Mobile Readiness SLO

The release profile is Chromium at `390x844`, cold cache, 150 ms latency,
1.6 Mbps down, and 720 Kbps up:

| Milestone | SLO |
| --- | ---: |
| Landscape/setup controls enabled | <= 4.0 s |
| Core WebGL canvas visible | <= 9.0 s |

Run `npm run test:performance` against a production build. Setup controls are
available before the scene chunk finishes. Postprocessing loads at browser idle,
and compact/mobile quality tiers use the procedural environment instead of
downloading the 1.86 MB HDR.

## Release

1. Start from a clean, reviewed commit that passed required GitHub checks.
2. Confirm the Vercel deployment reports successful source-map upload.
3. Promote the verified deployment to Production.
4. Run:

   ```sh
   EXPECTED_RELEASE_SHA=<full-commit-sha> \
   node scripts/verify-deployment.mjs https://example.vercel.app
   ```

5. Verify a controlled Sentry error using the procedure above.
6. Record the Vercel deployment ID and commit SHA in the release notes.
7. Confirm the production workflow and hosted uptime monitor are healthy.

## Rollback

Vercel deployments are immutable. On a failed release, select the previous
verified deployment and use **Promote to Production**, then rerun
`verify-deployment.mjs` with that deployment's commit SHA. Do not rebuild during
rollback.

## Browser Coverage Matrix

The Playwright release suite covers Chromium and WebKit, keyboard scope,
accessibility, WebGL fallback, run resets, negative objectives, convergence
labels, and panel geometry at `320x568`, `375x667`, `430x932`, `768x1024`, and
`812x375`. The throttled SLO runs separately in Chromium.
