import { useEffect, useRef, type ChangeEvent } from 'react';
import {
  Activity,
  ChevronDown,
  Gauge,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { FUNCTIONS, getFunction } from '../engine/functions/registry';
import {
  OPTIMIZER_DEFAULTS,
  OPTIMIZER_IDS,
} from '../engine/optimizers/registry';
import type { OptimizerId } from '../engine/types';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { LossChart } from './LossChart';

const START_POINTS: Record<string, readonly [number, number]> = {
  sphere: [3.5, -2.5],
  matyas: [-7, 6],
  booth: [-4, -6],
  rosenbrock: [-1.2, 1],
  beale: [-3.5, -2.5],
  saddle: [1.8, 1.2],
  himmelblau: [-4, 0],
  rastrigin: [3.8, 3.2],
  ackley: [3.2, -2.7],
};

const OPTIMIZER_META: Record<
  OptimizerId,
  { label: string; rule: string; note: string }
> = {
  sgd: {
    label: 'Gradient descent',
    rule: 'theta[t+1] = theta[t] - eta * grad J',
    note: 'Takes the local downhill direction literally.',
  },
  momentum: {
    label: 'Momentum',
    rule: 'v[t] = gamma * v[t-1] + eta * grad J',
    note: 'Carries velocity through shallow or noisy terrain.',
  },
  nesterov: {
    label: 'Nesterov',
    rule: 'grad J is measured at the look-ahead point',
    note: 'Checks the slope where momentum is about to land.',
  },
  adagrad: {
    label: 'AdaGrad',
    rule: 'eta is scaled by accumulated squared gradients',
    note: 'Shrinks each axis independently as evidence builds.',
  },
  rmsprop: {
    label: 'RMSProp',
    rule: 'eta is scaled by a moving gradient average',
    note: 'Forgets old gradients so learning does not stall.',
  },
  adam: {
    label: 'Adam',
    rule: 'momentum + adaptive per-axis step sizes',
    note: 'Combines direction memory with adaptive scaling.',
  },
  adamw: {
    label: 'AdamW',
    rule: 'Adam update + decoupled weight decay',
    note: 'Adds a separate pull toward smaller parameters.',
  },
  nadam: {
    label: 'Nadam',
    rule: 'Adam with a Nesterov look-ahead',
    note: 'Anticipates the next direction before committing.',
  },
  newton: {
    label: 'Newton',
    rule: 'theta[t+1] = theta[t] - inverse(H) * grad J',
    note: 'Uses curvature; it can seek saddles on non-convex terrain.',
  },
};

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const magnitude = Math.abs(value);
  if (magnitude === 0) return '0.000';
  if (magnitude >= 1000 || magnitude < 0.001) return value.toExponential(2);
  return value.toFixed(3);
}

function formatLearningRate(value: number): string {
  if (value < 0.001) return value.toExponential(1);
  return value.toFixed(value < 0.01 ? 4 : 3);
}

interface LiveSignalProps {
  functionId: string;
  isPlaying: boolean;
}

