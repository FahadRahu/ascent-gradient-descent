import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FastForward,
  Pause,
  Play,
  Rewind,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { resolveHistorySelection } from '../state/playbackHistory';
import { getSimRunnerHandle } from '../state/simHistory';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import type { GraphicsStatus } from './GraphicsState';

const SPEED_OPTIONS = [
  { label: '0.5x', milliseconds: 500 },
  { label: '1x', milliseconds: 250 },
  { label: '2x', milliseconds: 125 },
  { label: '4x', milliseconds: 62.5 },
] as const;

const HISTORY_BUTTON_CLASS = [
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded',
  'border border-border bg-control p-0 text-muted',
  'transition-[transform,border-color,background-color,color] duration-150',
  'enabled:hover:border-border-strong enabled:hover:bg-control-hover',
  'enabled:hover:text-text enabled:active:scale-[0.97] enabled:active:bg-control-active',
  'disabled:bg-control-disabled disabled:text-dim disabled:opacity-[0.58]',
].join(' ');

function formatCost(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const magnitude = Math.abs(value);
  if (magnitude >= 1000 || (magnitude > 0 && magnitude < 0.001)) {
    return value.toExponential(2);
  }
  return value.toFixed(3);
}

function setDisabled(
  ref: RefObject<HTMLButtonElement | null>,
  disabled: boolean,
): void {
  if (ref.current) ref.current.disabled = disabled;
}

