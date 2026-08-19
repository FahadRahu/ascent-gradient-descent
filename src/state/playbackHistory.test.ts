import type { HistoryEntry } from '../engine/stepper';
import { resolveHistorySelection } from './playbackHistory';

const HISTORY: HistoryEntry[] = [
  { iteration: 12, theta: [3, 2], cost: 13 },
  { iteration: 13, theta: [2, 1], cost: 5 },
  { iteration: 14, theta: [1, 0], cost: 1 },
];

describe('resolveHistorySelection', () => {
  it('follows the latest retained entry in live mode', () => {
    const selection = resolveHistorySelection(HISTORY, 'live', 0);
    expect(selection).toMatchObject({
      latestIndex: 2,
      selectedIndex: 2,
      visibleLength: 3,
      selected: HISTORY[2],
      previous: HISTORY[1],
    });
  });

  it('selects a historical prefix in review mode', () => {
    const selection = resolveHistorySelection(HISTORY, 'review', 1);
    expect(selection.selected).toBe(HISTORY[1]);
    expect(selection.previous).toBe(HISTORY[0]);
    expect(selection.visibleLength).toBe(2);
  });

  it('clamps review indices and handles an empty history', () => {
    expect(resolveHistorySelection(HISTORY, 'review', -4).selectedIndex).toBe(0);
    expect(resolveHistorySelection(HISTORY, 'review', 99).selectedIndex).toBe(2);
    expect(resolveHistorySelection([], 'review', 0)).toEqual({
      latestIndex: -1,
      selectedIndex: -1,
      visibleLength: 0,
      selected: null,
      previous: null,
    });
  });
});
