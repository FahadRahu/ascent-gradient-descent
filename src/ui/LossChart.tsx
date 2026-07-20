import { useEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '../engine/stepper';
import { getSimRunnerHandle } from '../state/simHistory';
import { simStore } from '../state/simStore';
import { HelpTooltip } from './HelpTooltip';

const CHART_PADDING = { top: 10, right: 10, bottom: 12, left: 8 };

interface AccessibleHistory {
  runId: number;
  entries: readonly HistoryEntry[];
}

export function signedLogCost(value: number): number {
  return Math.sign(value) * Math.log10(1 + Math.abs(value));
}

function formatCost(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1000 || (magnitude > 0 && magnitude < 0.001)) {
    return value.toExponential(2);
  }
  return value.toFixed(3);
}

export function summarizeLoss(history: readonly HistoryEntry[]): string {
  if (history.length === 0) return 'No optimization steps yet.';

  const first = history[0];
  const current = history[history.length - 1];
  if (history.length === 1) {
    return `Starting cost ${formatCost(current.cost)} at iteration ${current.iteration}.`;
  }

  const direction = current.cost < first.cost
    ? 'decreased'
    : current.cost > first.cost
      ? 'increased'
      : 'stayed unchanged';
  return `Cost ${direction} from ${formatCost(first.cost)} to ${formatCost(current.cost)} over ${current.iteration - first.iteration} iterations.`;
}

export function LossChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAccessibleSample = useRef({ runId: -1, iteration: -1 });
  const [accessibleHistory, setAccessibleHistory] = useState<AccessibleHistory>({
    runId: -1,
    entries: [],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let pendingFrame = 0;

    const draw = () => {
      pendingFrame = 0;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      const bufferWidth = Math.round(width * pixelRatio);
      const bufferHeight = Math.round(height * pixelRatio);

      if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
        canvas.width = bufferWidth;
        canvas.height = bufferHeight;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const styles = getComputedStyle(canvas);
      const gridColor = styles.getPropertyValue('--chart-grid').trim();
      const lineColor = styles.getPropertyValue('--chart-line').trim();
      const fillColor = styles.getPropertyValue('--chart-fill').trim();
      const handle = getSimRunnerHandle();
      const history = handle.history.filter((entry) =>
        Number.isFinite(entry.cost),
      );
      const currentIteration = history[history.length - 1]?.iteration ?? -1;

      if (
        handle.runId !== lastAccessibleSample.current.runId ||
        currentIteration !== lastAccessibleSample.current.iteration
      ) {
        lastAccessibleSample.current = {
          runId: handle.runId,
          iteration: currentIteration,
        };
        setAccessibleHistory({
          runId: handle.runId,
          entries: history.slice(-10),
        });
      }

      const plotWidth = width - CHART_PADDING.left - CHART_PADDING.right;
      const plotHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;
      if (history.length === 0) return;

      const maxPoints = Math.max(2, Math.floor(plotWidth));
      const stride = Math.max(1, Math.ceil(history.length / maxPoints));
      const sampled = history.filter(
        (_, index) => index % stride === 0 || index === history.length - 1,
      );
      const transformedCosts = sampled.map((entry) => signedLogCost(entry.cost));
      let minValue = Math.min(0, ...transformedCosts);
      let maxValue = Math.max(0, ...transformedCosts);
      if (Math.abs(maxValue - minValue) < 0.001) {
        minValue -= 0.5;
        maxValue += 0.5;
      }

      const valueSpan = maxValue - minValue;
      const yForValue = (value: number) =>
        CHART_PADDING.top + (1 - (value - minValue) / valueSpan) * plotHeight;
      const zeroY = yForValue(0);

      context.strokeStyle = gridColor;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(CHART_PADDING.left, zeroY);
      context.lineTo(CHART_PADDING.left + plotWidth, zeroY);
      context.stroke();

      const firstIteration = sampled[0].iteration;
      const lastIteration = sampled[sampled.length - 1].iteration;
      const iterationSpan = Math.max(lastIteration - firstIteration, 1);
      const points = sampled.map((entry, index) => ({
        x:
          CHART_PADDING.left +
          ((entry.iteration - firstIteration) / iterationSpan) * plotWidth,
        y: yForValue(transformedCosts[index]),
      }));

      if (points.length >= 2) {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) {
          context.lineTo(points[index].x, points[index].y);
        }
        context.lineTo(points[points.length - 1].x, zeroY);
        context.lineTo(points[0].x, zeroY);
        context.closePath();
        context.fillStyle = fillColor;
        context.fill();
      }

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index].x, points[index].y);
      }
      context.strokeStyle = lineColor;
      context.lineWidth = 1.75;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();

      const current = points[points.length - 1];
      context.beginPath();
      context.arc(current.x, current.y, 3, 0, Math.PI * 2);
      context.fillStyle = lineColor;
      context.fill();
    };

    const scheduleDraw = () => {
      if (pendingFrame === 0) pendingFrame = window.requestAnimationFrame(draw);
    };

    const unsubscribe = simStore.subscribe(scheduleDraw);
    const resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(canvas);
    scheduleDraw();

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
      if (pendingFrame !== 0) window.cancelAnimationFrame(pendingFrame);
    };
  }, []);

  const summary = summarizeLoss(accessibleHistory.entries);

  return (
    <figure className="loss-chart">
      <figcaption>
        <span className="explained-label">
          <span>Loss history</span>
          <HelpTooltip
            id="loss-history-help"
            label="Loss history"
            description="Plots cost after each iteration. Downward movement means the objective is shrinking. A symmetric log scale keeps positive, negative, large, and tiny values visible."
            side="top"
          />
        </span>
        <span className="chart-scale">symlog scale</span>
      </figcaption>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Cost over the retained optimization iterations"
        aria-describedby="loss-history-summary"
      >
        Cost over optimization iterations.
      </canvas>
      <p
        id="loss-history-summary"
        className="chart-summary"
        data-run-id={accessibleHistory.runId}
        aria-live="polite"
      >
        {summary}
      </p>
      <table className="sr-only">
        <caption>Ten most recent loss history values</caption>
        <thead>
          <tr>
            <th scope="col">Iteration</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {accessibleHistory.entries.map((entry) => (
            <tr key={entry.iteration}>
              <td>{entry.iteration}</td>
              <td>{formatCost(entry.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
