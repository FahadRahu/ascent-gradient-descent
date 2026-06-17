/**
 * The hero-beat state machine (spec §5.6 / PRD §5.5). Pure — no Three/React.
 * Phases (~700ms total, success path):
 *   idle      — nothing happening (descent in progress / not yet armed)
 *   approach  — arrival imminent: ~APPROACH_MS lead-in while the halo bleeds toward
 *               cyan (PRD §5.5 stage 1, "the last ~1s") — a TIMED phase
 *   touchdown — ~250ms TIMED white-hot flash + cyan halo + bloom flare + DOF rack
 *   settle    — relax to a steady cyan beacon + ignite the lone ember ring (seek)
 *   diverged  — terminal failure: fuchsia halo + dimming core (the visual opposite)
 *
 * `t` is 0..1 progress within a TIMED phase (touchdown). `approach` also accumulates
 * elapsedMs toward APPROACH_MS. Advanced once per frame with the elapsed dtMs. A
 * runId change resets to idle (a new descent).
 */

export type HeroPhase = 'idle' | 'approach' | 'touchdown' | 'settle' | 'diverged';

/** Touchdown flash duration (PRD §5.5: "over ~250ms"). */
export const TOUCHDOWN_MS = 250;
/** Approach lead-in duration — the PRD §5.5 stage-1 "last ~1s" cyan halo bleed.
 *  800ms reads as the spec's ~1s while keeping the whole beat near ~700ms+lead-in. */
export const APPROACH_MS = 800;

export interface HeroState {
  phase: HeroPhase;
  /** Accumulated ms within the current phase. */
  elapsedMs: number;
  /** 0..1 progress within a TIMED phase (touchdown). */
  t: number;
  /** One-shot latch: once the success beat begins it never re-fires this run. */
  fired: boolean;
  /** The run identity this state belongs to; a change resets the machine. */
  runId: string;
}

export function initialHeroState(runId: string): HeroState {
  return { phase: 'idle', elapsedMs: 0, t: 0, fired: false, runId };
}

export interface HeroSignals {
  arrived: boolean;
  diverged: boolean;
  runId: string;
}

/** Advance the machine by dtMs. Returns the NEXT state (caller stores it). */
export function advanceHero(prev: HeroState, sig: HeroSignals, dtMs: number): HeroState {
  // Run change → hard reset (new descent).
  if (sig.runId !== prev.runId) return initialHeroState(sig.runId);

  // Divergence overrides everything (terminal). Latch into 'diverged' and stay.
  if (sig.diverged) {
    if (prev.phase === 'diverged') return { ...prev, elapsedMs: prev.elapsedMs + dtMs };
    return { phase: 'diverged', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
  }

  switch (prev.phase) {
    case 'idle':
      if (!prev.fired && sig.arrived) {
        return { phase: 'approach', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
      }
      return prev;
    case 'approach': {
      // Timed lead-in (PRD §5.5 stage 1, ~1s): accumulate, bleed the halo cyan,
      // then transition to the flash once APPROACH_MS elapses.
      const elapsedMs = prev.elapsedMs + dtMs;
      if (elapsedMs >= APPROACH_MS) {
        return { phase: 'touchdown', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
      }
      return { phase: 'approach', elapsedMs, t: 0, fired: true, runId: prev.runId };
    }
    case 'touchdown': {
      const elapsedMs = prev.elapsedMs + dtMs;
      const t = Math.min(elapsedMs / TOUCHDOWN_MS, 1);
      if (t >= 1) return { phase: 'settle', elapsedMs: 0, t: 0, fired: true, runId: prev.runId };
      return { phase: 'touchdown', elapsedMs, t, fired: true, runId: prev.runId };
    }
    case 'settle':
    case 'diverged':
      return { ...prev, elapsedMs: prev.elapsedMs + dtMs };
    default:
      return prev;
  }
}

/** True while the machine still needs frames flowing (drives invalidate()). */
export function heroNeedsFrames(state: HeroState, settleHoldMs = 1500): boolean {
  if (state.phase === 'idle') return false;
  if (state.phase === 'settle' || state.phase === 'diverged') return state.elapsedMs < settleHoldMs;
  return true; // approach / touchdown always animate
}
