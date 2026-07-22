import { useEffect, useRef, type ChangeEvent } from 'react';
import {
  Activity,
  ArrowRight,
  ChevronDown,
  CircleCheck,
  Crosshair,
  Gauge,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  StepForward,
} from 'lucide-react';
import { FUNCTIONS, getFunction } from '../engine/functions/registry';
import {
  OPTIMIZER_DEFAULTS,
  OPTIMIZER_IDS,
} from '../engine/optimizers/registry';
import type { OptimizerId } from '../engine/types';
import { goalCostForFunction } from '../engine/goal';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getSimRunnerHandle } from '../state/simHistory';
import { classifyCostStep, type CostStepState } from './costFeedback';
import { HelpTooltip } from './HelpTooltip';
import { LossChart } from './LossChart';
import type { GraphicsStatus } from './GraphicsState';

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

function formatCost(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const magnitude = Math.abs(value);
  if (magnitude >= 1000 || (magnitude > 0 && magnitude < 0.01)) {
    return value.toExponential(2);
  }
  return value.toFixed(2);
}

interface LiveSignalProps {
  functionId: string;
  isPlaying: boolean;
  runOutcome: 'active' | 'converged' | 'diverged';
  graphicsStatus: GraphicsStatus;
}

function LiveSignal({
  functionId,
  isPlaying,
  runOutcome,
  graphicsStatus,
}: LiveSignalProps) {
  const thetaRef = useRef<HTMLOutputElement>(null);
  const gradientRef = useRef<HTMLOutputElement>(null);
  const costRef = useRef<HTMLOutputElement>(null);
  const iterationRef = useRef<HTMLOutputElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const stepResultRef = useRef<HTMLDivElement>(null);
  const stepBeforeRef = useRef<HTMLOutputElement>(null);
  const stepAfterRef = useRef<HTMLOutputElement>(null);
  const goalCostRef = useRef<HTMLOutputElement>(null);
  const stepMessageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let pendingFrame = 0;
    const fn = getFunction(functionId);

    const update = () => {
      pendingFrame = 0;
      if (graphicsStatus !== 'ready') {
        const status = graphicsStatus === 'loading' ? 'Loading' : 'Unavailable';
        if (thetaRef.current) thetaRef.current.textContent = '(--, --)';
        if (gradientRef.current) gradientRef.current.textContent = '(--, --)';
        if (costRef.current) costRef.current.textContent = '--';
        if (iterationRef.current) iterationRef.current.textContent = '0';
        if (stepBeforeRef.current) stepBeforeRef.current.textContent = '--';
        if (stepAfterRef.current) stepAfterRef.current.textContent = '--';
        if (goalCostRef.current) goalCostRef.current.textContent = '--';
        if (stepMessageRef.current) {
          stepMessageRef.current.textContent =
            graphicsStatus === 'loading'
              ? 'Preparing the interactive cost landscape.'
              : 'The optimization is paused because the graphics view is unavailable.';
        }
        if (stepResultRef.current) stepResultRef.current.dataset.state = 'ready';
        if (statusRef.current) {
          statusRef.current.textContent = status;
          statusRef.current.dataset.state = status.toLowerCase();
        }
        return;
      }

      const state = simStore.getState();
      const gradient = fn.grad(state.theta);
      const handle = getSimRunnerHandle();
      const history = handle.history;
      const currentEntry = history[history.length - 1];
      const previousEntry = history[history.length - 2];
      const goalCost = goalCostForFunction(fn);
      const feedback = classifyCostStep(
        previousEntry?.cost ?? null,
        currentEntry?.cost ?? state.cost,
        goalCost,
        state.diverged,
      );
      const status = runOutcome === 'diverged' || state.diverged
        ? 'Diverged'
        : runOutcome === 'converged' || feedback.state === 'reached'
          ? 'At minimum'
          : isPlaying
            ? 'Descending'
            : state.iteration > 0
              ? 'Paused'
              : 'Ready';

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
      if (stepBeforeRef.current) {
        stepBeforeRef.current.textContent = formatCost(
          previousEntry?.cost ?? currentEntry?.cost ?? state.cost,
        );
      }
      if (stepAfterRef.current) {
        stepAfterRef.current.textContent = previousEntry
          ? formatCost(currentEntry?.cost ?? state.cost)
          : '--';
      }
      if (goalCostRef.current) {
        goalCostRef.current.textContent = goalCost === null
          ? 'target varies'
          : formatCost(goalCost);
      }
      if (stepMessageRef.current) {
        const messages: Record<CostStepState, string> = {
          ready: 'Measure the objective, then take one downhill step.',
          decreased: `Cost decreased by ${formatCost(feedback.change)}. The objective improved.`,
          increased: `Cost increased by ${formatCost(feedback.change)}. The step moved uphill; the learning rate may be too high.`,
          unchanged: 'Cost barely changed. The objective surface may be nearly flat here.',
          reached: 'Minimum reached. The objective is within the goal tolerance.',
          diverged: 'The run diverged. Lower the learning rate, then reset.',
        };
        stepMessageRef.current.textContent = messages[feedback.state];
      }
      if (stepResultRef.current) {
        stepResultRef.current.dataset.state = feedback.state;
      }
      if (statusRef.current && statusRef.current.textContent !== status) {
        statusRef.current.textContent = status;
        statusRef.current.dataset.state = status.toLowerCase().replace(' ', '-');
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
  }, [functionId, graphicsStatus, isPlaying, runOutcome]);

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
      <div
        ref={stepResultRef}
        className="step-result"
        data-state="ready"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="step-result-heading">
          <span>Latest step</span>
          <span>Goal cost <output ref={goalCostRef}>--</output></span>
        </div>
        <div className="step-cost-change" aria-label="Cost before and after the latest step">
          <span>Cost <small>(objective)</small></span>
          <output ref={stepBeforeRef}>--</output>
          <ArrowRight size={14} aria-hidden="true" />
          <output ref={stepAfterRef}>--</output>
        </div>
        <p ref={stepMessageRef}>Measure the objective, then take one downhill step.</p>
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

export function Hud({ graphicsStatus }: { graphicsStatus: GraphicsStatus }) {
  const functionId = useUIStore((state) => state.functionId);
  const optimizerId = useUIStore((state) => state.optimizerId);
  const learningRate = useUIStore((state) => state.learningRate);
  const isPlaying = useUIStore((state) => state.isPlaying);
  const runOutcome = useUIStore((state) => state.runOutcome);
  const setFunctionId = useUIStore((state) => state.setFunctionId);
  const setOptimizerId = useUIStore((state) => state.setOptimizerId);
  const setLearningRate = useUIStore((state) => state.setLearningRate);
  const setPlaying = useUIStore((state) => state.setPlaying);
  const setStartPoint = useUIStore((state) => state.setStartPoint);
  const stepOnce = useUIStore((state) => state.stepOnce);
  const resetCameraView = useUIStore((state) => state.resetCameraView);
  const restart = useUIStore((state) => state.restart);
  const activeFunction = getFunction(functionId);
  const activeOptimizer = OPTIMIZER_META[optimizerId];
  const learningRateEnabled = optimizerId !== 'newton';
  const controlsReady = graphicsStatus === 'ready';
  const configurationEnabled = graphicsStatus !== 'unavailable';
  const runTerminal = runOutcome !== 'active';

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

      if (!controlsReady) return;

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
  }, [controlsReady]);

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

  const primaryLabel = graphicsStatus === 'loading'
    ? 'Loading view'
    : graphicsStatus === 'unavailable'
      ? 'Unavailable'
      : runOutcome === 'converged'
        ? 'Minimum reached'
        : runOutcome === 'diverged'
          ? 'Run stopped'
          : isPlaying
            ? 'Pause'
            : 'Run descent';

  return (
    <div className="hud-layer">
      <header className="brand-bar">
        <a className="brand-mark" href="#main-content" aria-label="Ascent home">
          <span className="brand-glyph" aria-hidden="true" />
          <span>ASCENT</span>
        </a>
        <span className="brand-context">Gradient descent lab</span>
        <nav className="brand-links" aria-label="Site">
          <a className="privacy-nav-link" href="/privacy">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Privacy</span>
          </a>
        </nav>
      </header>

      <section className="concept-panel" aria-labelledby="concept-title">
        <span className="eyebrow">The idea</span>
        <h1 id="concept-title">
          {functionId === 'saddle' ? 'See why saddles are tricky.' : 'Find the lowest point.'}
        </h1>
        <div className="cost-definition">
          <span>What is cost?</span>
          <p>
            <strong>Cost is the score gradient descent tries to lower.</strong> In
            machine learning it often averages prediction error. This lab uses
            simple mathematical surfaces as stand-ins for real loss landscapes.
          </p>
        </div>

        <div className="height-cost-cue">
          <div className="height-scale" aria-hidden="true">
            <span>High cost</span>
            <i><b /></i>
            <span>Low cost</span>
          </div>
          <p>
            <strong>Read the height</strong>
            Higher points mean a larger objective value. Moving downward means the
            optimizer is lowering cost.
          </p>
        </div>

        <div className="core-formula" aria-label="Gradient descent update rule">
          <span>&theta;<sub>t+1</sub></span>
          <span className="formula-equals">=</span>
          <span>&theta;<sub>t</sub></span>
          <span className="formula-operation">
            &minus; &eta;&nabla;J(&theta;<sub>t</sub>)
          </span>
          <HelpTooltip
            id="gradient-descent-formula-help"
            label="Gradient descent formula"
            description="Theta at t is the current position, theta at t+1 is the next position, eta is the learning rate or step size, and grad J is the uphill slope of the cost. Subtracting that slope moves the point downhill toward lower cost."
          />
        </div>

        <div className="learning-loop">
          <div className="learning-loop-heading">
            <span>Every iteration</span>
            <span>
              {functionId === 'saddle'
                ? 'Watch what happens without a minimum'
                : 'Repeat until the cost is low'}
            </span>
          </div>
          <ol aria-label="Gradient descent iteration loop">
            <li><span>01</span><strong>Measure slope</strong></li>
            <li><span>02</span><strong>Move downhill</strong></li>
            <li><span>03</span><strong>Check cost</strong></li>
            <li><span>04</span><strong>Repeat</strong></li>
          </ol>
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
              <strong>{functionId === 'saddle' ? 'Saddle point' : 'Minimum'}</strong>
              <p>
                {functionId === 'saddle'
                  ? 'The amber rings mark a stationary point, not a minimum.'
                  : 'The amber rings mark the target.'}
              </p>
            </div>
          </li>
        </ul>

        <LiveSignal
          functionId={functionId}
          isPlaying={isPlaying}
          runOutcome={runOutcome}
          graphicsStatus={graphicsStatus}
        />
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
              disabled={!configurationEnabled}
            >
              {FUNCTIONS.map((fn) => (
                <option key={fn.id} value={fn.id}>
                  {fn.id === 'saddle' ? `${fn.name} (advanced)` : fn.name}
                </option>
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
              disabled={!configurationEnabled}
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
          <div className="control-label-row">
            <label htmlFor="learning-rate">
              <span><Gauge size={15} aria-hidden="true" /> Learning rate</span>
            </label>
            <div className="control-label-actions">
              <HelpTooltip
                id="learning-rate-help"
                label="Learning rate"
                description="Controls step size. Small values move carefully but slowly; large values move faster but can overshoot the minimum or diverge."
              />
              <output htmlFor="learning-rate">
              {learningRateEnabled ? formatLearningRate(learningRate) : 'curvature'}
              </output>
            </div>
          </div>
          <input
            id="learning-rate"
            type="range"
            min="-5"
            max="-1"
            step="0.05"
            value={Math.log10(learningRate)}
            onChange={onLearningRateChange}
            disabled={!configurationEnabled || !learningRateEnabled}
          />
          <div className="range-labels" aria-hidden="true">
            <span>precise</span>
            <span>aggressive</span>
          </div>
        </div>

        <div className="optimizer-rule">
          <div className="explained-label">
            <span>Update rule</span>
            <HelpTooltip
              id="update-rule-help"
              label="Update rule"
              description="Turns the current parameters into the next ones. It subtracts the learning rate times the slope, moving the point downhill."
              side="top"
            />
          </div>
          <code>{activeOptimizer.rule}</code>
        </div>

        <LossChart />
      </aside>

      <div className="transport" role="group" aria-label="Simulation controls">
        <button
          type="button"
          className="primary-action"
          aria-pressed={isPlaying}
          disabled={!controlsReady || runTerminal}
          onClick={() => setPlaying(!isPlaying)}
        >
          {runOutcome === 'converged' ? (
            <CircleCheck size={17} aria-hidden="true" />
          ) : isPlaying ? (
            <Pause size={17} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={17} fill="currentColor" aria-hidden="true" />
          )}
          <span>{primaryLabel}</span>
        </button>
        <button
          type="button"
          className="secondary-action"
          aria-label="Advance one iteration"
          title="Advance exactly one iteration"
          disabled={!controlsReady || runTerminal}
          onClick={stepOnce}
        >
          <StepForward size={17} />
          <span>Step once</span>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Restart optimization"
          title="Restart optimization"
          disabled={!controlsReady}
          onClick={restart}
        >
          <RotateCcw size={17} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Reset camera view"
          title="Reset camera view"
          disabled={!controlsReady}
          onClick={resetCameraView}
        >
          <Crosshair size={17} />
        </button>
      </div>
    </div>
  );
}
