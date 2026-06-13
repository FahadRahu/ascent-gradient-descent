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
  ultra: { dpr: 2.0, surfaceSegments: 128, ambientParticles: 65536, semanticAgents: 2048, shadowMapSize: 4096, mountCanvas: true },
  high: { dpr: 1.75, surfaceSegments: 64, ambientParticles: 30000, semanticAgents: 512, shadowMapSize: 2048, mountCanvas: true },
  medium: { dpr: 1.25, surfaceSegments: 48, ambientParticles: 12000, semanticAgents: 128, shadowMapSize: 1024, mountCanvas: true },
  low: { dpr: 1.0, surfaceSegments: 32, ambientParticles: 3000, semanticAgents: 0, shadowMapSize: 0, mountCanvas: true },
  fallback: { dpr: 1.0, surfaceSegments: 0, ambientParticles: 0, semanticAgents: 0, shadowMapSize: 0, mountCanvas: false },
};
