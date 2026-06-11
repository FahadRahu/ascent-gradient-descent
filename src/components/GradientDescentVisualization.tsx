/**
 * GradientDescentVisualization Component
 *
 * A comprehensive interactive visualization demonstrating gradient descent
 * using Three.js for high-performance 3D rendering.
 *
 * FEATURES:
 * - DEFERRED LOADING: Three.js only loads when user clicks "Launch Demo"
 * - Camera preserves position during animation
 * - Camera preset buttons for different viewing angles
 * - Reset camera button to return to default view
 */

import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  TrendingDown,
  Loader2,
  Camera,
  Video,
  Eye,
  Compass,
  Sparkles,
  Box,
  AlertTriangle,
  Monitor,
  Smartphone,
  Zap,
  MousePointerClick,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';

// Mobile detection hook
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for touch device or small screen
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouchDevice && isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Define types locally to avoid importing from CostSurface3D (which would load Plotly)
interface GradientDescentPoint {
  w: number;
  b: number;
  cost: number;
  iteration: number;
}

// Result of gradient descent including divergence info
interface GradientDescentResult {
  path: GradientDescentPoint[];
  diverged: boolean;
  divergedAtIteration?: number;
}

// Threshold for detecting divergence (cost above this = diverging)
// Lowered from 1e6 to 1000 - if cost > 1000, gradient descent has clearly failed
// This prevents memory explosion from calculating huge Three.js coordinates
const DIVERGENCE_THRESHOLD = 1000;

// Step increase threshold - if cost increases by this factor, it's diverging
const DIVERGENCE_STEP_FACTOR = 5;

type CameraPreset = 'default' | 'top' | 'sideW' | 'sideB' | 'isometric';

// Lazy load Three.js visualization - only loaded when user clicks "Launch Demo"
const ThreeGradientDescent = lazy(() => import('./ThreeGradientDescent'));

/**
 * Smart number formatting for display
 * Handles very large, very small, and normal numbers gracefully
 * Uses scientific notation for numbers with 5+ digit integer parts
 */
function formatNumber(num: number | undefined | null, decimals: number = 4): string {
  if (num === null || num === undefined || isNaN(num)) return '—';

  // Handle infinity
  if (!isFinite(num)) return num > 0 ? '∞' : '-∞';

  // Handle very large numbers (5+ digit integer part → scientific notation)
  // e.g., 10000 → 1.00e+4, but 9999 → 9999.0000
  if (Math.abs(num) >= 10000) {
    return num.toExponential(2);
  }

  // Handle very small numbers (but not zero)
  if (Math.abs(num) < 0.0001 && num !== 0) {
    return num.toExponential(2);
  }

  // Normal numbers - fixed decimal places
  return num.toFixed(decimals);
}

// Sample training data for MSE cost function
// This shows gradient descent finding parameters that FIT DATA, not just go to zero
const SAMPLE_DATA = {
  X: [1.0, 2.0, 3.0, 4.0],
  y: [2.0, 4.0, 5.0, 4.5],
};

/**
 * Computes Mean Squared Error (MSE) cost for linear regression
 *
 * Formula: J(w,b) = (1/2m) × Σᵢ(w×xᵢ + b - yᵢ)²
 *
 * This shows how gradient descent finds parameters that minimize
 * prediction error on actual data. The optimal point is NOT at (0,0)!
 *
 * Optimal parameters: w ≈ 0.95, b ≈ 1.55, cost ≈ 0.1406
 */
function computeCost(w: number, b: number): number {
  const { X, y } = SAMPLE_DATA;
  const m = y.length;
  let totalCost = 0;

  for (let i = 0; i < m; i++) {
    const prediction = w * X[i] + b;
    const error = prediction - y[i];
    totalCost += error * error;
  }

  return totalCost / (2 * m);
}

/**
 * Computes gradients of the MSE cost function
 *
 * ∂J/∂w = (1/m) × Σᵢ(w×xᵢ + b - yᵢ) × xᵢ
 * ∂J/∂b = (1/m) × Σᵢ(w×xᵢ + b - yᵢ)
 */
function computeGradients(w: number, b: number): { dw: number; db: number } {
  const { X, y } = SAMPLE_DATA;
  const m = y.length;
  let dw = 0;
  let db = 0;

  for (let i = 0; i < m; i++) {
    const prediction = w * X[i] + b;
    const error = prediction - y[i];
    dw += error * X[i];
    db += error;
  }

  return {
    dw: dw / m,
    db: db / m,
  };
}

/**
 * Runs gradient descent and returns the full path with divergence detection
 */
