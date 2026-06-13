import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vec2 } from '../engine/types';

/** Channel B — fast, transient simulation state. Read via getState()/subscribe()
 *  into refs inside useFrame (PRD §8.2); the 3D objects are mutated directly.
 *  This is a VANILLA store (not a React hook) so reads/writes never schedule a
 *  React render. */
export interface SimState {
  theta: Vec2;
  iteration: number;
  cost: number;
  diverged: boolean;
  setTheta: (theta: Vec2) => void;
  setIteration: (iteration: number) => void;
  setCost: (cost: number) => void;
  setDiverged: (diverged: boolean) => void;
}

export const simStore = createStore<SimState>()(
  subscribeWithSelector((set) => ({
    theta: [0, 0],
    iteration: 0,
    cost: 0,
    diverged: false,
    setTheta: (theta) => set({ theta }),
    setIteration: (iteration) => set({ iteration }),
    setCost: (cost) => set({ cost }),
    setDiverged: (diverged) => set({ diverged }),
  })),
);