function LiveSignal({ functionId, isPlaying }: LiveSignalProps) {
  const thetaRef = useRef<HTMLOutputElement>(null);
  const gradientRef = useRef<HTMLOutputElement>(null);
  const costRef = useRef<HTMLOutputElement>(null);
  const iterationRef = useRef<HTMLOutputElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let pendingFrame = 0;
    const fn = getFunction(functionId);

    const update = () => {
      pendingFrame = 0;
      const state = simStore.getState();
      const gradient = fn.grad(state.theta);
      const status = state.diverged ? 'Diverged' : isPlaying ? 'Descending' : 'Ready';

      if (thetaRef.current) {
        thetaRef.current.textContent = `(${formatNumber(state.theta[0])}, ${formatNumber(state.theta[1])})`;
      }
      if (gradientRef.current) {
        gradientRef.current.textContent = `(${formatNumber(gradient[0])}, ${formatNumber(gradient[1])})`;
      }
      if (costRef.current) costRef.current.textContent = formatNumber(state.cost);
      if (iterationRef.current) {
        iterationRef.current.textContent = state.iteration.toLocaleString();
      }
      if (statusRef.current && statusRef.current.textContent !== status) {
        statusRef.current.textContent = status;
        statusRef.current.dataset.state = status.toLowerCase();
      }
    };

    const scheduleUpdate = () => {
      if (pendingFrame === 0) pendingFrame = window.requestAnimationFrame(update);
    };

    const unsubscribe = simStore.subscribe(scheduleUpdate);
    scheduleUpdate();

    return () => {
      unsubscribe();
      if (pendingFrame !== 0) window.cancelAnimationFrame(pendingFrame);
    };
  }, [functionId, isPlaying]);

  return (
    <section className="live-signal" aria-labelledby="live-signal-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Live signal</span>
          <h2 id="live-signal-title">What the optimizer sees</h2>
        </div>
        <span ref={statusRef} className="run-status" role="status">
          Ready
        </span>
      </div>
      <dl className="metrics-grid">
        <div>
          <dt>Position</dt>
          <dd><output ref={thetaRef}>(--, --)</output></dd>
        </div>
        <div>
          <dt>Gradient</dt>
          <dd><output ref={gradientRef}>(--, --)</output></dd>
        </div>
        <div>
          <dt>Height / cost</dt>
          <dd><output ref={costRef}>--</output></dd>
        </div>
        <div>
          <dt>Iteration</dt>
          <dd><output ref={iterationRef}>0</output></dd>
        </div>
      </dl>
    </section>
  );
}

