import { createHeroRefs } from './heroRefs';

describe('createHeroRefs', () => {
  it('returns an object with all six nullable refs', () => {
    const r = createHeroRefs();
    expect(r.ballMaterial).toEqual({ current: null });
    expect(r.trailMaterial).toEqual({ current: null });
    expect(r.pathHalo).toEqual({ current: null });
    expect(r.bloom).toEqual({ current: null });
    expect(r.dof).toEqual({ current: null });
    expect(r.vignette).toEqual({ current: null });
  });

  it('returns a fresh object each call (no shared mutable singleton)', () => {
    const a = createHeroRefs();
    const b = createHeroRefs();
    expect(a).not.toBe(b);
    expect(a.bloom).not.toBe(b.bloom);
  });
});
