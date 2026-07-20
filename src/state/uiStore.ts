import { create } from 'zustand';
import type { OptimizerId } from '../engine/types';
import type { Tier } from '../quality/tiers';
import { detectQualityProfile } from '../quality/detectTier';

export type RunOutcome = 'active' | 'converged' | 'diverged';

/** Channel A — slow, reactive UI state. Changes rarely; may trigger React
 *  re-renders. NEVER written to per simulation frame (that's Channel B). */
export interface UIState {
  functionId: string;
  optimizerId: OptimizerId;
  learningRate: number;
  isPlaying: boolean;
  tier: Tier;
  qualityCeiling: Exclude<Tier, 'fallback'>;
  runOutcome: RunOutcome;
  startPoint: readonly [number, number];
  runRevision: number;
  stepRequest: number;
  cameraResetRequest: number;

  setFunctionId: (id: string) => void;
  setOptimizerId: (id: OptimizerId) => void;
  setLearningRate: (lr: number) => void;
  setPlaying: (playing: boolean) => void;
  setTier: (tier: Tier) => void;
  setRunOutcome: (outcome: RunOutcome) => void;
  setStartPoint: (p: readonly [number, number]) => void;
  stepOnce: () => void;
  resetCameraView: () => void;
  restart: () => void;
  reset: () => void;
}

const QUALITY = detectQualityProfile();

const INITIAL = {
  functionId: 'sphere',
  optimizerId: 'sgd' as OptimizerId,
  learningRate: 0.1,
  isPlaying: false,
  tier: QUALITY.initialTier as Tier,
  qualityCeiling: QUALITY.ceiling,
  runOutcome: 'active' as RunOutcome,
  startPoint: [3.5, -2.5] as const,
  stepRequest: 0,
  cameraResetRequest: 0,
};

export const useUIStore = create<UIState>((set) => ({
  ...INITIAL,
  runRevision: 0,
  setFunctionId: (functionId) => set({ functionId, isPlaying: false, runOutcome: 'active' }),
  setOptimizerId: (optimizerId) => set({ optimizerId, isPlaying: false, runOutcome: 'active' }),
  setLearningRate: (learningRate) =>
    set({
      learningRate: Math.max(1e-9, learningRate),
      isPlaying: false,
      runOutcome: 'active',
    }),
  setPlaying: (isPlaying) =>
    set((state) => ({
      isPlaying: isPlaying && state.runOutcome !== 'active' ? false : isPlaying,
    })),
  setTier: (tier) => set({ tier }),
  setRunOutcome: (runOutcome) =>
    set((state) => ({
      runOutcome,
      isPlaying: runOutcome === 'active' ? state.isPlaying : false,
    })),
  setStartPoint: (startPoint) => set({ startPoint, isPlaying: false, runOutcome: 'active' }),
  stepOnce: () =>
    set((state) =>
      state.runOutcome === 'active'
        ? {
            isPlaying: false,
            stepRequest: state.stepRequest + 1,
          }
        : state,
    ),
  resetCameraView: () =>
    set((state) => ({
      cameraResetRequest: state.cameraResetRequest + 1,
    })),
  restart: () =>
    set((state) => ({
      isPlaying: false,
      runOutcome: 'active',
      runRevision: state.runRevision + 1,
    })),
  reset: () =>
    set((state) => ({
      ...INITIAL,
      runRevision: state.runRevision + 1,
    })),
}));
