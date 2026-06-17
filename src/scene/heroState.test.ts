import {
  TOUCHDOWN_MS,
  APPROACH_MS,
  initialHeroState,
  advanceHero,
  heroNeedsFrames,
  type HeroState,
} from './heroState';

const RUN = 'sphere|sgd|0.1|0,0';

describe('heroState — beat state machine', () => {
  it('idle + arrived (not fired) → approach', () => {
    const s = advanceHero(initialHeroState(RUN), { arrived: true, diverged: false, runId: RUN }, 16);
    expect(s.phase).toBe('approach');
    expect(s.fired).toBe(true);
  });

  it('approach holds for ~APPROACH_MS (the ~1s cyan bleed) then → touchdown', () => {
    let s = advanceHero(initialHeroState(RUN), { arrived: true, diverged: false, runId: RUN }, 16);
    expect(s.phase).toBe('approach');
    // Still in approach partway through the lead-in.
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, APPROACH_MS / 2);
    expect(s.phase).toBe('approach');
    // Crossing APPROACH_MS transitions to the flash.
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, APPROACH_MS);
    expect(s.phase).toBe('touchdown');
  });

  it('touchdown accumulates to t=1 over TOUCHDOWN_MS then → settle', () => {
    let s: HeroState = { phase: 'touchdown', elapsedMs: 0, t: 0, fired: true, runId: RUN };
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, TOUCHDOWN_MS / 2);
    expect(s.phase).toBe('touchdown');
    expect(s.t).toBeCloseTo(0.5, 2);
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, TOUCHDOWN_MS);
    expect(s.phase).toBe('settle');
  });

  it('does not re-fire once fired', () => {
    let s = advanceHero(initialHeroState(RUN), { arrived: true, diverged: false, runId: RUN }, 16);
    // jump to settle, then "arrive" again — must stay settle (latched)
    s = { ...s, phase: 'settle' };
    s = advanceHero(s, { arrived: true, diverged: false, runId: RUN }, 16);
    expect(s.phase).toBe('settle');
  });

  it('diverged from any phase → terminal diverged', () => {
    const s = advanceHero({ phase: 'touchdown', elapsedMs: 10, t: 0.1, fired: true, runId: RUN },
      { arrived: false, diverged: true, runId: RUN }, 16);
    expect(s.phase).toBe('diverged');
  });

  it('a runId change resets to idle', () => {
    const s = advanceHero({ phase: 'settle', elapsedMs: 500, t: 1, fired: true, runId: RUN },
      { arrived: false, diverged: false, runId: 'other|adam|0.01|1,1' }, 16);
    expect(s.phase).toBe('idle');
    expect(s.fired).toBe(false);
  });

  it('heroNeedsFrames: true during approach/touchdown + the settle tail, false at idle', () => {
    expect(heroNeedsFrames({ phase: 'idle', elapsedMs: 0, t: 0, fired: false, runId: RUN })).toBe(false);
    expect(heroNeedsFrames({ phase: 'touchdown', elapsedMs: 0, t: 0, fired: true, runId: RUN })).toBe(true);
    expect(heroNeedsFrames({ phase: 'settle', elapsedMs: 100, t: 0, fired: true, runId: RUN })).toBe(true);
    expect(heroNeedsFrames({ phase: 'settle', elapsedMs: 99999, t: 0, fired: true, runId: RUN })).toBe(false);
  });
});
