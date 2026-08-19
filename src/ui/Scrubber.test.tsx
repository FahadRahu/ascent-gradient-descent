// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HistoryEntry } from '../engine/stepper';
import { resetSimRunnerHandle } from '../state/simHistory';
import { useUIStore } from '../state/uiStore';
import { Scrubber } from './Scrubber';

const HISTORY: HistoryEntry[] = [
  { iteration: 20, theta: [3, 2], cost: 13 },
  { iteration: 21, theta: [2, 1], cost: 5 },
  { iteration: 22, theta: [1, 0.5], cost: 1.25 },
  { iteration: 23, theta: [0.5, 0.25], cost: 0.3125 },
];

describe('Scrubber', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useUIStore.getState().reset();
    resetSimRunnerHandle(HISTORY);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('describes the honest retained window and enters review from latest', () => {
    act(() => {
      root.render(<Scrubber graphicsStatus="ready" />);
    });

    const slider = container.querySelector<HTMLInputElement>('#history-scrubber')!;
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('3');
    expect(slider.value).toBe('3');
    expect(slider.getAttribute('aria-valuetext'))
      .toContain('Iteration 23, retained step 4 of 4');
    expect(container.querySelector('.retained-window')?.textContent)
      .toBe('Retained 20-23 (4 steps)');

    act(() => button('Previous retained iteration').click());
    expect(useUIStore.getState()).toMatchObject({
      mode: 'review',
      scrubIndex: 2,
      isPlaying: false,
    });
    expect(container.querySelector('.review-badge')?.hasAttribute('hidden')).toBe(false);
  });

  it('supports jump keys, review playback, and returning to latest', () => {
    act(() => {
      root.render(<Scrubber graphicsStatus="ready" />);
    });

    act(() => button('First retained iteration').click());
    expect(useUIStore.getState().scrubIndex).toBe(0);
    expect(button('Previous retained iteration').disabled).toBe(true);

    const slider = container.querySelector<HTMLInputElement>('#history-scrubber')!;
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        shiftKey: true,
        bubbles: true,
      }));
    });
    expect(useUIStore.getState().mode).toBe('live');
    expect(useUIStore.getState().scrubIndex).toBe(3);

    act(() => button('Previous retained iteration').click());
    act(() => button('Play playback').click());
    expect(useUIStore.getState().isPlaying).toBe(true);

    act(() => button('Latest retained iteration').click());
    expect(useUIStore.getState()).toMatchObject({
      mode: 'live',
      scrubIndex: 3,
      isPlaying: false,
    });
  });

  it('autoplays consecutive retained entries and stops at latest', () => {
    act(() => {
      root.render(<Scrubber graphicsStatus="ready" />);
    });
    act(() => button('First retained iteration').click());
    useUIStore.getState().setPlaybackSpeedMs(62.5);
    vi.useFakeTimers();

    act(() => button('Play playback').click());
    act(() => vi.advanceTimersByTime(250));

    expect(useUIStore.getState()).toMatchObject({
      mode: 'live',
      scrubIndex: 3,
      isPlaying: false,
    });
  });

  it('updates the shared presentation speed', () => {
    act(() => {
      root.render(<Scrubber graphicsStatus="ready" />);
    });

    const speed = container.querySelector<HTMLSelectElement>('#playback-speed')!;
    act(() => {
      speed.value = '62.5';
      speed.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useUIStore.getState().playbackSpeedMs).toBe(62.5);
  });
});
