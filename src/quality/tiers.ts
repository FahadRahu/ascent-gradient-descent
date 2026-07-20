/** Adaptive-quality tiers (PRD §9.1). Detection + PerformanceMonitor wiring is M1;
 *  M0 supplies only the type and the tier→settings data map. */
export type Tier = 'ultra' | 'high' | 'medium' | 'low' | 'fallback';

export const TIERS: readonly Tier[] = ['ultra', 'high', 'medium', 'low', 'fallback'];

export interface TierSettings {
  dpr: number;
  surfaceSegments: number;
  ambientParticles: number;
  semanticAgents: number;
  shadowMapSize: number;
  /** Whether to mount the R3F Canvas at all (false = WebGL error fallback). */
  mountCanvas: boolean;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  ultra: { dpr: 2.0, surfaceSegments: 192, ambientParticles: 65536, semanticAgents: 2048, shadowMapSize: 4096, mountCanvas: true },
  high: { dpr: 2.0, surfaceSegments: 128, ambientParticles: 30000, semanticAgents: 512, shadowMapSize: 2048, mountCanvas: true },
  medium: { dpr: 1.5, surfaceSegments: 80, ambientParticles: 12000, semanticAgents: 128, shadowMapSize: 1024, mountCanvas: true },
  low: { dpr: 1.25, surfaceSegments: 48, ambientParticles: 3000, semanticAgents: 0, shadowMapSize: 0, mountCanvas: true },
  fallback: { dpr: 1.0, surfaceSegments: 0, ambientParticles: 0, semanticAgents: 0, shadowMapSize: 0, mountCanvas: false },
};

const RENDER_TIERS: readonly Exclude<Tier, 'fallback'>[] = [
  'low',
  'medium',
  'high',
  'ultra',
];

export function lowerTier(tier: Tier): Exclude<Tier, 'fallback'> {
  if (tier === 'fallback') return 'low';
  const index = RENDER_TIERS.indexOf(tier);
  return RENDER_TIERS[Math.max(0, index - 1)];
}

export function higherTier(
  tier: Tier,
  ceiling: Exclude<Tier, 'fallback'>,
): Exclude<Tier, 'fallback'> {
  if (tier === 'fallback') return 'low';
  const index = RENDER_TIERS.indexOf(tier);
  const ceilingIndex = RENDER_TIERS.indexOf(ceiling);
  return RENDER_TIERS[Math.min(ceilingIndex, index + 1)];
}
