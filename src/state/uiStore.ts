import { create } from 'zustand';
import type { OptimizerId } from '../engine/types';
import type { Tier } from '../quality/tiers';

/** Channel A — slow, reactive UI state. Changes rarely; may trigger React
 *  re-renders. NEVER written to per simulation frame (that's Channel B). */
export interface UIState {
  functionId: string;
  optimizerId: OptimizerId;
  learningRate: number;
  isPlaying: boolean;
  tier: Tier;
  startPoint: readonly [number, number];

  setFunctionId: (id: string) => void;
  setOptimizerId: (id: OptimizerId) => void;
  setLearningRate: (lr: number) => void;
  setPlaying: (playing: boolean) => void;
  setTier: (tier: Tier) => void;
  setStartPoint: (p: readonly [number, number]) => void;
  reset: () => void;
}

const INITIAL = {
  functionId: 'rosenbrock',
  optimizerId: 'sgd' as OptimizerId,
  // 0.002, not 0.1: SGD at 0.1 on Rosenbrock from (-1.2,1) diverges in ~5 steps
  // (the gradient there is ≈(-216,-88), so a 0.1 step overshoots off the surface).
  // 0.002 gives a smooth, monotonic descent down the valley — a good first-run
  // default. The divergence story is still one slider-crank away (PRD §4.5).
  // Verified live in the browser at M1a Task 15.
  learningRate: 0.002,
  isPlaying: false,
  tier: 'high' as Tier,
  startPoint: [-1.2, 1] as const,
};

export const useUIStore = create<UIState>((set) => ({
  ...INITIAL,
  setFunctionId: (functionId) => set({ functionId }),
  setOptimizerId: (optimizerId) => set({ optimizerId }),
  setLearningRate: (learningRate) => set({ learningRate: Math.max(1e-9, learningRate) }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setTier: (tier) => set({ tier }),
  setStartPoint: (startPoint) => set({ startPoint }),
  reset: () => set({ ...INITIAL }),
}));
