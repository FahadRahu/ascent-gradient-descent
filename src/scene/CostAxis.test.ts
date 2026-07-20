import { sampleWorldHeightRange } from './CostAxis';

describe('sampleWorldHeightRange', () => {
  it('captures the sphere from its zero minimum to its high corners', () => {
    const range = sampleWorldHeightRange('sphere', 16);
    expect(range.min).toBeCloseTo(0, 8);
    expect(range.max).toBeCloseTo(1.5, 8);
  });

  it('preserves negative and positive height on the saddle', () => {
    const range = sampleWorldHeightRange('saddle', 16);
    expect(range.min).toBeLessThan(0);
    expect(range.max).toBeGreaterThan(0);
  });
});
