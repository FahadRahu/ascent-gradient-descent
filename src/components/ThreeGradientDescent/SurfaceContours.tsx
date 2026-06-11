/**
 * SurfaceContours Component (Enhanced)
 *
 * Renders smooth topographic-style contour lines on the cost surface.
 * Uses elliptical approximation for clean, continuous curves.
 *
 * Features:
 * - Smooth elliptical contours based on quadratic cost function
 * - Animated pulse effect on key contour levels
 * - Theme-aware colors with depth-based opacity
 * - Performance-optimized with pre-computed geometry
 */

import { useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COST_RANGE, OPTIMAL_PARAMS, SURFACE_SIZE, HEIGHT_SCALE } from './utils/costFunction';
// Note: computeCost and MAX_COST removed - not used in this file
import { getQualitySettings } from './types';

interface SurfaceContoursProps {
  /** Theme mode */
  isDark: boolean;
  /** Whether to show contours */
  show?: boolean;
  /** Enable animation effects */
  animated?: boolean;
}

// Contour cost levels - adjusted for new quadratic bowl (max cost ~18)
// More levels near minimum for detail, fewer at high cost
const CONTOUR_LEVELS = [0.2, 0.5, 1, 2, 4, 6, 9, 12, 16];

// Highlighted levels (get special styling)
const HIGHLIGHT_LEVELS = new Set([0.5, 2, 8]);

// Number of samples per ellipse (more = smoother)
const ELLIPSE_SAMPLES = 64;

/**
 * Generate a circular contour at a specific cost level
 * For pure quadratic J(w,b) = w² + b², contours are perfect circles
 * with radius = sqrt(cost)
 */
function generateEllipticalContour(
  targetCost: number,
  samples: number = ELLIPSE_SAMPLES
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  // Optimal point (center of the bowl) - now at origin (0, 0)
  const optW = OPTIMAL_PARAMS.w;
  const optB = OPTIMAL_PARAMS.b;

  // For J(w,b) = w² + b², contours are perfect circles
  // At cost C, the radius is sqrt(C) for both w and b
  const radius = Math.sqrt(targetCost);

  // Generate points around the circle
  for (let i = 0; i <= samples; i++) {
    const angle = (i / samples) * Math.PI * 2;
    const w = optW + Math.cos(angle) * radius;
    const b = optB + Math.sin(angle) * radius;

    // Check bounds - skip points outside parameter space
    if (w < COST_RANGE.wMin || w > COST_RANGE.wMax || b < COST_RANGE.bMin || b > COST_RANGE.bMax) {
      continue;
    }

    // Use target cost for height (cleaner than computing actual)
    // Map to 3D coordinates
    const x =
      ((w - COST_RANGE.wMin) / (COST_RANGE.wMax - COST_RANGE.wMin) - 0.5) * SURFACE_SIZE.width;
    const z =
      ((b - COST_RANGE.bMin) / (COST_RANGE.bMax - COST_RANGE.bMin) - 0.5) * SURFACE_SIZE.depth;
    const y = targetCost * HEIGHT_SCALE + 0.02; // Slightly above surface

    points.push(new THREE.Vector3(x, y, z));
  }

  // Close the loop if we have enough points
  if (points.length > 2) {
    points.push(points[0].clone());
  }

  return points;
}

/**
 * Smooth a set of points using Catmull-Rom interpolation
 */
function smoothContour(points: THREE.Vector3[], segments: number = 4): THREE.Vector3[] {
  if (points.length < 3) return points;

  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  return curve.getPoints(points.length * segments);
}

export function SurfaceContours({ isDark, show = true, animated = true }: SurfaceContoursProps) {
  const groupRef = useRef<THREE.Group>(null);
  const quality = useMemo(() => getQualitySettings(), []);

  // Determine if we should render (but hooks still run)
  // ALL hooks must be called before any early returns (Rules of Hooks)
  const shouldRender = show && quality.enableContours;

  // Pre-compute all contour lines (runs once)
  const contourLines = useMemo(() => {
    return CONTOUR_LEVELS.map((level) => {
      const rawPoints = generateEllipticalContour(level, ELLIPSE_SAMPLES);
      const smoothedPoints = smoothContour(rawPoints, 3);

      return {
        level,
        points: smoothedPoints,
        isHighlight: HIGHLIGHT_LEVELS.has(level),
      };
    }).filter((c) => c.points.length >= 3);
  }, []);

  // Animated pulse effect on highlighted contours
  useFrame((state) => {
    if (!animated || !groupRef.current || !shouldRender) return;

    const time = state.clock.elapsedTime;

    // Pulse effect - subtle scale animation
    groupRef.current.children.forEach((child, index) => {
      if (child instanceof THREE.Line) {
        const contour = contourLines[index];
        if (contour?.isHighlight) {
          // Subtle y-offset pulsing
          const pulse = Math.sin(time * 2 + contour.level) * 0.003;
          child.position.y = pulse;
        }
      }
    });
  });

  // Color palette based on theme
  const colors = useMemo(
    () => ({
      // Low cost contours (near minimum)
      low: isDark ? '#22d3ee' : '#0891b2', // Cyan
      // Mid cost contours
      mid: isDark ? '#a78bfa' : '#7c3aed', // Purple
      // High cost contours
      high: isDark ? '#fb7185' : '#e11d48', // Rose
      // Highlight glow
      glow: isDark ? '#67e8f9' : '#06b6d4',
    }),
    [isDark]
  );

  // Get color based on cost level
  const getContourColor = (level: number): string => {
    if (level <= 1) return colors.low;
    if (level <= 5) return colors.mid;
    return colors.high;
  };

  // Get opacity based on cost level (lower = more visible)
  const getContourOpacity = (level: number, isHighlight: boolean): number => {
    if (isHighlight) return 0.8;
    if (level <= 1) return 0.6;
    if (level <= 5) return 0.5;
    return 0.35;
  };

  // Early return AFTER all hooks (Rules of Hooks compliance)
  if (!shouldRender) return null;

  return (
    <group ref={groupRef} name="surface-contours">
      {contourLines.map(({ level, points, isHighlight }) => (
        <Line
          key={`contour-${level}`}
          points={points}
          color={getContourColor(level)}
          lineWidth={isHighlight ? 2.5 : 1.5}
          transparent
          opacity={getContourOpacity(level, isHighlight)}
          dashed={!isHighlight}
          dashSize={isHighlight ? 0 : 0.1}
          dashOffset={0}
          gapSize={isHighlight ? 0 : 0.05}
        />
      ))}
    </group>
  );
}

export default SurfaceContours;
