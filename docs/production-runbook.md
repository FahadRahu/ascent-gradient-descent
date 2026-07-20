# ASCENT Production Runbook

## Hosting Contract

ASCENT ships as a Netlify site using `netlify.toml`. Production builds use
Node 22, publish `dist`, and stamp the deployed commit from Netlify's
`COMMIT_REF` into the HTML and app root.

The hosting policy defines:

- TLS-only production with two-year HSTS.
- CSP with `frame-ancestors 'none'`, plus `X-Frame-Options: DENY`.
- MIME sniffing, referrer, opener, resource, and permissions protections.
- Revalidated HTML and one-year immutable caching for hashed assets and HDR.
- Netlify Brotli/gzip compression, verified after deployment.
- Same-origin client error capture through `client-errors.mjs`.

Set the GitHub repository variable `PRODUCTION_URL` to the canonical HTTPS URL.
The `Production monitor` workflow verifies the site every 15 minutes. GitHub
Actions failure notifications are the availability alert.

Configure a Netlify function-log alert for `"event":"client_error"` before
public launch. Reports contain only bounded error text, pathname, release,
browser user agent, and timestamp. Query strings are never sent.

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

1. Start from a clean, reviewed commit.
2. Run `npm ci` and all CI/release checks.
3. Deploy that commit through Netlify.
4. Run:

   ```sh
   EXPECTED_RELEASE_SHA=<full-commit-sha> \
   node scripts/verify-deployment.mjs https://example.com
   ```

5. Record the Netlify deploy ID and commit SHA in the release notes.
6. Confirm the production monitor and client-error log alert are healthy.

## Rollback

Netlify deploys are atomic. Keep the previous verified deploy as the rollback
target. On a failed release, use Netlify **Deploys > Published deploy > Rollback**
to republish that deploy, then rerun `verify-deployment.mjs` with the rollback
commit SHA. Do not rebuild during rollback.

## Browser Coverage Matrix

The Playwright release suite covers Chromium and WebKit, keyboard scope,
accessibility, WebGL fallback, run resets, negative objectives, convergence
labels, and panel geometry at `320x568`, `375x667`, `430x932`, `768x1024`, and
`812x375`. The throttled SLO runs separately in Chromium.
