/**
 * ThreeGradientDescent Component
 * 
 * Main wrapper component that sets up the React Three Fiber Canvas
 * and manages the 3D visualization.
 * 
 * Features:
 * - Responsive sizing
 * - Theme-aware rendering
 * - Camera preset support
 * - Quality scaling based on device capabilities
 * - Full gradient descent animation support
 */

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Scene } from './Scene';
import { ThreeGradientDescentProps, getQualitySettings } from './types';
import { VisualizationControls, VisualizationSettings } from './VisualizationControls';
import { WarningOverlay } from './DivergenceEffect';
import { MetricsOverlay } from './MetricsOverlay';
import { cn } from '@/utils/cn';

// Loading fallback component
function LoadingFallback({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'w-full h-full flex items-center justify-center',
      'bg-gradient-to-br',
      isDark 
        ? 'from-dark-800 to-dark-900' 
        : 'from-slate-100 to-slate-200'
    )}>
      <div className="flex flex-col items-center gap-3">
        <div className={cn(
          'w-10 h-10 border-4 rounded-full animate-spin',
          isDark 
            ? 'border-dark-600 border-t-primary-500' 
            : 'border-slate-300 border-t-primary-600'
        )} />
        <p className={cn(
          'text-sm font-medium',
          isDark ? 'text-dark-400' : 'text-slate-600'
        )}>
          Loading 3D Scene...
        </p>
      </div>
    </div>
  );
}

// Error boundary fallback
function ErrorFallback({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'w-full h-full flex items-center justify-center',
      'bg-gradient-to-br',
      isDark 
        ? 'from-red-900/20 to-dark-900' 
        : 'from-red-100 to-slate-200'
    )}>
      <div className="flex flex-col items-center gap-3 text-center px-4">
        <span className="text-4xl">⚠️</span>
        <p className={cn(
          'text-sm font-medium',
          isDark ? 'text-red-400' : 'text-red-600'
        )}>
          WebGL not supported or error loading 3D scene
        </p>
        <p className={cn(
          'text-xs',
          isDark ? 'text-dark-400' : 'text-slate-500'
        )}>
          Try using a different browser or device
        </p>
      </div>
    </div>
  );
}

