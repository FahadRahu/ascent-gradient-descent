import { classifyCostStep } from './costFeedback';

describe('classifyCostStep', () => {
  it('starts ready before an optimizer step exists', () => {
    expect(classifyCostStep(null, 18.5, 0, false)).toEqual({
      state: 'ready',
      change: 0,
    });
  });

  it('reports the magnitude of a cost decrease', () => {
    expect(classifyCostStep(18.5, 11.84, 0, false)).toEqual({
      state: 'decreased',
      change: 6.66,
    });
  });

  it('distinguishes an overshoot from a successful step', () => {
    expect(classifyCostStep(11.84, 20, 0, false)).toEqual({
      state: 'increased',
      change: 8.16,
    });
  });

  it('recognizes arrival within the displayed goal tolerance', () => {
    expect(classifyCostStep(0.02, 0.0005, 0, false).state).toBe('reached');
  });

  it('gives divergence precedence over cost comparisons', () => {
    expect(classifyCostStep(10, 9, 0, true).state).toBe('diverged');
  });
});
