import { create } from 'zustand';
import type { OptimizerId } from '../engine/types';
import type { Tier } from '../quality/tiers';
import { detectQualityProfile } from '../quality/detectTier';

export type RunOutcome = 'active' | 'converged' | 'diverged';
export type PlaybackMode = 'live' | 'review';

export const DEFAULT_PLAYBACK_SPEED_MS = 250;

/** Channel A - slow, reactive UI state. Changes rarely; may trigger React
 *  re-renders. NEVER written to per simulation frame (that's Channel B). */
export interface UIState {
  functionId: string;
  optimizerId: OptimizerId;
  learningRate: number;
  isPlaying: boolean;
  mode: PlaybackMode;
  scrubIndex: number;
  playbackSpeedMs: number;
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
  selectHistoryIndex: (index: number, latestIndex: number) => void;
  stepHistory: (offset: number, latestIndex: number) => void;
  advanceReviewPlayback: (latestIndex: number) => void;
  setPlaybackSpeedMs: (speedMs: number) => void;
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
  mode: 'live' as PlaybackMode,
  scrubIndex: 0,
  playbackSpeedMs: DEFAULT_PLAYBACK_SPEED_MS,
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
  setFunctionId: (functionId) =>
    set({
      functionId,
      isPlaying: false,
      mode: 'live',
      scrubIndex: 0,
      runOutcome: 'active',
    }),
  setOptimizerId: (optimizerId) =>
    set({
      optimizerId,
      isPlaying: false,
      mode: 'live',
      scrubIndex: 0,
      runOutcome: 'active',
    }),
  setLearningRate: (learningRate) =>
    set({
      learningRate: Math.max(1e-9, learningRate),
      isPlaying: false,
      mode: 'live',
      scrubIndex: 0,
      runOutcome: 'active',
    }),
  setPlaying: (isPlaying) =>
    set((state) => ({
      isPlaying:
        isPlaying && state.mode === 'live' && state.runOutcome !== 'active'
          ? false
          : isPlaying,
    })),
  selectHistoryIndex: (index, latestIndex) =>
    set(() => {
      const latest = Math.max(0, latestIndex);
      const scrubIndex = Math.min(Math.max(0, index), latest);
      return {
        mode: scrubIndex < latest ? 'review' : 'live',
        scrubIndex,
        isPlaying: false,
      };
    }),
  stepHistory: (offset, latestIndex) =>
    set((state) => {
      const latest = Math.max(0, latestIndex);
      const current = state.mode === 'live' ? latest : state.scrubIndex;
      const scrubIndex = Math.min(Math.max(0, current + offset), latest);
      return {
        mode: scrubIndex < latest ? 'review' : 'live',
        scrubIndex,
        isPlaying: false,
      };
    }),
  advanceReviewPlayback: (latestIndex) =>
    set((state) => {
      if (state.mode !== 'review') return state;
      const latest = Math.max(0, latestIndex);
      const scrubIndex = Math.min(state.scrubIndex + 1, latest);
      return {
        mode: scrubIndex < latest ? 'review' : 'live',
        scrubIndex,
        isPlaying: scrubIndex < latest,
      };
    }),
  setPlaybackSpeedMs: (playbackSpeedMs) =>
    set({
      playbackSpeedMs: Number.isFinite(playbackSpeedMs)
        ? Math.min(500, Math.max(62.5, playbackSpeedMs))
        : DEFAULT_PLAYBACK_SPEED_MS,
    }),
  setTier: (tier) => set({ tier }),
  setRunOutcome: (runOutcome) =>
    set((state) => ({
      runOutcome,
      isPlaying: runOutcome === 'active' ? state.isPlaying : false,
    })),
  setStartPoint: (startPoint) =>
    set({
      startPoint,
      isPlaying: false,
      mode: 'live',
      scrubIndex: 0,
      runOutcome: 'active',
    }),
  stepOnce: () =>
    set((state) =>
      state.mode === 'live' && state.runOutcome === 'active'
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
      mode: 'live',
      scrubIndex: 0,
      runOutcome: 'active',
      runRevision: state.runRevision + 1,
    })),
  reset: () =>
    set((state) => ({
      ...INITIAL,
      runRevision: state.runRevision + 1,
    })),
}));
