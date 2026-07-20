import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installErrorMonitoring } from './monitoring';
import './styles/globals.css';

installErrorMonitoring(import.meta.env.VITE_RELEASE_SHA);

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
