import { useEffect, useRef } from 'react';
import { getSimRunnerHandle } from '../scene/useSimRunner';
import { simStore } from '../state/simStore';
import { HelpTooltip } from './HelpTooltip';

const CHART_PADDING = { top: 10, right: 10, bottom: 12, left: 8 };

export function LossChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      const history = getSimRunnerHandle().history.filter(
        (entry) => Number.isFinite(entry.cost) && entry.cost >= 0,
      );

      const plotWidth = width - CHART_PADDING.left - CHART_PADDING.right;
      const plotHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

      context.strokeStyle = gridColor;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(CHART_PADDING.left, CHART_PADDING.top + plotHeight);
      context.lineTo(CHART_PADDING.left + plotWidth, CHART_PADDING.top + plotHeight);
      context.stroke();

      if (history.length < 2) return;

      const maxPoints = Math.max(2, Math.floor(plotWidth));
      const stride = Math.max(1, Math.ceil(history.length / maxPoints));
      const sampled = history.filter(
        (_, index) => index % stride === 0 || index === history.length - 1,
      );
      const logCosts = sampled.map((entry) => Math.log10(Math.max(entry.cost, 1e-12)));
      let minLog = Math.min(...logCosts);
      let maxLog = Math.max(...logCosts);
      if (Math.abs(maxLog - minLog) < 0.001) {
        minLog -= 0.5;
        maxLog += 0.5;
      }

      const firstIteration = sampled[0].iteration;
      const lastIteration = sampled[sampled.length - 1].iteration;
      const iterationSpan = Math.max(lastIteration - firstIteration, 1);
      const points = sampled.map((entry, index) => ({
        x:
          CHART_PADDING.left +
          ((entry.iteration - firstIteration) / iterationSpan) * plotWidth,
        y:
          CHART_PADDING.top +
          (1 - (logCosts[index] - minLog) / (maxLog - minLog)) * plotHeight,
      }));

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index].x, points[index].y);
      }
      context.lineTo(points[points.length - 1].x, CHART_PADDING.top + plotHeight);
      context.lineTo(points[0].x, CHART_PADDING.top + plotHeight);
      context.closePath();
      context.fillStyle = fillColor;
      context.fill();

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

  return (
    <figure className="loss-chart">
      <figcaption>
        <span className="explained-label">
          <span>Loss history</span>
          <HelpTooltip
            id="loss-history-help"
            label="Loss history"
            description="Plots cost after each iteration. A downward line means prediction error is shrinking. The log scale keeps large and tiny changes visible."
            side="top"
          />
        </span>
        <span className="chart-scale">log scale</span>
      </figcaption>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Loss over the retained optimization iterations"
      >
        Loss over optimization iterations.
      </canvas>
    </figure>
  );
}