export function ThreeGradientDescent({
  // Animation props
  isPlaying,
  currentStep,
  gradientPath,
  isDark,
  // Divergence state
  isDiverging = false,
  // Visual options
  showContours = true,
  showParticles = true,
  showGradientArrow = true,
  showCostLabel: _showCostLabel = true,
  showAxisLabels = true,
  showEffects = true,
  cameraPreset,
  height = 450,
  // Callbacks
  onCameraChange: _onCameraChange,
  onStartPointChange,
  onFollowBallToggle: _onFollowBallToggle,
  // Click-to-place toggle (disabled by default)
  clickToPlaceEnabled = false,
  // Follow Ball camera mode (enabled by default)
  followBallEnabled = true,
  // Learning rate for presets panel
  learningRate = 0.1,
  onLearningRateChange,
  // Camera reset trigger
  cameraResetTrigger = 0,
}: ThreeGradientDescentProps & {
  isDiverging?: boolean;
  learningRate?: number;
  onLearningRateChange?: (rate: number) => void;
}) {
  // ALL HOOKS MUST BE AT THE TOP - before any conditional returns!
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Visual settings state (managed internally, with props as initial values)
  // Note: showCostLabel now controls the 3D floating label (disabled by default)
  // The 2D MetricsOverlay is always shown and provides better visibility
  const [visualSettings, setVisualSettings] = useState<VisualizationSettings>({
    showContours,
    showParticles,
    showGradientArrow,
    showCostLabel: false, // Disabled by default - we use 2D MetricsOverlay instead
    showAxisLabels,
    animationSpeed: 1,
  });
  
  // Get current point for metrics overlay
  const currentPoint = useMemo(() => {
    if (!gradientPath || gradientPath.length === 0) return null;
    const index = Math.min(currentStep, gradientPath.length - 1);
    return gradientPath[index];
  }, [gradientPath, currentStep]);
  
  // Handle WebGL context loss and recovery
  const handleContextLost = useCallback((event: WebGLContextEvent) => {
    event.preventDefault();
    console.warn('WebGL context lost. Attempting recovery...');
    setContextLost(true);
  }, []);
  
  const handleContextRestored = useCallback(() => {
    console.log('WebGL context restored.');
    setContextLost(false);
    // Force re-render by updating key
    setRenderKey(prev => prev + 1);
  }, []);
  
  // Handle learning rate change from controls - MOVED HERE before any returns
  const handleLearningRateChange = useCallback((rate: number) => {
    if (onLearningRateChange) {
      onLearningRateChange(rate);
    }
  }, [onLearningRateChange]);
  
  // Only render on client side
  useEffect(() => {
    setIsClient(true);
    
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setHasWebGL(!!gl);
    } catch {
      setHasWebGL(false);
    }
  }, []);
  
  // Attach context loss handlers to the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
    canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored as EventListener);
    };
  }, [handleContextLost, handleContextRestored, isClient]);
  
  // Cleanup WebGL resources on unmount to free memory
  useEffect(() => {
    return () => {
      // Clean up WebGL renderer and free GPU memory
      if (rendererRef.current) {
        try {
          // Dispose of the renderer
          rendererRef.current.dispose();
          
          // Force context loss to release GPU memory immediately
          const gl = rendererRef.current.getContext();
          if (gl) {
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) {
              ext.loseContext();
            }
          }
          
          // Clear renderer reference
          rendererRef.current = null;
        } catch (e) {
          console.warn('Error during WebGL cleanup:', e);
        }
      }
      
      // Clear Three.js internal caches
      try {
        // Note: This clears ALL cached textures/fonts, which is aggressive
        // but effective for memory recovery
        if (THREE.Cache) {
          THREE.Cache.clear();
        }
      } catch (e) {
        console.warn('Error clearing Three.js cache:', e);
      }
      
      // Clear canvas reference
      canvasRef.current = null;
    };
  }, []);
  
  // Get quality settings - this is not a hook, just a function call
  const quality = getQualitySettings();
  
  // Determine container style based on height type
  const containerStyle = typeof height === 'string' 
    ? { height, minHeight: '300px' } 
    : { height: `${height}px`, minHeight: '300px' };
  
  // NOW we can have conditional returns AFTER all hooks
  
  // Don't render on server
  if (!isClient) {
    return (
      <div 
        className={cn(
          'w-full rounded-xl overflow-hidden',
          isDark ? 'bg-dark-800' : 'bg-slate-100'
        )}
        style={containerStyle}
      >
        <LoadingFallback isDark={isDark} />
      </div>
    );
  }
  
  // Show error if WebGL is not supported or context is lost
  if (!hasWebGL || contextLost) {
    return (
      <div 
        className={cn(
          'w-full rounded-xl overflow-hidden',
          isDark ? 'bg-dark-800' : 'bg-slate-100'
        )}
        style={containerStyle}
      >
        {contextLost ? (
          <div className={cn(
            'w-full h-full flex items-center justify-center',
            'bg-gradient-to-br',
            isDark 
              ? 'from-amber-900/20 to-dark-900' 
              : 'from-amber-100 to-slate-200'
          )}>
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <span className="text-4xl">🔄</span>
              <p className={cn(
                'text-sm font-medium',
                isDark ? 'text-amber-400' : 'text-amber-600'
              )}>
                WebGL context lost. Recovering...
              </p>
              <button
                onClick={() => setRenderKey(prev => prev + 1)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-primary-500 text-white hover:bg-primary-600',
                  'transition-colors'
                )}
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <ErrorFallback isDark={isDark} />
        )}
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        'w-full rounded-xl overflow-hidden relative',
        'border',
        isDark 
          ? 'border-dark-700 bg-dark-900' 
          : 'border-slate-300 bg-white'
      )}
      style={containerStyle}
    >
      {/* Warning overlay for divergence */}
      <WarningOverlay isDiverging={isDiverging} isDark={isDark} />
      
      {/* 2D Metrics Overlay - Fixed position, always readable */}
      <MetricsOverlay
        currentPoint={currentPoint}
        totalSteps={gradientPath.length - 1}
        show={true}
        isDark={isDark}
      />
      
      {/* Visualization Controls Panel */}
      <VisualizationControls
        settings={visualSettings}
        onSettingsChange={setVisualSettings}
        learningRate={learningRate}
        onLearningRateChange={handleLearningRateChange}
        isDark={isDark}
        isPlaying={isPlaying}
      />
      
      <Canvas
        key={renderKey}
        ref={(canvas) => {
          if (canvas) {
            // R3F Canvas returns the canvas element via gl.domElement
            canvasRef.current = canvas as unknown as HTMLCanvasElement;
          }
        }}
        shadows={quality.enableShadows}
        camera={{ 
          position: [5, 4, 5], 
          fov: 50,
          near: 0.1,
          far: 100
        }}
        dpr={[1, Math.min(2, window.devicePixelRatio || 1)]} // Limit DPR for performance
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true, // Helps with context loss recovery
          failIfMajorPerformanceCaveat: false, // Allow software rendering fallback
        }}
        onCreated={({ gl }) => {
          // Store renderer and canvas references for cleanup
          rendererRef.current = gl;
          canvasRef.current = gl.domElement;
        }}
        style={{ 
          background: isDark 
            ? 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' 
            : 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)'
        }}
      >
        <Suspense fallback={null}>
          <Scene 
            isDark={isDark} 
            cameraPreset={cameraPreset}
            cameraResetTrigger={cameraResetTrigger}
            isPlaying={isPlaying}
            currentStep={currentStep}
            gradientPath={gradientPath}
            isDiverging={isDiverging}
            showGradientArrow={visualSettings.showGradientArrow}
            showCostLabel={visualSettings.showCostLabel}
            showContours={visualSettings.showContours}
            showParticles={visualSettings.showParticles}
            showAxisLabels={visualSettings.showAxisLabels}
            showEffects={showEffects}
            onStartPointChange={onStartPointChange}
            clickToPlaceEnabled={clickToPlaceEnabled}
            followBallEnabled={followBallEnabled}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Re-export types for convenience
export type { 
  ThreeGradientDescentProps, 
  CameraPreset, 
  GradientDescentPoint 
} from './types';

export default ThreeGradientDescent;
