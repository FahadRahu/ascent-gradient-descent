import type { HistoryEntry } from '../engine/stepper';
import type { PlaybackMode } from './uiStore';

export interface HistorySelection {
  latestIndex: number;
  selectedIndex: number;
  visibleLength: number;
  selected: HistoryEntry | null;
  previous: HistoryEntry | null;
}

export function resolveHistorySelection(
  history: readonly HistoryEntry[],
  mode: PlaybackMode,
  scrubIndex: number,
): HistorySelection {
  const latestIndex = history.length - 1;
  if (latestIndex < 0) {
    return {
      latestIndex,
      selectedIndex: -1,
      visibleLength: 0,
      selected: null,
      previous: null,
    };
  }

  const selectedIndex = mode === 'live'
    ? latestIndex
    : Math.min(Math.max(0, scrubIndex), latestIndex);

  return {
    latestIndex,
    selectedIndex,
    visibleLength: selectedIndex + 1,
    selected: history[selectedIndex] ?? null,
    previous: history[selectedIndex - 1] ?? null,
  };
}
