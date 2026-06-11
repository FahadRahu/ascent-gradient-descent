/**
 * Type definitions for Three.js Gradient Descent Visualization
 */

// Point in the gradient descent path
export interface GradientDescentPoint {
  w: number;
  b: number;
  cost: number;
  iteration: number;
}

// Camera preset names (removed 'descent' - replaced by Follow Ball toggle)
export type CameraPreset = 'default' | 'top' | 'sideW' | 'sideB' | 'isometric';

// Camera configuration
export interface CameraConfig {
  position: [number, number, number];
  target: [number, number, number];
}

// Camera presets mapping - optimized for MSE cost surface visualization
export const CAMERA_PRESETS: Record<CameraPreset, CameraConfig> = {
  default: { position: [-12, 10, 14], target: [0, 1.0, 0] },
  top: { position: [0, 20, 0.01], target: [0, 0.5, 0] },
  sideW: { position: [18, 5, 0], target: [0, 1.0, 0] },
  sideB: { position: [0, 5, 20], target: [0, 1.0, 0] },
  isometric: { position: [-14, 12, -14], target: [0, 1.0, 0] },
};

// Quality settings for responsive rendering
export interface QualitySettings {
  surfaceResolution: number;
  enableShadows: boolean;
  enableParticles: boolean;
  enableContours: boolean;
  pathSmoothing: number;
}

// Get quality settings based on device capabilities
export function getQualitySettings(): QualitySettings {
  const isMobile = window.innerWidth < 768;
  const isLowPower = typeof navigator !== 'undefined' && 
    navigator.hardwareConcurrency !== undefined && 
    navigator.hardwareConcurrency < 4;
  
  if (isMobile || isLowPower) {
    return {
      surfaceResolution: 25,
      enableShadows: false,
      enableParticles: false,
      enableContours: false,
      pathSmoothing: 5,
    };
  }
  
  return {
    surfaceResolution: 50,
    enableShadows: true,
    enableParticles: true,
    enableContours: true,
    pathSmoothing: 10,
  };
}

// Props for the main component
export interface ThreeGradientDescentProps {
  // Animation state
  isPlaying: boolean;
  currentStep: number;
  gradientPath: GradientDescentPoint[];
  
  // Visual options
  isDark: boolean;
  showContours?: boolean;
  showParticles?: boolean;
  showGradientArrow?: boolean;
  showCostLabel?: boolean;
  showAxisLabels?: boolean;
  showEffects?: boolean;
  
  // Camera
  cameraPreset: CameraPreset;
  cameraResetTrigger?: number;
  
  // Follow Ball Camera Mode
  followBallEnabled?: boolean;
  
  // Sizing
  height?: number | string;
  
  // Callbacks
  onCameraChange?: (preset: CameraPreset) => void;
  onStartPointChange?: (w: number, b: number) => void;
  onFollowBallToggle?: (enabled: boolean) => void;
  
  // Click-to-place toggle
  clickToPlaceEnabled?: boolean;
}
