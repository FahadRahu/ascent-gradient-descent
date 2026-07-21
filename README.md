# ASCENT

ASCENT is an interactive 3D learning tool for making gradient descent visible.
It turns mathematical objective functions into explorable cost landscapes, then
shows how an optimizer moves through each landscape step by step.

Public deployment: pending the first Vercel production release.

## What You Can Explore

- Nine objective functions, from a convex sphere to Rosenbrock, Rastrigin,
  Ackley, and saddle landscapes.
- Nine optimization methods, including gradient descent, Momentum, Nesterov,
  AdaGrad, RMSProp, Adam, AdamW, Nadam, and Newton's method.
- Adjustable learning rates, single-step playback, continuous runs, and reset
  controls.
- Live position, gradient, cost, iteration, convergence, and loss-history
  feedback.
- Responsive quality tiers and a non-WebGL fallback.

## Local Development

Requirements:

- Node.js 22
- npm 11.7.0
- A browser with WebGL support for the 3D scene

Install the locked dependency tree and start Vite:

```sh
npm ci
npm run dev
```

The development server runs at <http://localhost:3000>. Sentry is disabled when
no DSN is configured, so no environment variables are required for local use.

## Validation

```sh
npm run typecheck
npm test
npm run test:ops
npm run coverage
npm run build
npm run check:bundle
npm run test:e2e
npm run test:performance
```

The browser suites require Chromium and WebKit:

```sh
npx playwright install chromium webkit
```

CI also audits production dependencies and enforces accessibility, bundle-size,
and slow-4G readiness checks.

## Deployment

ASCENT builds to a static `dist` directory and is configured for Vercel in
[`vercel.json`](vercel.json). Vercel deployments use `npm ci`, Node.js 22, and
the commit SHA supplied by Vercel as the release identifier.

Hosted browser-error reporting is optional. The application works without it;
when Sentry is configured, client events are sanitized and private source maps
are uploaded during the build. See [`.env.example`](.env.example) for variable
names and [`docs/production-runbook.md`](docs/production-runbook.md) for the
release, verification, monitoring, and rollback process.

## Technology

React 19, TypeScript, Three.js, React Three Fiber, Zustand, Math.js, Vite,
Vitest, Playwright, Sentry, and Vercel.

## Assets

Third-party asset provenance and licensing are documented in
[`docs/asset-licenses.md`](docs/asset-licenses.md).

## License

The application source code is available under the [MIT License](LICENSE).
Third-party assets remain subject to the licenses documented above.
