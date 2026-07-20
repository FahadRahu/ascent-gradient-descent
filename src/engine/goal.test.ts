import { getFunction } from './functions';
import { goalCostForFunction, isCostAtGoal } from './goal';

describe('optimization goals', () => {
  it('returns the authored minimum cost for ordinary landscapes', () => {
    expect(goalCostForFunction(getFunction('sphere'))).toBe(0);
    expect(goalCostForFunction(getFunction('booth'))).toBe(0);
  });

  it('does not present the saddle reference point as a minimum', () => {
    expect(goalCostForFunction(getFunction('saddle'))).toBeNull();
  });

  it('uses the same displayed tolerance for convergence', () => {
    expect(isCostAtGoal(0.0005, 0)).toBe(true);
    expect(isCostAtGoal(0.01, 0)).toBe(false);
  });
});
