import { TIERS, TIER_SETTINGS, type Tier } from './tiers';

describe('quality tiers', () => {
  it('defines the five tiers from PRD §9.1', () => {
    expect(TIERS).toEqual(['ultra', 'high', 'medium', 'low', 'fallback']);
  });

  it('each non-fallback tier has DPR, surface segments, and particle counts', () => {
    for (const tier of ['ultra', 'high', 'medium', 'low'] as Tier[]) {
      const s = TIER_SETTINGS[tier];
      expect(s.dpr).toBeGreaterThan(0);
      expect(s.surfaceSegments).toBeGreaterThan(0);
      expect(s.ambientParticles).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches the PRD ladder values (Ultra→Low)', () => {
    expect(TIER_SETTINGS.ultra.dpr).toBe(2.0);
    expect(TIER_SETTINGS.ultra.surfaceSegments).toBe(192);
    expect(TIER_SETTINGS.ultra.ambientParticles).toBe(65536);
    expect(TIER_SETTINGS.high.surfaceSegments).toBe(128);
    expect(TIER_SETTINGS.medium.surfaceSegments).toBe(80);
    expect(TIER_SETTINGS.low.surfaceSegments).toBe(48);
    expect(TIER_SETTINGS.fallback.mountCanvas).toBe(false);
  });
});
