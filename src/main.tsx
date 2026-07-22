import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installErrorMonitoring } from './monitoring';
import './styles/globals.css';

const LazyVercelTelemetry = React.lazy(async () => {
  const module = await import('./VercelTelemetry');
  return { default: module.VercelTelemetry };
});
const vercelTelemetryEnabled =
  import.meta.env.VITE_DEPLOY_ENV === 'production';

const sentryRootOptions = installErrorMonitoring({
  enabled: import.meta.env.PROD,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_RELEASE_SHA,
  environment: import.meta.env.VITE_DEPLOY_ENV,
});

// Dev-only: expose the two-channel stores for debugging + live verification in
// the browser console / automated smoke checks. Tree-shaken out of production
// builds (import.meta.env.DEV is false there). Never rely on this in app code.
if (import.meta.env.DEV) {
  void Promise.all([import('./state/uiStore'), import('./state/simStore')]).then(
    ([ui, sim]) => {
      (window as unknown as Record<string, unknown>).__ascent = {
        uiStore: ui.useUIStore,
        simStore: sim.simStore,
      };
    },
  );
}

ReactDOM.createRoot(document.getElementById('root')!, sentryRootOptions).render(
  <React.StrictMode>
    <App />
    {vercelTelemetryEnabled ? (
      <React.Suspense fallback={null}>
        <LazyVercelTelemetry />
      </React.Suspense>
    ) : null}
  </React.StrictMode>,
);