function runGradientDescent(
  startW: number,
  startB: number,
  learningRate: number,
  maxIterations: number = 100,
  convergenceThreshold: number = 0.0001
): GradientDescentResult {
  const path: GradientDescentPoint[] = [];
  let w = startW;
  let b = startB;
  let diverged = false;
  let divergedAtIteration: number | undefined = undefined;

  for (let i = 0; i <= maxIterations; i++) {
    const cost = computeCost(w, b);
    path.push({ w, b, cost, iteration: i });

    // Check for divergence: cost exceeds threshold or is not finite
    if (cost > DIVERGENCE_THRESHOLD || !isFinite(cost)) {
      diverged = true;
      divergedAtIteration = i;
      break; // Stop computing - gradient descent has diverged
    }

    // Check for step divergence: cost increased by more than DIVERGENCE_STEP_FACTOR (5x)
    // This catches rapid explosions before they consume too much memory
    if (i > 0) {
      const prevCost = path[i - 1].cost;
      if (prevCost > 0 && cost > prevCost * DIVERGENCE_STEP_FACTOR) {
        diverged = true;
        divergedAtIteration = i;
        break; // Stop computing - gradient descent is exploding
      }
    }

    // Check for convergence
    if (i > 0 && Math.abs(path[i].cost - path[i - 1].cost) < convergenceThreshold) {
      break;
    }

    const { dw, db } = computeGradients(w, b);
    w = w - learningRate * dw;
    b = b - learningRate * db;
  }

  return { path, diverged, divergedAtIteration };
}

// Loading skeleton for visualization (shown while Three.js is downloading)
function VisualizationSkeleton() {
  return (
    <div
      className={cn(
        'w-full h-[min(350px,45vh)] sm:h-[min(400px,50vh)] flex flex-col items-center justify-center',
        'bg-gradient-to-br from-slate-100 to-slate-200',
        'dark:from-dark-700 dark:to-dark-800',
        'rounded-xl border border-slate-300 dark:border-transparent'
      )}
    >
      <Loader2 size={40} className="text-primary-600 dark:text-primary-500 animate-spin mb-3" />
      <p className="text-slate-700 dark:text-dark-300 font-medium text-sm sm:text-base">
        Loading 3D Visualization...
      </p>
      <p className="text-slate-500 dark:text-dark-500 text-xs sm:text-sm mt-1">
        Approx. 500KB total resources, ~30MB RAM
      </p>
    </div>
  );
}

