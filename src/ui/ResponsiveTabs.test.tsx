// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vi } from 'vitest';
import { ResponsiveTabs } from './ResponsiveTabs';

describe('ResponsiveTabs', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('reports pointer selection and exposes the active tab', () => {
    const onSelect = vi.fn();
    act(() => {
      root.render(
        <ResponsiveTabs activeTab="setup" onSelect={onSelect} />,
      );
    });

    const setup = container.querySelector<HTMLButtonElement>(
      '#responsive-tab-setup',
    );
    const signal = container.querySelector<HTMLButtonElement>(
      '#responsive-tab-signal',
    );
    expect(setup?.getAttribute('aria-selected')).toBe('true');
    expect(signal?.getAttribute('aria-selected')).toBe('false');

    act(() => signal?.click());
    expect(onSelect).toHaveBeenCalledWith('signal');
  });

  it('moves selection and focus with arrow, Home, and End keys', () => {
    const onSelect = vi.fn();
    act(() => {
      root.render(
        <ResponsiveTabs activeTab="setup" onSelect={onSelect} />,
      );
    });

    const setup = container.querySelector<HTMLButtonElement>(
      '#responsive-tab-setup',
    )!;
    const signal = container.querySelector<HTMLButtonElement>(
      '#responsive-tab-signal',
    )!;
    const learn = container.querySelector<HTMLButtonElement>(
      '#responsive-tab-learn',
    )!;

    act(() => {
      setup.focus();
      setup.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });
    expect(onSelect).toHaveBeenLastCalledWith('signal');
    expect(document.activeElement).toBe(signal);

    act(() => {
      signal.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      );
    });
    expect(onSelect).toHaveBeenLastCalledWith('learn');
    expect(document.activeElement).toBe(learn);

    act(() => {
      learn.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );
    });
    expect(onSelect).toHaveBeenLastCalledWith('setup');
    expect(document.activeElement).toBe(setup);
  });
});
