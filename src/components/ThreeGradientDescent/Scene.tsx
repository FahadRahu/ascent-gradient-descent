/**
 * Scene Component
 * 
 * Sets up the 3D scene with lighting, camera controls, and all visualization components.
 * This is the main orchestrator for the Three.js gradient descent visualization.
 * 
 * Phase C1 Enhancements:
 * - Enhanced multi-source lighting system
 * - Gradient sky dome background
 * - Scene fade-in animation
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

// Mobile detection for zoom limits
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

// Import visualization components
import { CostSurface } from './CostSurface';
import { DescentBall } from './DescentBall';
// import { DescentPath } from './DescentPath'; // Commented out - not currently used
import { Markers } from './Markers';
import { GradientArrow } from './GradientArrow';
import { CostLabel } from './CostLabel';
import { SurfaceContours } from './SurfaceContours';
import { AxisLabels } from './AxisLabels';
import { FlowingParticles } from './FlowingParticles';
import { Effects } from './Effects';
import { DivergenceEffect } from './DivergenceEffect';
import { GradientSky } from './GradientSky';
import { SceneFadeIn } from './SceneFadeIn';
// Phase C2 Components
import { StepParticleBurst } from './StepParticleBurst';
import { CometTrail } from './CometTrail';
import { PulsingRings } from './PulsingRings';
// Phase C3 Components
// import { NeonPath } from './NeonPath'; // Commented out - not currently used
import { SmoothedContours } from './SmoothedContours';
import { RimLightEffect } from './RimLightEffect';
// Phase C4/C5 Components
import { AmbientDust } from './AmbientDust';
import { Starfield } from './Starfield';
import { VolumetricFog } from './VolumetricFog';
// Dynamic axis grid
import { DynamicCostGrid } from './DynamicCostGrid';
import { CAMERA_PRESETS, CameraPreset, GradientDescentPoint, getQualitySettings } from './types';
import { COST_RANGE, SURFACE_SIZE, paramsToThreeCoords } from './utils/costFunction';

interface SceneProps {
  isDark: boolean;
  cameraPreset: CameraPreset;
  cameraResetTrigger?: number;
  isPlaying: boolean;
  currentStep: number;
  gradientPath: GradientDescentPoint[];
  isDiverging?: boolean;
  showGradientArrow?: boolean;
  showCostLabel?: boolean;
  showContours?: boolean;
  showParticles?: boolean;
  showAxisLabels?: boolean;
  showEffects?: boolean;
  showNeonPath?: boolean;
  showSmoothedContours?: boolean;
  showRimLight?: boolean;
  showAmbientDust?: boolean;
  showStarfield?: boolean;
  showVolumetricFog?: boolean;
  onStartPointChange?: (w: number, b: number) => void;
  clickToPlaceEnabled?: boolean;
  // Follow Ball camera mode - tracks the ball with dynamic angle/zoom
  followBallEnabled?: boolean;
}

export function Scene({ 
  isDark, 
  cameraPreset,
  cameraResetTrigger = 0,
  isPlaying,
  currentStep,
  gradientPath,
  isDiverging = false,
  showGradientArrow = true,
  showCostLabel = false,   // Disable 3D cost label - we have MetricsOverlay
  showContours = false,    // Disable rough contours
  showParticles = false,   // Disable flowing particles - visual clutter
  showAxisLabels = true,   // Keep axis labels
  showEffects = false,     // Disable post-processing effects
  showNeonPath: _showNeonPath = false,    // Disable neon path - too flashy
  showSmoothedContours = false, // Disable smoothed contours - visual clutter
  showRimLight = false,    // Disable rim light - too subtle to matter
  showAmbientDust = false, // Disable dust - visual clutter
  showStarfield = false,   // Disable starfield - visual clutter
  showVolumetricFog = false, // Disable fog - obscures view
  onStartPointChange,
  clickToPlaceEnabled = false,
  followBallEnabled = true, // Follow Ball mode ON by default
}: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const quality = getQualitySettings();
  const isMobile = useIsMobile();
  
  // Greatly increased zoom-out distance to see full gradient surface
  // Desktop: maxDistance = 35 (was 15)
  // Mobile: maxDistance = 45 (was 22)
  const maxZoomDistance = isMobile ? 45 : 35;
  
  // Click ripple effect state
  const [clickRipple, setClickRipple] = useState<{
    position: [number, number, number];
    time: number;
  } | null>(null);
  
  // Animation state for smooth camera transitions (preset mode)
  const [isAnimating, setIsAnimating] = useState(false);
  const targetPosition = useRef(new THREE.Vector3(5, 4, 5));
  const targetLookAt = useRef(new THREE.Vector3(1, 1, 2));
  const animationProgress = useRef(0);
  
  // Follow Ball camera state
  const followBallCameraPos = useRef(new THREE.Vector3());
  const followBallLookAt = useRef(new THREE.Vector3());
  
  // Calculate current point and trail for the ball - MUST be defined before useFrame
  const currentPoint = useMemo(() => {
    if (gradientPath.length === 0) return null;
    return gradientPath[Math.min(currentStep, gradientPath.length - 1)];
  }, [gradientPath, currentStep]);
  
  // Trail points for ghost effect
  const trailPoints = useMemo(() => {
    if (currentStep <= 0) return [];
    const trailStart = Math.max(0, currentStep - 6);
    return gradientPath.slice(trailStart, currentStep);
  }, [gradientPath, currentStep]);
  
  // Current ball position for particle effects
  const currentBallPosition = useMemo<[number, number, number] | null>(() => {
    if (!currentPoint) return null;
    return paramsToThreeCoords(currentPoint.w, currentPoint.b, currentPoint.cost);
  }, [currentPoint]);
  
  // Starting point for markers
  const startPoint = useMemo(() => {
    if (gradientPath.length === 0) return null;
    return gradientPath[0];
  }, [gradientPath]);
  
  // Calculate max cost in the path for dynamic grid scaling
  const maxCostInPath = useMemo(() => {
    if (gradientPath.length === 0) return null;
    return Math.max(...gradientPath.map(p => p.cost));
  }, [gradientPath]);
  
  // SIMPLIFIED CAMERA LOGIC:
  // When followBallEnabled is ON and currentStep > 0, camera follows ball
  // When currentStep === 0 (reset or initial), camera uses preset/free orbit
  // User zoom/rotate does NOT break ball tracking - only reset does
  const shouldFollowBall = followBallEnabled && currentStep > 0;
  
  // Update target when preset changes OR when reset trigger fires (only when NOT following ball)
  useEffect(() => {
    // Skip if we should be following ball
    if (shouldFollowBall) return;
    
    const preset = CAMERA_PRESETS[cameraPreset];
    if (preset) {
      targetPosition.current.set(...preset.position);
      targetLookAt.current.set(...preset.target);
      animationProgress.current = 0;
      setIsAnimating(true);
    }
  }, [cameraPreset, cameraResetTrigger, shouldFollowBall]);
  
  // Smooth camera animation using useFrame
  useFrame((_, delta) => {
    // FOLLOW BALL MODE - when toggle is ON and we've moved past step 0
    if (shouldFollowBall && currentBallPosition) {
      const ballPos = new THREE.Vector3(...currentBallPosition);
      const currentCost = currentPoint?.cost ?? 10;
      
      // Normalize cost: 0 = at minima (~0.14), 1 = high cost (~20+)
      const normalizedCost = Math.min(1, Math.max(0, (currentCost - 0.14) / 20));
      
      // ZOOM: Distance decreases as cost decreases (closer at minima)
      // High cost (far): distance = 18
      // Low cost (near minima): distance = 6 (slightly higher to see into bowl)
      const minDistance = 6;
      const maxDistance = 18;
      const distance = minDistance + (maxDistance - minDistance) * Math.sqrt(normalizedCost);
      
      // ANGLE: Blends from top-down (high cost) to isometric (low cost)
      // High cost: 65° from horizontal (looking down at steep angle)
      // Low cost: 40° from horizontal (higher angle to see into bowl)
      const highCostAngle = 65 * (Math.PI / 180); // 65 degrees
      const lowCostAngle = 40 * (Math.PI / 180);  // 40 degrees
      const polarAngle = lowCostAngle + (highCostAngle - lowCostAngle) * normalizedCost;
      
      // FIXED AZIMUTH: Always view from the front-left corner (~-135° or 225°)
      // This positions the camera to look INTO the bowl from outside
      // The bowl opens toward +X, +Z, so we view from -X, -Z quadrant
      const fixedAzimuth = (-135 * Math.PI) / 180; // -135 degrees = front-left corner
      
      // Apply the angle - camera is offset horizontally and vertically
      const horizontalDist = Math.cos(polarAngle) * distance;
      const verticalDist = Math.sin(polarAngle) * distance;
      
      // Calculate camera position with FIXED azimuth
      // Camera stays on the "open" side of the bowl, always seeing the ball
      followBallCameraPos.current.set(
        ballPos.x + Math.cos(fixedAzimuth) * horizontalDist,
        ballPos.y + verticalDist + 1.5, // Extra height to see into bowl at minima
        ballPos.z + Math.sin(fixedAzimuth) * horizontalDist
      );
      
      // Look at the ball (slightly below it to see the bowl bottom)
      followBallLookAt.current.set(ballPos.x, ballPos.y - 0.5, ballPos.z);
      
      // Smooth lerp for cinematic movement
      const lerpFactor = 0.04; // Slow, cinematic
      camera.position.lerp(followBallCameraPos.current, lerpFactor);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerp(followBallLookAt.current, lerpFactor);
        controlsRef.current.update();
      }
      
      return; // Skip preset animation when following ball
    }
    
    // PRESET MODE (when not following ball)
    if (!isAnimating) return;
    
    animationProgress.current += delta * 1.25;
    
    if (animationProgress.current >= 1) {
      animationProgress.current = 1;
      setIsAnimating(false);
    }
    
    const t = 1 - Math.pow(1 - animationProgress.current, 3);
    
    camera.position.lerp(targetPosition.current, t * 0.15);
    
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, t * 0.15);
      controlsRef.current.update();
    }
  });
  
  // Handle click on surface to set new starting point
  const handleSurfaceClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!clickToPlaceEnabled) return;
    if (isPlaying) return;
    if (!onStartPointChange) return;
    
    const point = event.point;
    
    const w = COST_RANGE.wMin + ((point.x / SURFACE_SIZE.width) + 0.5) * (COST_RANGE.wMax - COST_RANGE.wMin);
    const b = COST_RANGE.bMin + ((point.z / SURFACE_SIZE.depth) + 0.5) * (COST_RANGE.bMax - COST_RANGE.bMin);
    
    const clampedW = Math.max(COST_RANGE.wMin, Math.min(COST_RANGE.wMax, w));
    const clampedB = Math.max(COST_RANGE.bMin, Math.min(COST_RANGE.bMax, b));
    
    setClickRipple({
      position: [point.x, point.y + 0.05, point.z],
      time: Date.now(),
    });
    
    setTimeout(() => setClickRipple(null), 1000);
    
    onStartPointChange(clampedW, clampedB);
  }, [clickToPlaceEnabled, isPlaying, onStartPointChange]);
  
  return (
    <>
      {/* Starfield Background - only visible in dark mode, renders first */}
      <Starfield 
        isDark={isDark} 
        show={showStarfield && isDark} 
        count={isMobile ? 150 : 300}
        radius={45}
      />
      
      {/* Gradient Sky Background - renders behind everything */}
      <GradientSky isDark={isDark} animate={true} />
      
      {/* Enhanced Lighting Setup */}
      <EnhancedLighting isDark={isDark} enableShadows={quality.enableShadows} />
      
      {/* Camera Controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={maxZoomDistance}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.45}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        panSpeed={0.5}
      />
      
      {/* Scene content wrapped in fade-in animation */}
      <SceneFadeIn duration={1.2} riseDistance={0.4} initialScale={0.94}>
        {/* Effects (fog, glow) */}
        <Effects isDark={isDark} show={showEffects} />
        
        {/* Cost Function Surface with click handler */}
        <group onClick={handleSurfaceClick}>
          <CostSurface isDark={isDark} />
        </group>
        
        {/* Surface Contour Lines - choose between original and smoothed */}
        {showSmoothedContours && !isMobile ? (
          <SmoothedContours 
            isDark={isDark} 
            levels={[0.5, 1, 2, 4, 6, 8]}
            resolution={50}
          />
        ) : (
          <SurfaceContours isDark={isDark} show={showContours} />
        )}
        
        {/* Rim Light Effect (Phase C3.3) - Desktop only */}
        {showRimLight && !isMobile && (
          <RimLightEffect isDark={isDark} intensity={0.5} resolution={35} />
        )}
        
        {/* Axis Labels */}
        <AxisLabels isDark={isDark} show={showAxisLabels} />
        
        {/* Flowing Particles */}
        <FlowingParticles isDark={isDark} show={showParticles} count={40} />
        
        {/* Click Ripple Effect */}
        {clickRipple && (
          <ClickRipple
            position={clickRipple.position}
            startTime={clickRipple.time}
            isDark={isDark}
          />
        )}
        
        {/* Markers for start and optimal positions */}
        {startPoint && (
          <Markers 
            startPoint={startPoint} 
            isDark={isDark} 
            showOptimal={true}
          />
        )}
        
        {/* Gradient Descent Path - DISABLED for cleaner visuals
            The ball itself and the comet trail provide enough path indication */}
        
        {/* Animated Descent Ball */}
        <DescentBall
          currentPoint={currentPoint}
          trailPoints={trailPoints}
          isPlaying={isPlaying}
          isDark={isDark}
        />
        
        {/* Phase C2: Comet Trail with glow layers */}
        <CometTrail
          points={trailPoints}
          currentPosition={currentBallPosition}
          isDark={isDark}
          maxLength={8}
          visible={gradientPath.length > 1}
        />
        
        {/* Phase C2: Particle Burst on Step */}
        {currentBallPosition && (
          <StepParticleBurst
            position={currentBallPosition}
            trigger={currentStep}
            isDark={isDark}
            particleCount={isMobile ? 8 : 15}
            isPlaying={isPlaying}
          />
        )}
        
        {/* Phase C2: Pulsing Rings */}
        {currentBallPosition && (
          <PulsingRings
            position={currentBallPosition}
            isPlaying={isPlaying}
            isDark={isDark}
          />
        )}
        
        {/* Gradient Direction Arrow */}
        <GradientArrow
          currentPoint={currentPoint}
          isPlaying={isPlaying}
          show={showGradientArrow && currentStep < gradientPath.length - 1}
          isDark={isDark}
        />
        
        {/* Floating Cost Label */}
        <CostLabel
          currentPoint={currentPoint}
          show={showCostLabel}
          isDark={isDark}
        />
        
        {/* Volumetric Fog at Bowl Bottom (Phase C4.3) - Desktop only */}
        {showVolumetricFog && !isMobile && (
          <VolumetricFog 
            isDark={isDark} 
            intensity={isDark ? 0.5 : 0.35}
            show={true}
          />
        )}
        
        {/* Ambient Dust Particles (Phase C5.1) */}
        <AmbientDust 
          isDark={isDark} 
          show={showAmbientDust}
          count={isMobile ? 50 : 150}
          bounds={{ x: 10, y: 8, z: 10 }}
        />
        
        {/* Grid helper for reference - balanced size (~3/4 of 30) */}
        <gridHelper 
          args={[22, 22, isDark ? '#475569' : '#94a3b8', isDark ? '#334155' : '#cbd5e1']} 
          position={[0, -0.1, 0]}
        />
        
        {/* Dynamic Cost Grid - moves based on camera angle for visibility */}
        {/* Includes tracking line that follows the ball's current cost */}
        <DynamicCostGrid 
          isDark={isDark} 
          show={!isMobile} 
          currentCost={currentPoint?.cost ?? null}
          maxCostInPath={maxCostInPath}
        />
      </SceneFadeIn>
      
      {/* Divergence visual effect - outside fade-in so it's not affected */}
      <DivergenceEffect 
        isDiverging={isDiverging} 
        intensity={0.8}
        enableShake={true}
      />
    </>
  );
}