// Placeholder shown before user launches the demo
function DemoPlaceholder({
  onLaunch,
  onLaunchMobile,
  isMobile,
}: {
  onLaunch: () => void;
  onLaunchMobile: () => void;
  isMobile: boolean;
}) {
  return (
    <div
      className={cn(
        'w-full min-h-[300px] sm:min-h-[350px] flex flex-col items-center justify-center',
        'bg-gradient-to-br from-primary-50 via-accent-50 to-primary-100',
        'dark:from-dark-800 dark:via-dark-750 dark:to-dark-700',
        'rounded-xl relative overflow-hidden py-6 sm:py-8'
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10 dark:opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary-500 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-accent-500 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary-400 rounded-full blur-3xl" />
      </div>

      {/* 3D Box Icon */}
      <div
        className={cn(
          'relative mb-4 sm:mb-6 p-4 sm:p-6 rounded-2xl',
          'bg-white/50 dark:bg-dark-800/50',
          'shadow-lg backdrop-blur-sm',
          'border border-white/20 dark:border-dark-600/50'
        )}
      >
        <Box size={48} className="sm:hidden text-primary-500" strokeWidth={1.5} />
        <Box size={64} className="hidden sm:block text-primary-500" strokeWidth={1.5} />
        <Sparkles
          size={20}
          className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 text-amber-500 animate-pulse"
        />
      </div>

      {/* Title and description */}
      <h4 className="text-lg sm:text-xl font-semibold text-dark-800 dark:text-white mb-1 sm:mb-2">
        Interactive 3D Visualization
      </h4>
      <p className="text-sm sm:text-base text-dark-500 dark:text-dark-400 text-center max-w-md mb-4 sm:mb-6 px-4">
        Explore the cost function landscape and watch gradient descent find the optimal parameters
        in real-time.
      </p>

      {/* Mobile Warning Banner */}
      {isMobile && (
        <div
          className={cn(
            'mx-4 mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl max-w-md',
            'bg-amber-100 dark:bg-amber-900/30',
            'border border-amber-300 dark:border-amber-700',
            'text-amber-800 dark:text-amber-200'
          )}
        >
          <div className="flex items-start gap-2 sm:gap-3">
            <Smartphone size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs sm:text-sm mb-1">📱 Mobile Device Detected</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                The 3D visualization works best on desktop browsers. On mobile, you may experience
                touch gesture conflicts and slower performance.
              </p>
              <p className="text-xs font-medium flex items-center gap-1">
                <Monitor size={14} />
                For the full experience, visit on a computer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feature badges - only show on desktop */}
      {!isMobile && (
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
          {['Rotate & Zoom', 'Adjustable Learning Rate', 'Multiple Camera Angles'].map(
            (feature) => (
              <span
                key={feature}
                className={cn(
                  'px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium',
                  'bg-white/70 dark:bg-dark-700/70',
                  'text-dark-600 dark:text-dark-300',
                  'border border-dark-200/50 dark:border-dark-600/50'
                )}
              >
                {feature}
              </span>
            )
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        {/* Primary Launch button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isMobile) {
              onLaunchMobile();
            } else {
              onLaunch();
            }
          }}
          className={cn(
            'flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-xl',
            'bg-gradient-to-r from-primary-500 to-accent-500',
            'hover:from-primary-600 hover:to-accent-600',
            'text-white font-semibold text-base sm:text-lg',
            'shadow-lg hover:shadow-xl',
            'transition-all duration-300',
            'hover:scale-[1.02] active:scale-[0.98]',
            'group cursor-pointer relative z-10',
            'not-prose'
          )}
          style={{ pointerEvents: 'auto' }}
        >
          <Play size={20} className="sm:hidden group-hover:scale-110 transition-transform" />
          <Play size={24} className="hidden sm:block group-hover:scale-110 transition-transform" />
          {isMobile ? 'Launch Simplified Demo' : 'Launch Interactive Demo'}
        </button>

        {/* Mobile: Option to try full 3D anyway */}
        {isMobile && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLaunch();
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
              'bg-white/50 dark:bg-dark-800/50',
              'text-dark-600 dark:text-dark-300',
              'border border-dark-200/50 dark:border-dark-600/50',
              'hover:bg-white/70 dark:hover:bg-dark-700/70',
              'transition-all duration-200',
              'cursor-pointer relative z-10',
              'not-prose'
            )}
            style={{ pointerEvents: 'auto' }}
          >
            <Box size={16} />
            Try full 3D anyway
          </button>
        )}
      </div>

      {/* Size notice */}
      <p className="mt-3 sm:mt-4 text-xs text-dark-400 dark:text-dark-500">
        {isMobile
          ? 'Mobile-optimized version'
          : 'Approx. 500KB total resources, ~30MB RAM while running'}
      </p>
    </div>
  );
}

// Camera preset button labels and icons (removed 'descent' - replaced by Follow Ball toggle)
const PRESET_CONFIG: { key: CameraPreset; label: string; icon: typeof Eye }[] = [
  { key: 'default', label: 'Default', icon: Eye },
  { key: 'top', label: 'Top View', icon: Compass },
  { key: 'isometric', label: 'Isometric', icon: Video },
];

interface GradientDescentVisualizationProps {
  isDark?: boolean;
}

export function GradientDescentVisualization({
  isDark = false,
}: GradientDescentVisualizationProps) {
  // Demo started state - controls when Three.js loads
  const [demoStarted, setDemoStarted] = useState(false);
  // Mobile mode - shows simplified stats-only view
  const [mobileMode, setMobileMode] = useState(false);

  // Detect mobile device
  const isMobile = useIsMobile();

  // Detect dark mode from document if not provided
  const [detectedDark, setDetectedDark] = useState(isDark);

  useEffect(() => {
    const checkDark = () => {
      setDetectedDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, [isDark]);

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [learningRate, setLearningRate] = useState(0.1);

  // Camera state
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('default');
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0); // Counter to force camera reset

  // Click-to-place toggle state (disabled by default to prevent accidental ball placement)
  const [clickToPlaceEnabled, setClickToPlaceEnabled] = useState(false);

  // Follow Ball camera mode (enabled by default - tracks ball with dynamic angle/zoom)
  const [followBallEnabled, setFollowBallEnabled] = useState(true);

  // Original starting point (never changes - used for true reset)
  // Uses (3.5, 5.0) to create a visible descent path across the asymmetric MSE surface
  const ORIGINAL_START = useMemo(() => ({ w: 3.5, b: 5.0 }), []);

  // Starting point (can be changed by clicking on surface)
  // Default at (3.5, 5.0) - top-right of the surface, good for showing descent
  const [startPoint, setStartPoint] = useState({ w: 3.5, b: 5.0 });

  // Handle click-to-start from 3D visualization
  const handleStartPointChange = useCallback((w: number, b: number) => {
    setStartPoint({ w, b });
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  // Compute the gradient descent path with divergence detection
  const gradientResult = useMemo(() => {
    return runGradientDescent(startPoint.w, startPoint.b, learningRate);
  }, [startPoint.w, startPoint.b, learningRate]);

  // Destructure for convenience
  const { path: gradientPath, diverged, divergedAtIteration } = gradientResult;

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    if (currentStep >= gradientPath.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStep((prev) => prev + 1);
    }, 150);

    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, gradientPath.length]);

  // Control handlers
  const handlePlayPause = useCallback(() => {
    if (currentStep >= gradientPath.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying((prev) => !prev);
  }, [currentStep, gradientPath.length]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
    // Reset to original starting position, not the clicked position
    setStartPoint(ORIGINAL_START);
  }, [ORIGINAL_START]);

  const handleLearningRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    setLearningRate(newRate);
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  // Camera handlers
  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
  }, []);

  const handleResetCamera = useCallback(() => {
    // Always increment reset trigger - this ensures camera resets even if already on 'default'
    setCameraResetTrigger((prev) => prev + 1);
    setCameraPreset('default');
  }, []);

  const handleLaunchDemo = useCallback(() => {
    setDemoStarted(true);
    setMobileMode(false);
  }, []);

  const handleLaunchMobileDemo = useCallback(() => {
    setDemoStarted(true);
    setMobileMode(true);
  }, []);

  // Current point data
  const currentPoint = gradientPath[currentStep];
  const isComplete = currentStep >= gradientPath.length - 1;

  // Determine actual convergence status
  const initialCost = gradientPath[0]?.cost ?? 0;
  const finalCost = currentPoint?.cost ?? 0;

  // Check if we actually converged (cost went down significantly and is near optimal)
  const costImproved = finalCost < initialCost;
  const nearOptimal = finalCost < 0.2; // Close enough to optimal
  const actuallyConverged = !diverged && costImproved && nearOptimal;

  // Check if oscillating/unstable (cost went up from start or is still high)
  const isOscillating = !diverged && isComplete && (!costImproved || finalCost > 1.0);

  // Check if converged but slowly (cost improved, between 0.2 and 1.0 - working but not optimal yet)
  const slowConvergence =
    !diverged && isComplete && costImproved && finalCost >= 0.2 && finalCost <= 1.0;

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'bg-gradient-to-br from-slate-50 to-slate-100',
        'dark:from-dark-800 dark:to-dark-900',
        'border-2 border-slate-300 dark:border-dark-700',
        'shadow-lg dark:shadow-none'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-6 py-4 border-b',
          'border-slate-300 dark:border-dark-700',
          'bg-white dark:bg-dark-900/50'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <TrendingDown size={20} className="text-primary-600 dark:text-primary-500" />
              Interactive Cost Landscape
            </h3>
            <p className="text-sm text-slate-600 dark:text-dark-400 mt-1">
              {demoStarted
                ? 'Watch gradient descent find the minimum cost. Drag to rotate, scroll to zoom.'
                : 'Launch the interactive demo to explore gradient descent in 3D.'}
            </p>
          </div>

          {/* Close Demo Button - only shown when demo is running */}
          {demoStarted && !mobileMode && (
            <button
              onClick={() => {
                setDemoStarted(false);
                setIsPlaying(false);
                setCurrentStep(0);
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                'bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-400',
                'hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400',
                'border border-slate-300 dark:border-transparent',
                'transition-all duration-200',
                'hover:scale-[1.02] active:scale-[0.98]'
              )}
              title="Close demo to free memory (~30MB)"
            >
              <X size={16} />
              Close Demo
            </button>
          )}
        </div>
      </div>

      {/* Show placeholder or actual visualization */}
      {!demoStarted ? (
        <div className="p-4">
          <DemoPlaceholder
            onLaunch={handleLaunchDemo}
            onLaunchMobile={handleLaunchMobileDemo}
            isMobile={isMobile}
          />
        </div>
      ) : mobileMode ? (
        /* Mobile-friendly stats-only view */
        <div className="p-4">
          {/* Mobile Info Banner */}
          <div
            className={cn(
              'mb-4 p-3 rounded-lg',
              'bg-blue-100 dark:bg-blue-900/30',
              'border border-blue-200 dark:border-blue-700',
              'text-blue-800 dark:text-blue-200'
            )}
          >
            <div className="flex items-center gap-2 text-sm">
              <Smartphone size={18} />
              <span className="font-medium">Mobile View</span>
              <span className="text-blue-600 dark:text-blue-300">— Stats only, no 3D</span>
              <button
                onClick={() => setMobileMode(false)}
                className={cn(
                  'ml-auto px-2 py-1 rounded text-xs font-medium',
                  'bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700',
                  'transition-colors'
                )}
              >
                Try 3D
              </button>
            </div>
          </div>

          {/* Animation Controls for Mobile */}
          <div
            className={cn(
              'p-4 rounded-xl mb-4',
              'bg-slate-100 dark:bg-dark-700',
              'border border-slate-200 dark:border-transparent'
            )}
          >
            <div className="flex flex-col gap-4">
              {/* Play/Reset Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayPause}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium',
                    'transition-all duration-200',
                    'shadow-md',
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-primary-600 dark:bg-primary-500 hover:bg-primary-700 dark:hover:bg-primary-600 text-white'
                  )}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  {isPlaying ? 'Pause' : isComplete ? 'Replay' : 'Play'}
                </button>

                <button
                  onClick={handleReset}
                  className={cn(
                    'px-4 py-3 rounded-lg font-medium',
                    'bg-slate-200 hover:bg-slate-300 dark:bg-dark-600 dark:hover:bg-dark-500',
                    'text-slate-700 dark:text-dark-200',
                    'transition-all duration-200'
                  )}
                >
                  <RotateCcw size={20} />
                </button>
              </div>

              {/* Learning Rate Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-dark-300 flex items-center gap-2">
                    <Gauge size={16} className="text-primary-600 dark:text-primary-400" />
                    Learning Rate
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono px-2 py-1 rounded',
                      'bg-slate-200 dark:bg-dark-600',
                      'text-slate-800 dark:text-dark-300',
                      'font-semibold'
                    )}
                  >
                    α = {learningRate.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={learningRate}
                  onChange={handleLearningRateChange}
                  style={{
                    background: detectedDark ? '#52525b' : '#94a3b8',
                    accentColor: detectedDark ? '#8b5cf6' : '#7c3aed',
                  }}
                  className={cn(
                    'w-full h-3 rounded-full appearance-none cursor-pointer',
                    '[&::-webkit-slider-thumb]:appearance-none',
                    '[&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6',
                    '[&::-webkit-slider-thumb]:rounded-full',
                    '[&::-webkit-slider-thumb]:bg-primary-600 dark:[&::-webkit-slider-thumb]:bg-primary-500',
                    '[&::-webkit-slider-thumb]:cursor-pointer',
                    '[&::-webkit-slider-thumb]:shadow-lg',
                    '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Stats Display - Mobile Optimized */}
          <div className="grid grid-cols-1 gap-3">
            {/* Progress Bar */}
            <div
              className={cn(
                'p-4 rounded-xl',
                'bg-slate-100 dark:bg-dark-700',
                'border border-slate-200 dark:border-transparent'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-dark-400">
                  Progress
                </span>
                <span className="text-sm font-mono text-slate-900 dark:text-white">
                  {currentPoint?.iteration ?? 0} / {gradientPath.length - 1}
                </span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-dark-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-150"
                  style={{
                    width: `${((currentPoint?.iteration ?? 0) / (gradientPath.length - 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Current Cost */}
            <div
              className={cn(
                'p-4 rounded-xl',
                'bg-slate-100 dark:bg-dark-700',
                'border border-slate-200 dark:border-transparent'
              )}
            >
              <p className="text-sm text-slate-600 dark:text-dark-400 mb-1">Current Cost</p>
              <p
                className={cn(
                  'text-2xl font-bold font-mono',
                  isComplete
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-primary-600 dark:text-primary-500'
                )}
              >
                {formatNumber(currentPoint?.cost, 4)}
              </p>
            </div>

            {/* Parameters */}
            <div
              className={cn(
                'p-4 rounded-xl',
                'bg-slate-100 dark:bg-dark-700',
                'border border-slate-200 dark:border-transparent'
              )}
            >
              <p className="text-sm text-slate-600 dark:text-dark-400 mb-2">Parameters</p>
              <div className="flex gap-4">
                <div className="flex-1 text-center p-2 bg-slate-200 dark:bg-dark-600 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-dark-400">Weight (w)</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                    {formatNumber(currentPoint?.w, 3)}
                  </p>
                </div>
                <div className="flex-1 text-center p-2 bg-slate-200 dark:bg-dark-600 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-dark-400">Bias (b)</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                    {formatNumber(currentPoint?.b, 3)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {diverged && isComplete && (
            <div
              className={cn(
                'mt-4 p-4 rounded-lg',
                'bg-red-100 dark:bg-red-900/30',
                'border border-red-200 dark:border-red-800',
                'text-red-800 dark:text-red-300'
              )}
            >
              <p className="font-semibold text-sm">
                ⚠️ Diverged at iteration {divergedAtIteration}
              </p>
              <p className="text-xs mt-1">Try a smaller learning rate (≤ 0.20)</p>
            </div>
          )}

          {isComplete && actuallyConverged && (
            <div
              className={cn(
                'mt-4 p-4 rounded-lg',
                'bg-green-100 dark:bg-green-900/30',
                'border border-green-200 dark:border-green-800',
                'text-green-700 dark:text-green-400'
              )}
            >
              <p className="font-semibold text-sm">
                ✨ Converged! w ≈ {formatNumber(currentPoint?.w, 3)}, b ≈{' '}
                {formatNumber(currentPoint?.b, 3)}
              </p>
            </div>
          )}

          {slowConvergence && (
            <div
              className={cn(
                'mt-4 p-4 rounded-lg',
                'bg-blue-100 dark:bg-blue-900/30',
                'border border-blue-200 dark:border-blue-800',
                'text-blue-800 dark:text-blue-300'
              )}
            >
              <p className="font-semibold text-sm">
                ✓ Converged! w ≈ {formatNumber(currentPoint?.w, 3)}, b ≈{' '}
                {formatNumber(currentPoint?.b, 3)}
              </p>
              <p className="text-xs mt-1">Try α ≈ 0.20 for faster convergence</p>
            </div>
          )}

          {isOscillating && (
            <div
              className={cn(
                'mt-4 p-4 rounded-lg',
                'bg-amber-100 dark:bg-amber-900/30',
                'border border-amber-200 dark:border-amber-800',
                'text-amber-800 dark:text-amber-300'
              )}
            >
              <p className="font-semibold text-sm">⚠️ Oscillating - Did Not Converge</p>
              <p className="text-xs mt-1">Try a smaller learning rate (≤ 0.20)</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Camera Controls */}
          <div
            className={cn(
              'px-4 py-3 border-b',
              'border-slate-300 dark:border-dark-700',
              'bg-slate-100 dark:bg-dark-800/50'
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-dark-300 mr-2">
                <Camera size={16} />
                View:
              </span>
              {PRESET_CONFIG.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleCameraPreset(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                    'transition-all duration-200',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    cameraPreset === key
                      ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-md'
                      : 'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-dark-300 hover:bg-slate-300 dark:hover:bg-dark-600 border border-slate-300 dark:border-transparent'
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}

              {/* Divider */}
              <div className="w-px h-6 bg-slate-300 dark:bg-dark-600 mx-1" />

              {/* Follow Ball Toggle */}
              <button
                onClick={() => setFollowBallEnabled(!followBallEnabled)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                  'transition-all duration-200',
                  'hover:scale-[1.02] active:scale-[0.98]',
                  followBallEnabled
                    ? 'bg-green-500 dark:bg-green-600 text-white shadow-md ring-2 ring-green-300 dark:ring-green-700'
                    : 'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-dark-300 hover:bg-slate-300 dark:hover:bg-dark-600 border border-slate-300 dark:border-transparent'
                )}
                title={
                  followBallEnabled
                    ? 'Camera follows ball during descent (ON)'
                    : 'Camera stays fixed (OFF)'
                }
              >
                <TrendingDown size={14} />
                {followBallEnabled ? 'Follow Ball: ON' : 'Follow Ball'}
              </button>

              {/* Click-to-Place Toggle */}
              <button
                onClick={() => setClickToPlaceEnabled(!clickToPlaceEnabled)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                  'transition-all duration-200',
                  'hover:scale-[1.02] active:scale-[0.98]',
                  clickToPlaceEnabled
                    ? 'bg-amber-500 dark:bg-amber-600 text-white shadow-md ring-2 ring-amber-300 dark:ring-amber-700'
                    : 'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-dark-300 hover:bg-slate-300 dark:hover:bg-dark-600 border border-slate-300 dark:border-transparent'
                )}
                title={
                  clickToPlaceEnabled
                    ? 'Click-to-place is ON: Click the surface to move the starting point'
                    : 'Click-to-place is OFF: Enable to move the ball by clicking'
                }
              >
                <MousePointerClick size={14} />
                {clickToPlaceEnabled ? 'Place Ball: ON' : 'Place Ball'}
              </button>

              <button
                onClick={handleResetCamera}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ml-auto',
                  'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-dark-300',
                  'hover:bg-slate-300 dark:hover:bg-dark-600',
                  'border border-slate-300 dark:border-transparent',
                  'transition-all duration-200',
                  'hover:scale-[1.02] active:scale-[0.98]'
                )}
                title="Reset camera to default position"
              >
                <RotateCcw size={14} />
                Reset Camera
              </button>
            </div>
          </div>

          {/* 3D Visualization with Lazy Loading */}
          <div className="p-2 sm:p-4">
            <Suspense fallback={<VisualizationSkeleton />}>
              <ThreeGradientDescent
                isPlaying={isPlaying}
                currentStep={currentStep}
                gradientPath={gradientPath}
                isDark={detectedDark}
                cameraPreset={cameraPreset}
                cameraResetTrigger={cameraResetTrigger}
                height="min(350px,45vh)"
                onStartPointChange={handleStartPointChange}
                clickToPlaceEnabled={clickToPlaceEnabled}
                followBallEnabled={followBallEnabled}
                isDiverging={diverged && isComplete}
                learningRate={learningRate}
                onLearningRateChange={(rate) => {
                  setLearningRate(rate);
                  setCurrentStep(0);
                  setIsPlaying(false);
                }}
              />
            </Suspense>

            {/* Renderer indicator badge */}
            <div
              className={cn(
                'mt-2 flex items-center justify-center gap-2',
                'text-xs',
                detectedDark ? 'text-dark-500' : 'text-slate-400'
              )}
            >
              <Zap size={12} />
              <span>Powered by Three.js</span>
            </div>
          </div>

          {/* Animation Controls Panel */}
          <div
            className={cn(
              'px-6 py-4 border-t',
              'border-slate-300 dark:border-dark-700',
              'bg-white dark:bg-dark-900/50'
            )}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Play/Pause/Reset Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayPause}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                    'transition-all duration-200',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    'shadow-md',
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-primary-600 dark:bg-primary-500 hover:bg-primary-700 dark:hover:bg-primary-600 text-white'
                  )}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  {isPlaying ? 'Pause' : isComplete ? 'Replay' : 'Play'}
                </button>

                <button
                  onClick={handleReset}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                    'bg-slate-200 hover:bg-slate-300 dark:bg-dark-700 dark:hover:bg-dark-600',
                    'text-slate-700 dark:text-dark-200',
                    'border border-slate-300 dark:border-transparent',
                    'transition-all duration-200',
                    'hover:scale-[1.02] active:scale-[0.98]'
                  )}
                >
                  <RotateCcw size={18} />
                  Reset Animation
                </button>
              </div>

              {/* Learning Rate Slider - stacked on mobile, inline on md+ */}
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center justify-between sm:justify-start gap-2 text-slate-700 dark:text-dark-300">
                  <div className="flex items-center gap-2">
                    <Gauge size={18} className="text-primary-600 dark:text-primary-400" />
                    <span className="text-sm font-medium whitespace-nowrap">Learning Rate:</span>
                  </div>
                  <span
                    className={cn(
                      'sm:hidden text-sm font-mono px-2 py-1 rounded-lg',
                      'bg-slate-200 dark:bg-dark-700',
                      'text-slate-800 dark:text-dark-300',
                      'border border-slate-300 dark:border-transparent',
                      'font-semibold'
                    )}
                  >
                    α = {learningRate.toFixed(2)}
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={learningRate}
                    onChange={handleLearningRateChange}
                    style={{
                      background: detectedDark ? '#52525b' : '#94a3b8',
                      accentColor: detectedDark ? '#8b5cf6' : '#7c3aed',
                    }}
                    className={cn(
                      'flex-1 h-2.5 rounded-full appearance-none cursor-pointer',
                      '[&::-webkit-slider-thumb]:appearance-none',
                      '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
                      '[&::-webkit-slider-thumb]:rounded-full',
                      '[&::-webkit-slider-thumb]:bg-primary-600 dark:[&::-webkit-slider-thumb]:bg-primary-500',
                      '[&::-webkit-slider-thumb]:cursor-pointer',
                      '[&::-webkit-slider-thumb]:shadow-lg',
                      '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white',
                      '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5',
                      '[&::-moz-range-thumb]:rounded-full',
                      '[&::-moz-range-thumb]:bg-primary-600 dark:[&::-moz-range-thumb]:bg-primary-500',
                      '[&::-moz-range-thumb]:cursor-pointer',
                      '[&::-moz-range-thumb]:shadow-lg',
                      '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white'
                    )}
                  />
                  <span
                    className={cn(
                      'hidden sm:block text-sm font-mono px-3 py-1.5 rounded-lg',
                      'bg-slate-200 dark:bg-dark-700',
                      'text-slate-800 dark:text-dark-300',
                      'border border-slate-300 dark:border-transparent',
                      'min-w-[5rem] text-center font-semibold'
                    )}
                  >
                    α = {learningRate.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Display - 1 column on mobile (horizontal rows), 3 columns on sm+ (cards) */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              <div
                className={cn(
                  'p-2 sm:p-3 rounded-lg',
                  'bg-slate-100 dark:bg-dark-700',
                  'border border-slate-200 dark:border-transparent',
                  'flex sm:flex-col items-center sm:items-stretch justify-between sm:justify-start'
                )}
              >
                <p className="text-xs text-slate-600 dark:text-dark-400 font-medium sm:mb-1 sm:text-center">
                  Iteration
                </p>
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono sm:text-center">
                  {currentPoint?.iteration ?? 0}
                  <span className="text-sm font-normal text-slate-500 dark:text-dark-400">
                    {' '}
                    / {gradientPath.length - 1}
                  </span>
                </p>
              </div>

              <div
                className={cn(
                  'p-2 sm:p-3 rounded-lg',
                  'bg-slate-100 dark:bg-dark-700',
                  'border border-slate-200 dark:border-transparent',
                  'flex sm:flex-col items-center sm:items-stretch justify-between sm:justify-start'
                )}
              >
                <p className="text-xs text-slate-600 dark:text-dark-400 font-medium sm:mb-1 sm:text-center">
                  Current Cost
                </p>
                <p
                  className={cn(
                    'text-base sm:text-lg font-bold font-mono sm:text-center',
                    isComplete
                      ? 'text-green-600 dark:text-green-500'
                      : 'text-primary-600 dark:text-primary-500'
                  )}
                >
                  {formatNumber(currentPoint?.cost, 4)}
                </p>
              </div>

              <div
                className={cn(
                  'p-2 sm:p-3 rounded-lg',
                  'bg-slate-100 dark:bg-dark-700',
                  'border border-slate-200 dark:border-transparent',
                  'flex sm:flex-col items-center sm:items-stretch justify-between sm:justify-start'
                )}
              >
                <p className="text-xs text-slate-600 dark:text-dark-400 font-medium sm:mb-1 sm:text-center">
                  Parameters
                </p>
                <div className="flex sm:flex-col gap-3 sm:gap-0.5 text-sm font-bold text-slate-900 dark:text-white font-mono sm:text-center">
                  <span>w = {formatNumber(currentPoint?.w, 2)}</span>
                  <span>b = {formatNumber(currentPoint?.b, 2)}</span>
                </div>
              </div>
            </div>

            {/* Divergence Warning (rapid explosion) */}
            {diverged && isComplete && (
              <div
                className={cn(
                  'mt-4 p-4 rounded-lg',
                  'bg-red-100 dark:bg-red-900/30',
                  'border border-red-200 dark:border-red-800',
                  'text-red-800 dark:text-red-300',
                  'animate-fade-in'
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">⚠️ Gradient Descent Diverged!</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                      The cost exploded at iteration {divergedAtIteration} because the learning rate
                      (α = {learningRate.toFixed(2)}) is too high. Each update overshoots the
                      minimum, causing the parameters to spiral out of control.
                    </p>
                    <p className="text-sm font-medium">
                      💡 Try a smaller learning rate (≤ 0.20 works well for this problem)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Oscillation Warning (slow divergence / unstable) */}
            {isOscillating && (
              <div
                className={cn(
                  'mt-4 p-4 rounded-lg',
                  'bg-amber-100 dark:bg-amber-900/30',
                  'border border-amber-200 dark:border-amber-800',
                  'text-amber-800 dark:text-amber-300',
                  'animate-fade-in'
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">⚠️ Did Not Converge - Oscillating</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                      After {gradientPath.length - 1} iterations, the cost (
                      {formatNumber(finalCost, 4)}){' '}
                      {!costImproved
                        ? `is higher than the starting cost (${formatNumber(initialCost, 4)})`
                        : 'has not reached the optimal region'}
                      . The learning rate (α = {learningRate.toFixed(2)}) is causing the algorithm
                      to oscillate around the minimum without settling.
                    </p>
                    <p className="text-sm font-medium">
                      💡 Try a smaller learning rate (≤ 0.20 usually converges smoothly)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Slow Convergence Info (converged but not at optimal yet) */}
            {slowConvergence && (
              <div
                className={cn(
                  'mt-4 p-4 rounded-lg',
                  'bg-blue-100 dark:bg-blue-900/30',
                  'border border-blue-200 dark:border-blue-800',
                  'text-blue-800 dark:text-blue-300',
                  'animate-fade-in'
                )}
              >
                <div className="flex items-start gap-3">
                  <TrendingDown size={24} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">
                      ✓ Converged! Parameters: w ≈ {formatNumber(currentPoint?.w, 3)}, b ≈{' '}
                      {formatNumber(currentPoint?.b, 3)}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                      After {gradientPath.length - 1} iterations, the cost decreased from{' '}
                      {formatNumber(initialCost, 2)} to {formatNumber(finalCost, 4)}. The algorithm
                      is on the right track but hasn't reached the optimal region yet (cost &lt;
                      0.2).
                    </p>
                    <p className="text-sm font-medium">
                      💡 A slightly higher learning rate (try α ≈ 0.20) may converge faster to the
                      optimal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message (only shown when actually converged to optimal) */}
            {isComplete && actuallyConverged && (
              <div
                className={cn(
                  'mt-4 p-3 rounded-lg text-center',
                  'bg-green-100 dark:bg-green-900/30',
                  'border border-green-200 dark:border-green-800',
                  'text-green-700 dark:text-green-400',
                  'animate-fade-in'
                )}
              >
                <p className="font-medium">
                  ✨ Converged! Found optimal parameters: w ≈ {formatNumber(currentPoint?.w, 3)}, b
                  ≈ {formatNumber(currentPoint?.b, 3)}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default GradientDescentVisualization;
