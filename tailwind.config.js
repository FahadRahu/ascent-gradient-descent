import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    colors: {
      inherit: 'inherit',
      current: 'currentColor',
      transparent: 'transparent',
      void: 'var(--color-void)',
      panel: 'var(--color-panel)',
      'panel-solid': 'var(--color-panel-solid)',
      border: 'var(--color-border)',
      'border-strong': 'var(--color-border-strong)',
      text: 'var(--color-text)',
      muted: 'var(--color-muted)',
      dim: 'var(--color-dim)',
      cyan: 'var(--color-cyan)',
      'cyan-strong': 'var(--color-cyan-strong)',
      amber: 'var(--color-amber)',
      fuchsia: 'var(--color-fuchsia)',
      focus: 'var(--color-focus)',
      chart: {
        grid: 'var(--chart-grid)',
        line: 'var(--chart-line)',
        fill: 'var(--chart-fill)',
      },
    },
    fontFamily: {
      sans: ['var(--font-sans)'],
      mono: ['var(--font-mono)'],
    },
    spacing: {
      0: '0px',
      1: 'var(--space-1)',
      2: 'var(--space-2)',
      3: 'var(--space-3)',
      4: 'var(--space-4)',
      6: 'var(--space-6)',
      8: 'var(--space-8)',
      12: 'var(--space-12)',
      16: 'var(--space-16)',
    },
    fontSize: {
      label: ['var(--text-label)', { lineHeight: 'var(--leading-label)' }],
      caption: ['var(--text-caption)', { lineHeight: 'var(--leading-caption)' }],
      body: ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
      'body-lg': ['var(--text-body-lg)', { lineHeight: 'var(--leading-body-lg)' }],
      heading: ['var(--text-heading)', { lineHeight: 'var(--leading-heading)' }],
      display: ['var(--text-display)', { lineHeight: 'var(--leading-display)' }],
    },
    borderRadius: {
      none: '0px',
      sm: 'var(--radius-sm)',
      DEFAULT: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      full: '9999px',
    },
  },
  plugins: [animate],
};
