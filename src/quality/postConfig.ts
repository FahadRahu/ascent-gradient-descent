import type { Tier } from './tiers';
import { SMAAPreset } from 'postprocessing';

/**
 * Per-tier post-processing configuration (spec §5.4 tier shape) — the sibling of
 * tiers.ts for the cinematic layer: which effects mount and their tier-varied
 * params. Pure data + the SMAAPreset enum (a plain number at runtime), so it is
 * fully unit-testable with no Three/React imports. PostStack.tsx reads
 * POST_CONFIG[tier] and renders accordingly.
 *
 * THE TIER LADDER (spec §5.4):
 *   ultra  — full stack, SMAA ULTRA, N8AO no halfRes + 'ultra', DOF on.
 *   high   — baseline full stack, SMAA HIGH, N8AO halfRes + 'medium', DOF on.
 *   medium — DOF OFF, smaller bloom, N8AO 'low' + halfRes.
 *   low    — NO composer (renderer AGX + emissive-mesh fake glow).
 *   fallback — NO composer (the Canvas never mounts; kept consistent).
 *
 * Bloom luminanceThreshold/luminanceSmoothing/radius/mipmapBlur are tier-invariant
 * (the selective-glow contract) and live directly in PostStack; only intensity/
 * levels vary per tier.
 */

/** N8AO quality presets recompile shaders → set once per tier, never per frame. */
export type N8AOQuality = 'performance' | 'low' | 'medium' | 'high' | 'ultra';

export interface PostTierConfig {
  /** Whether to mount the <EffectComposer> subtree. false → renderer-AGX path. */
  mountComposer: boolean;
  /** Antialiasing preset for <SMAA>. */
  smaaPreset: SMAAPreset;
  n8ao: {
    quality: N8AOQuality; // recompiles — static per tier
    halfRes: boolean; // recompiles — static per tier
  };
  bloom: {
    intensity: number;
    levels: number;
  };
  /** Whether <DepthOfField> mounts this tier (Medium and below turn DOF off). */
  dof: boolean;
}

export const POST_CONFIG: Record<Tier, PostTierConfig> = {
  ultra: {
    mountComposer: true,
    smaaPreset: SMAAPreset.ULTRA,
    n8ao: { quality: 'ultra', halfRes: false },
    bloom: { intensity: 0.9, levels: 9 },
    dof: false,
  },
  high: {
    mountComposer: true,
    smaaPreset: SMAAPreset.HIGH,
    n8ao: { quality: 'high', halfRes: false },
    bloom: { intensity: 0.75, levels: 8 },
    dof: false,
  },
  medium: {
    mountComposer: true,
    smaaPreset: SMAAPreset.HIGH,
    n8ao: { quality: 'low', halfRes: true },
    bloom: { intensity: 0.55, levels: 6 }, // smaller bloom (spec §5.4)
    dof: false, // DOF OFF at Medium
  },
  low: {
    mountComposer: false, // renderer-AGX path + emissive-mesh fake glow
    smaaPreset: SMAAPreset.LOW,
    n8ao: { quality: 'performance', halfRes: true },
    bloom: { intensity: 0, levels: 0 },
    dof: false,
  },
  fallback: {
    mountComposer: false, // Canvas never mounts (mountCanvas=false); moot but consistent
    smaaPreset: SMAAPreset.LOW,
    n8ao: { quality: 'performance', halfRes: true },
    bloom: { intensity: 0, levels: 0 },
    dof: false,
  },
};
