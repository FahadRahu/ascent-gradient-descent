import type { HistoryEntry } from '../engine/stepper';
import { signedLogCost, summarizeLoss } from './LossChart';

describe('loss chart transforms', () => {
  it('preserves the sign of negative saddle costs', () => {
    expect(signedLogCost(-100)).toBeLessThan(0);
    expect(signedLogCost(0)).toBe(0);
    expect(signedLogCost(100)).toBeGreaterThan(0);
  });

  it('summarizes the trend in text', () => {
    const history: HistoryEntry[] = [
      { iteration: 0, theta: [1, 1], cost: 2 },
      { iteration: 1, theta: [0.5, 1.5], cost: -1 },
    ];
    expect(summarizeLoss(history)).toContain('decreased from 2.000 to -1.000');
  });
});
