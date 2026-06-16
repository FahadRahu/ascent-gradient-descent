import { POST_CONFIG } from './postConfig';
import { TIERS } from './tiers';
import { SMAAPreset } from 'postprocessing';

describe('POST_CONFIG — per-tier post-processing config', () => {
  it('has an entry for every Tier', () => {
    for (const t of TIERS) {
      expect(POST_CONFIG[t]).toBeDefined();
    }
  });

  it('mounts a composer for ultra/high/medium only', () => {
    expect(POST_CONFIG.ultra.mountComposer).toBe(true);
    expect(POST_CONFIG.high.mountComposer).toBe(true);
    expect(POST_CONFIG.medium.mountComposer).toBe(true);
    expect(POST_CONFIG.low.mountComposer).toBe(false);
    expect(POST_CONFIG.fallback.mountComposer).toBe(false);
  });

  it('turns DOF off at medium and below, on at high/ultra', () => {
    expect(POST_CONFIG.ultra.dof).toBe(true);
    expect(POST_CONFIG.high.dof).toBe(true);
    expect(POST_CONFIG.medium.dof).toBe(false);
    expect(POST_CONFIG.low.dof).toBe(false);
  });

  it('uses SMAA ULTRA at ultra, HIGH at high/medium', () => {
    expect(POST_CONFIG.ultra.smaaPreset).toBe(SMAAPreset.ULTRA);
    expect(POST_CONFIG.high.smaaPreset).toBe(SMAAPreset.HIGH);
    expect(POST_CONFIG.medium.smaaPreset).toBe(SMAAPreset.HIGH);
  });

  it('disables N8AO halfRes only at ultra', () => {
    expect(POST_CONFIG.ultra.n8ao.halfRes).toBe(false);
    expect(POST_CONFIG.high.n8ao.halfRes).toBe(true);
    expect(POST_CONFIG.medium.n8ao.halfRes).toBe(true);
  });

  it('scales bloom down at medium vs high', () => {
    expect(POST_CONFIG.high.bloom.intensity).toBeGreaterThan(0);
    expect(POST_CONFIG.medium.bloom.intensity).toBeLessThan(POST_CONFIG.high.bloom.intensity);
  });
});
