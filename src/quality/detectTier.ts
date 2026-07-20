import type { Tier } from './tiers';

export interface DeviceSignals {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  devicePixelRatio: number;
  compactViewport: boolean;
  mobilePointer: boolean;
}

export interface QualityProfile {
  initialTier: Exclude<Tier, 'fallback'>;
  ceiling: Exclude<Tier, 'fallback'>;
}

export function chooseQualityProfile(signals: DeviceSignals): QualityProfile {
  const {
    deviceMemory,
    hardwareConcurrency,
    devicePixelRatio,
    compactViewport,
    mobilePointer,
  } = signals;
  const mobile = compactViewport || mobilePointer;

  if (
    (deviceMemory !== undefined && deviceMemory <= 2) ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= 2) ||
    (mobile && devicePixelRatio >= 2.5)
  ) {
    return { initialTier: 'low', ceiling: 'medium' };
  }

  if (
    mobile ||
    (deviceMemory !== undefined && deviceMemory <= 4) ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= 6)
  ) {
    return { initialTier: 'medium', ceiling: 'high' };
  }

  return { initialTier: 'high', ceiling: 'ultra' };
}

export function detectQualityProfile(): QualityProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { initialTier: 'high', ceiling: 'ultra' };
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  return chooseQualityProfile({
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    devicePixelRatio: window.devicePixelRatio || 1,
    compactViewport: window.innerWidth <= 820,
    mobilePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
  });
}