export function Scrubber({ graphicsStatus }: { graphicsStatus: GraphicsStatus }) {
  const mode = useUIStore((state) => state.mode);
  const scrubIndex = useUIStore((state) => state.scrubIndex);
  const isPlaying = useUIStore((state) => state.isPlaying);
  const playbackSpeedMs = useUIStore((state) => state.playbackSpeedMs);
  const runOutcome = useUIStore((state) => state.runOutcome);
  const setPlaying = useUIStore((state) => state.setPlaying);
  const selectHistoryIndex = useUIStore((state) => state.selectHistoryIndex);
  const stepHistory = useUIStore((state) => state.stepHistory);
  const advanceReviewPlayback = useUIStore((state) => state.advanceReviewPlayback);
  const setPlaybackSpeedMs = useUIStore((state) => state.setPlaybackSpeedMs);

  const sliderRef = useRef<HTMLInputElement>(null);
  const iterationRef = useRef<HTMLOutputElement>(null);
  const costRef = useRef<HTMLOutputElement>(null);
  const windowRef = useRef<HTMLSpanElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const backTenRef = useRef<HTMLButtonElement>(null);
  const previousRef = useRef<HTMLButtonElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const forwardTenRef = useRef<HTMLButtonElement>(null);
  const latestRef = useRef<HTMLButtonElement>(null);
  const controlsReady = graphicsStatus === 'ready';

  useEffect(() => {
    if (mode !== 'review' || !isPlaying) return;

    const timer = window.setInterval(() => {
      const latestIndex = getSimRunnerHandle().history.length - 1;
      advanceReviewPlayback(latestIndex);
    }, playbackSpeedMs);

    return () => window.clearInterval(timer);
  }, [mode, isPlaying, playbackSpeedMs, advanceReviewPlayback]);

  useEffect(() => {
    let pendingFrame = 0;

    const sync = () => {
      pendingFrame = 0;
      const handle = getSimRunnerHandle();
      const ui = useUIStore.getState();
      const selection = resolveHistorySelection(
        handle.history,
        ui.mode,
        ui.scrubIndex,
      );
      const selected = selection.selected;
      const first = handle.history[0];
      const latest = handle.history[selection.latestIndex];
      const beforeFirst = selection.selectedIndex <= 0;
      const atLatest = selection.selectedIndex >= selection.latestIndex;

      if (sliderRef.current) {
        sliderRef.current.min = '0';
        sliderRef.current.max = String(Math.max(0, selection.latestIndex));
        sliderRef.current.value = String(Math.max(0, selection.selectedIndex));
        sliderRef.current.disabled = !controlsReady || selection.latestIndex < 1;
        sliderRef.current.setAttribute(
          'aria-valuetext',
          selected
            ? `Iteration ${selected.iteration}, retained step ${selection.selectedIndex + 1} of ${handle.history.length}, cost ${formatCost(selected.cost)}`
            : 'No retained optimization steps',
        );
      }

      if (iterationRef.current) {
        iterationRef.current.textContent = selected
          ? selected.iteration.toLocaleString()
          : '--';
      }
      if (costRef.current) costRef.current.textContent = formatCost(selected?.cost ?? NaN);
      if (windowRef.current) {
        windowRef.current.textContent = first && latest
          ? `Retained ${first.iteration}-${latest.iteration} (${handle.history.length} ${handle.history.length === 1 ? 'step' : 'steps'})`
          : 'No retained steps';
      }

      setDisabled(firstRef, !controlsReady || beforeFirst);
      setDisabled(backTenRef, !controlsReady || beforeFirst);
      setDisabled(previousRef, !controlsReady || beforeFirst);
      setDisabled(nextRef, !controlsReady || atLatest);
      setDisabled(forwardTenRef, !controlsReady || atLatest);
      setDisabled(latestRef, !controlsReady || atLatest);
      setDisabled(
        playRef,
        !controlsReady ||
          (ui.mode === 'live'
            ? ui.runOutcome !== 'active'
            : atLatest),
      );
    };

    const scheduleSync = () => {
      if (pendingFrame === 0) pendingFrame = window.requestAnimationFrame(sync);
    };

    const unsubscribe = simStore.subscribe(scheduleSync);
    sync();
    return () => {
      unsubscribe();
      if (pendingFrame !== 0) window.cancelAnimationFrame(pendingFrame);
    };
  }, [controlsReady, mode, scrubIndex, isPlaying, runOutcome]);

  const getLatestIndex = () => getSimRunnerHandle().history.length - 1;
  const select = (index: number) => {
    selectHistoryIndex(index, getLatestIndex());
  };
  const step = (offset: number) => {
    stepHistory(offset, getLatestIndex());
  };

  const onSliderKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.code === 'Space') {
      if (!playRef.current?.disabled) {
        event.preventDefault();
        setPlaying(!useUIStore.getState().isPlaying);
      }
      return;
    }

    if (!event.shiftKey) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-10);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(10);
    }
  };

  const capturePointer = (event: PointerEvent<HTMLInputElement>) => {
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const releasePointer = (event: PointerEvent<HTMLInputElement>) => {
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      typeof event.currentTarget.releasePointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      className="scrubber border-t border-border pt-[15px]"
      aria-labelledby="scrubber-title"
    >
      <div className="scrubber-heading flex items-center justify-between gap-3">
        <div>
          <span className="section-kicker">Retained history</span>
          <h3
            id="scrubber-title"
            className="mb-0 mt-[3px] text-[13px] leading-[1.2] text-text"
          >
            Review iterations
          </h3>
        </div>
        <span
          className="review-badge shrink-0 rounded-sm border border-border-strong bg-control px-[6px] py-1 text-[9px] font-bold uppercase tracking-normal text-muted"
          hidden={mode !== 'review'}
        >
          Review mode
        </span>
      </div>

      <div
        className="scrubber-readout mt-3 flex items-center justify-between gap-3 text-[10px] text-muted"
        aria-live="polite"
      >
        <span>
          Iteration{' '}
          <output
            ref={iterationRef}
            className="ml-1 font-mono text-[11px] font-[650] text-text"
            htmlFor="history-scrubber"
          >
            0
          </output>
        </span>
        <span>
          Cost{' '}
          <output
            ref={costRef}
            className="ml-1 font-mono text-[11px] font-[650] text-text"
            htmlFor="history-scrubber"
          >
            --
          </output>
        </span>
      </div>

      <input
        ref={sliderRef}
        id="history-scrubber"
        data-tour="scrubber"
        className={[
          'scrubber-range mt-[2px] h-[44px] w-full touch-pan-y appearance-none bg-transparent',
          'disabled:opacity-40',
          '[&::-webkit-slider-runnable-track]:h-1',
          '[&::-webkit-slider-runnable-track]:rounded-sm',
          '[&::-webkit-slider-runnable-track]:bg-border-strong',
          '[&::-webkit-slider-thumb]:mt-[-8px]',
          '[&::-webkit-slider-thumb]:h-[20px] [&::-webkit-slider-thumb]:w-[20px]',
          '[&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:border-[3px]',
          '[&::-webkit-slider-thumb]:border-panel-solid',
          '[&::-webkit-slider-thumb]:bg-cyan',
          '[&::-webkit-slider-thumb]:shadow-[0_0_0_1px_var(--color-cyan)]',
          '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-sm',
          '[&::-moz-range-track]:bg-border-strong',
          '[&::-moz-range-thumb]:h-[20px] [&::-moz-range-thumb]:w-[20px]',
          '[&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-[3px]',
          '[&::-moz-range-thumb]:border-panel-solid',
          '[&::-moz-range-thumb]:bg-cyan',
          '[&::-moz-range-thumb]:shadow-[0_0_0_1px_var(--color-cyan)]',
        ].join(' ')}
        type="range"
        role="slider"
        min="0"
        max="0"
        step="1"
        defaultValue="0"
        aria-label="Retained iteration"
        aria-valuetext="Iteration 0, retained step 1 of 1"
        onChange={(event) => select(Number(event.currentTarget.value))}
        onKeyDown={onSliderKeyDown}
        onPointerDown={capturePointer}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
      />
      <span
        ref={windowRef}
        className="retained-window mt-[-5px] block text-[9px] leading-[1.4] text-dim tabular-nums"
      >
        Retained 0-0 (1 step)
      </span>

      <div
        className="scrubber-controls mt-[10px] grid gap-2"
        role="group"
        aria-label="History navigation"
      >
        <div className="scrubber-precise-controls grid grid-cols-[repeat(3,minmax(44px,1fr))] gap-2">
          <button
            ref={previousRef}
            type="button"
            className={HISTORY_BUTTON_CLASS}
            aria-label="Previous retained iteration"
            title="Previous retained iteration"
            onClick={() => step(-1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            ref={playRef}
            type="button"
            className={`${HISTORY_BUTTON_CLASS} scrubber-play border-cyan bg-cyan text-void enabled:hover:border-cyan-strong enabled:hover:bg-cyan-strong enabled:hover:text-void`}
            aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
            title={isPlaying ? 'Pause playback' : 'Play playback'}
            aria-pressed={isPlaying}
            onClick={() => setPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={18} fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <button
            ref={nextRef}
            type="button"
            className={HISTORY_BUTTON_CLASS}
            aria-label="Next retained iteration"
            title="Next retained iteration"
            onClick={() => step(1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="scrubber-jump-controls grid grid-cols-[repeat(4,minmax(44px,1fr))] gap-2">
          <button
            ref={firstRef}
            type="button"
            className={HISTORY_BUTTON_CLASS}
            aria-label="First retained iteration"
            title="First retained iteration"
            onClick={() => select(0)}
          >
            <ChevronsLeft size={17} aria-hidden="true" />
          </button>
          <button
            ref={backTenRef}
            type="button"
            className={HISTORY_BUTTON_CLASS}
            aria-label="Back 10 retained iterations"
            title="Back 10 retained iterations"
            onClick={() => step(-10)}
          >
            <Rewind size={17} aria-hidden="true" />
          </button>
          <button
            ref={forwardTenRef}
            type="button"
            className={HISTORY_BUTTON_CLASS}
            aria-label="Forward 10 retained iterations"
            title="Forward 10 retained iterations"
            onClick={() => step(10)}
          >
            <FastForward size={17} aria-hidden="true" />
          </button>
          <button
            ref={latestRef}
            type="button"
            className={HISTORY_BUTTON_CLASS}
            aria-label="Latest retained iteration"
            title="Return to latest retained iteration"
            onClick={() => select(getLatestIndex())}
          >
            <ChevronsRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="scrubber-speed mt-[10px] flex items-center justify-between gap-3">
        <label
          className="text-[10px] font-semibold text-muted"
          htmlFor="playback-speed"
        >
          Playback speed
        </label>
        <select
          id="playback-speed"
          className="min-h-[44px] min-w-[76px] rounded border border-border-strong bg-input py-0 pl-[10px] pr-[26px] font-mono text-[10px] text-text tabular-nums transition-colors enabled:hover:bg-input-hover enabled:active:bg-control-active disabled:border-border disabled:bg-control-disabled disabled:text-dim disabled:opacity-[0.58]"
          value={playbackSpeedMs}
          disabled={!controlsReady}
          onChange={(event) => setPlaybackSpeedMs(Number(event.target.value))}
        >
          {SPEED_OPTIONS.map((option) => (
            <option key={option.label} value={option.milliseconds}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