/**
 * Click Ripple Effect Component
 */
interface ClickRippleProps {
  position: [number, number, number];
  startTime: number;
  isDark: boolean;
}

function ClickRipple({ position, startTime, isDark }: ClickRippleProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  
  const rippleColor = isDark ? '#a855f7' : '#8b5cf6';
  
  useFrame(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const duration = 1.0;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    
    if (ringRef.current) {
      const scale = 0.1 + eased * 0.8;
      ringRef.current.scale.set(scale, scale, 1);
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.6 * (1 - progress);
    }
    
    if (outerRingRef.current) {
      const scale = 0.05 + eased * 1.2;
      outerRingRef.current.scale.set(scale, scale, 1);
      const material = outerRingRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 * (1 - progress * 1.2);
    }
  });
  
  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial
          color={rippleColor}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.28, 32]} />
        <meshBasicMaterial
          color={rippleColor}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Enhanced Lighting Configuration (Phase C1.1)
 * 
 * Professional multi-source lighting setup:
 * - Key Light: Main illumination with warm/cool color temperature
 * - Fill Light: Softens shadows with complementary accent color
 * - Rim Light: Creates edge definition and separation
 * - Hemisphere Light: Natural sky/ground bounce lighting
 * - Ambient Light: Base fill to prevent pure black shadows
 */