export function Hud() {
  const functionId = useUIStore((state) => state.functionId);
  const optimizerId = useUIStore((state) => state.optimizerId);
  const learningRate = useUIStore((state) => state.learningRate);
  const isPlaying = useUIStore((state) => state.isPlaying);
  const setFunctionId = useUIStore((state) => state.setFunctionId);
  const setOptimizerId = useUIStore((state) => state.setOptimizerId);
  const setLearningRate = useUIStore((state) => state.setLearningRate);
  const setPlaying = useUIStore((state) => state.setPlaying);
  const setStartPoint = useUIStore((state) => state.setStartPoint);
  const restart = useUIStore((state) => state.restart);
  const activeFunction = getFunction(functionId);
  const activeOptimizer = OPTIMIZER_META[optimizerId];
  const learningRateEnabled = optimizerId !== 'newton';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (
        tagName === 'INPUT' ||
        tagName === 'SELECT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'BUTTON'
      ) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        const store = useUIStore.getState();
        store.setPlaying(!store.isPlaying);
      } else if (event.code === 'KeyR') {
        useUIStore.getState().restart();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onFunctionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setPlaying(false);
    setFunctionId(nextId);
    setStartPoint(START_POINTS[nextId] ?? getFunction(nextId).minima[0]);
  };

  const onOptimizerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value as OptimizerId;
    const defaults = OPTIMIZER_DEFAULTS[nextId];
    setPlaying(false);
    setOptimizerId(nextId);
    if ('lr' in defaults) setLearningRate(defaults.lr);
  };

  const onLearningRateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLearningRate(10 ** Number(event.target.value));
  };

  return (
    <div className="hud-layer">
      <header className="brand-bar">
        <a className="brand-mark" href="#main-content" aria-label="Ascent home">
          <span className="brand-glyph" aria-hidden="true" />
          <span>ASCENT</span>
        </a>
        <span className="brand-context">Gradient descent lab</span>
      </header>

      <section className="concept-panel" aria-labelledby="concept-title">
        <span className="eyebrow">The idea</span>
        <h1 id="concept-title">Find the lowest point.</h1>
        <p className="concept-copy">
          Surface height is loss. The cyan point is the current parameter setting;
          each update follows the amber downhill direction.
        </p>

        <div className="height-cost-cue">
          <div className="height-scale" aria-hidden="true">
            <span>High cost</span>
            <i><b /></i>
            <span>Low cost</span>
          </div>
          <p>
            <strong>Read the height</strong>
            Moving downward means the optimizer is reducing cost.
          </p>
        </div>

        <div className="core-formula" aria-label="Gradient descent update rule">
          <span>&theta;<sub>t+1</sub></span>
          <span className="formula-equals">=</span>
          <span>&theta;<sub>t</sub></span>
          <span className="formula-operation">
            &minus; &eta;&nabla;J(&theta;<sub>t</sub>)
          </span>
        </div>

        <ul className="scene-legend" aria-label="Visualization legend">
          <li>
            <span className="legend-swatch current" aria-hidden="true" />
            <div>
              <strong>Current point</strong>
              <p>The parameters being optimized now.</p>
            </div>
          </li>
          <li>
            <span className="legend-swatch direction" aria-hidden="true" />
            <div>
              <strong>Downhill direction</strong>
              <p>The negative gradient at this point.</p>
            </div>
          </li>
          <li>
            <span className="legend-swatch history" aria-hidden="true" />
            <div>
              <strong>Completed steps</strong>
              <p>Each white bead is one optimizer update.</p>
            </div>
          </li>
          <li>
            <span className="legend-swatch target" aria-hidden="true" />
            <div>
              <strong>Minimum</strong>
              <p>The amber rings mark the target.</p>
            </div>
          </li>
        </ul>

        <LiveSignal functionId={functionId} isPlaying={isPlaying} />
      </section>

      <aside className="control-panel" aria-labelledby="setup-title">
        <div className="section-heading control-heading">
          <div>
            <span className="section-kicker">Experiment</span>
            <h2 id="setup-title">Run setup</h2>
          </div>
          <Activity size={18} aria-hidden="true" />
        </div>

        <div className="control-group">
          <label htmlFor="landscape-select">
            <span><MapIcon size={15} aria-hidden="true" /> Landscape</span>
          </label>
          <div className="select-shell">
            <select
              id="landscape-select"
              value={functionId}
              onChange={onFunctionChange}
            >
              {FUNCTIONS.map((fn) => (
                <option key={fn.id} value={fn.id}>{fn.name}</option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <p className="control-note">{activeFunction.teaches}</p>
        </div>

        <div className="control-group">
          <label htmlFor="optimizer-select">
            <span><Activity size={15} aria-hidden="true" /> Optimizer</span>
          </label>
          <div className="select-shell">
            <select
              id="optimizer-select"
              value={optimizerId}
              onChange={onOptimizerChange}
            >
              {OPTIMIZER_IDS.map((id) => (
                <option key={id} value={id}>{OPTIMIZER_META[id].label}</option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <p className="control-note">{activeOptimizer.note}</p>
        </div>

        <div className="control-group learning-rate-control">
          <label htmlFor="learning-rate">
            <span><Gauge size={15} aria-hidden="true" /> Learning rate</span>
            <output htmlFor="learning-rate">
              {learningRateEnabled ? formatLearningRate(learningRate) : 'curvature'}
            </output>
          </label>
          <input
            id="learning-rate"
            type="range"
            min="-5"
            max="-1"
            step="0.05"
            value={Math.log10(learningRate)}
            onChange={onLearningRateChange}
            disabled={!learningRateEnabled}
          />
          <div className="range-labels" aria-hidden="true">
            <span>precise</span>
            <span>aggressive</span>
          </div>
        </div>

        <div className="optimizer-rule">
          <span>Update rule</span>
          <code>{activeOptimizer.rule}</code>
        </div>

        <LossChart />
      </aside>

      <div className="transport" role="group" aria-label="Simulation controls">
        <button
          type="button"
          className="primary-action"
          aria-pressed={isPlaying}
          onClick={() => setPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          <span>{isPlaying ? 'Pause' : 'Run descent'}</span>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Reset current run"
          title="Reset current run"
          onClick={restart}
        >
          <RotateCcw size={17} />
        </button>
      </div>
    </div>
  );
}