interface LightingProps {
  isDark: boolean;
  enableShadows: boolean;
}

function EnhancedLighting({ isDark, enableShadows }: LightingProps) {
  return (
    <>
      {/* Key Light - Main illumination from front-right-top */}
      <directionalLight
        position={[8, 12, 8]}
        intensity={isDark ? 1.0 : 1.4}
        castShadow={enableShadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0001}
        color={isDark ? '#e0f0ff' : '#fff5e6'} // Cool blue in dark, warm in light
      />
      
      {/* Fill Light - Softens shadows from opposite side */}
      <directionalLight
        position={[-8, 6, -8]}
        intensity={isDark ? 0.4 : 0.5}
        color={isDark ? '#6366f1' : '#fcd34d'} // Indigo accent in dark, golden in light
      />
      
      {/* Rim Light - Back light for edge definition */}
      <directionalLight
        position={[0, 3, -12]}
        intensity={isDark ? 0.5 : 0.6}
        color={isDark ? '#06b6d4' : '#f472b6'} // Cyan in dark, pink in light
      />
      
      {/* Secondary rim light for more dimension */}
      <directionalLight
        position={[-10, 4, 2]}
        intensity={isDark ? 0.25 : 0.3}
        color={isDark ? '#8b5cf6' : '#a855f7'} // Purple accent
      />
      
      {/* Hemisphere Light - Natural sky/ground color bounce */}
      <hemisphereLight
        args={[
          isDark ? '#1e40af' : '#87ceeb',  // Sky color
          isDark ? '#1e293b' : '#92400e',  // Ground color
          isDark ? 0.4 : 0.6
        ]}
      />
      
      {/* Ambient Light - Prevents pure black shadows */}
      <ambientLight intensity={isDark ? 0.25 : 0.35} />
    </>
  );
}

// Legacy Lighting component for backwards compatibility - commented out as it's unused
// function Lighting({ isDark, enableShadows }: LightingProps) {
//   return <EnhancedLighting isDark={isDark} enableShadows={enableShadows} />;
// }

export default Scene;
