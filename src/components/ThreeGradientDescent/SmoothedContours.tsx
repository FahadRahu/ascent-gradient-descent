/**
 * SmoothedContours Component (Phase C3.2)
 * 
 * Enhanced contour lines using marching squares algorithm for smooth isolines.
 * Provides cleaner, anti-aliased contour visualization compared to grid-based approach.
 * 
 * Features:
 * - Marching squares for accurate isoline extraction
 * - CatmullRom smoothing for anti-aliased appearance
 * - Color intensity based on cost level
 * - Theme-aware coloring
 * - Desktop-only for performance
 */

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { computeCost, paramsToThreeCoords } from './utils/costFunction';

interface SmoothedContoursProps {
  /** Theme mode */
  isDark: boolean;
  /** Cost levels to draw contours at */
  levels?: number[];
  /** Grid resolution for marching squares */
  resolution?: number;
  /** Parameter bounds */
  wRange?: [number, number];
  bRange?: [number, number];
}

export function SmoothedContours({ 
  isDark, 
  levels = [0.5, 1, 2, 4, 6, 8], 
  resolution = 60,
  wRange = [-2, 4],
  bRange = [-2, 6]
}: SmoothedContoursProps) {
  
  const contourLines = useMemo(() => {
    const lines: { points: THREE.Vector3[]; level: number }[] = [];
    
    // Generate cost grid
    const grid = generateCostGrid(resolution, wRange, bRange);
    
    levels.forEach(level => {
      // Extract isoline segments using marching squares
      const segments = marchingSquares(grid, level, resolution, wRange, bRange);
      
      if (segments.length > 0) {
        // Connect segments into continuous lines
        const connectedLines = connectSegments(segments);
        
        connectedLines.forEach(linePoints => {
          if (linePoints.length >= 2) {
            // Smooth the line
            const smoothed = smoothLine(linePoints);
            
            // Convert to 3D coordinates on surface
            // Add small Y offset (0.025) to prevent z-fighting with the surface
            const CONTOUR_Y_OFFSET = 0.025;
            const points3D = smoothed.map(p => {
              const cost = computeCost(p.x, p.y);
              const coords = paramsToThreeCoords(p.x, p.y, cost);
              return new THREE.Vector3(coords[0], coords[1] + CONTOUR_Y_OFFSET, coords[2]);
            });
            
            if (points3D.length >= 2) {
              lines.push({ points: points3D, level });
            }
          }
        });
      }
    });
    
    return lines;
  }, [levels, resolution, wRange, bRange]);
  
  const maxLevel = Math.max(...levels);
  
  return (
    <group>
      {contourLines.map((line, i) => {
        // Color intensity based on level (lower = brighter)
        const intensity = 1 - (line.level / maxLevel) * 0.5;
        const baseColor = isDark ? '#94a3b8' : '#64748b';
        const color = new THREE.Color(baseColor).multiplyScalar(intensity);
        
        return (
          <Line
            key={`${line.level}-${i}`}
            points={line.points}
            color={color}
            lineWidth={1.5}
            transparent
            opacity={0.4 + intensity * 0.3}
          />
        );
      })}
    </group>
  );
}

/**
 * Generate a 2D grid of cost values
 */
function generateCostGrid(
  resolution: number, 
  wRange: [number, number], 
  bRange: [number, number]
): number[][] {
  const grid: number[][] = [];
  
  for (let i = 0; i <= resolution; i++) {
    const row: number[] = [];
    const w = wRange[0] + (i / resolution) * (wRange[1] - wRange[0]);
    
    for (let j = 0; j <= resolution; j++) {
      const b = bRange[0] + (j / resolution) * (bRange[1] - bRange[0]);
      row.push(computeCost(w, b));
    }
    
    grid.push(row);
  }
  
  return grid;
}

/**
 * Marching Squares Algorithm
 * Returns line segments for the given cost level
 */
function marchingSquares(
  grid: number[][],
  level: number,
  resolution: number,
  wRange: [number, number],
  bRange: [number, number]
): Array<[THREE.Vector2, THREE.Vector2]> {
  const segments: Array<[THREE.Vector2, THREE.Vector2]> = [];
  
  const cellWidth = (wRange[1] - wRange[0]) / resolution;
  const cellHeight = (bRange[1] - bRange[0]) / resolution;
  
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      // Get the 4 corner values
      const v0 = grid[i][j];
      const v1 = grid[i + 1][j];
      const v2 = grid[i + 1][j + 1];
      const v3 = grid[i][j + 1];
      
      // Calculate cell index (0-15)
      let cellIndex = 0;
      if (v0 > level) cellIndex |= 1;
      if (v1 > level) cellIndex |= 2;
      if (v2 > level) cellIndex |= 4;
      if (v3 > level) cellIndex |= 8;
      
      // Skip empty or full cells
      if (cellIndex === 0 || cellIndex === 15) continue;
      
      // Cell corner positions in parameter space
      const x0 = wRange[0] + i * cellWidth;
      const x1 = wRange[0] + (i + 1) * cellWidth;
      const y0 = bRange[0] + j * cellHeight;
      const y1 = bRange[0] + (j + 1) * cellHeight;
      
      // Interpolate edge crossing points
      const interpolate = (v1Val: number, v2Val: number, p1: number, p2: number): number => {
        const t = (level - v1Val) / (v2Val - v1Val);
        return p1 + t * (p2 - p1);
      };
      
      // Edge midpoints (interpolated)
      const leftY = interpolate(v0, v3, y0, y1);
      const rightY = interpolate(v1, v2, y0, y1);
      const bottomX = interpolate(v0, v1, x0, x1);
      const topX = interpolate(v3, v2, x0, x1);
      
      const left = new THREE.Vector2(x0, leftY);
      const right = new THREE.Vector2(x1, rightY);
      const bottom = new THREE.Vector2(bottomX, y0);
      const top = new THREE.Vector2(topX, y1);
      
      // Lookup table for segment configurations
      switch (cellIndex) {
        case 1: case 14:
          segments.push([left, bottom]);
          break;
        case 2: case 13:
          segments.push([bottom, right]);
          break;
        case 3: case 12:
          segments.push([left, right]);
          break;
        case 4: case 11:
          segments.push([right, top]);
          break;
        case 5:
          // Saddle point - use average to determine connection
          segments.push([left, top]);
          segments.push([bottom, right]);
          break;
        case 6: case 9:
          segments.push([bottom, top]);
          break;
        case 7: case 8:
          segments.push([left, top]);
          break;
        case 10:
          // Saddle point
          segments.push([left, bottom]);
          segments.push([right, top]);
          break;
      }
    }
  }
  
  return segments;
}

/**
 * Connect segments into continuous polylines
 */
function connectSegments(
  segments: Array<[THREE.Vector2, THREE.Vector2]>
): THREE.Vector2[][] {
  if (segments.length === 0) return [];
  
  const lines: THREE.Vector2[][] = [];
  const used = new Set<number>();
  const threshold = 0.001; // Distance threshold for connecting points
  
  const distance = (a: THREE.Vector2, b: THREE.Vector2): number => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  };
  
  const findNearestUnused = (point: THREE.Vector2, excludeIdx: number): { idx: number; end: 0 | 1 } | null => {
    let nearest: { idx: number; end: 0 | 1; dist: number } | null = null;
    
    for (let i = 0; i < segments.length; i++) {
      if (used.has(i) || i === excludeIdx) continue;
      
      const d0 = distance(point, segments[i][0]);
      const d1 = distance(point, segments[i][1]);
      
      if (d0 < threshold && (!nearest || d0 < nearest.dist)) {
        nearest = { idx: i, end: 0, dist: d0 };
      }
      if (d1 < threshold && (!nearest || d1 < nearest.dist)) {
        nearest = { idx: i, end: 1, dist: d1 };
      }
    }
    
    return nearest;
  };
  
  // Build connected lines
  for (let startIdx = 0; startIdx < segments.length; startIdx++) {
    if (used.has(startIdx)) continue;
    
    const line: THREE.Vector2[] = [...segments[startIdx]];
    used.add(startIdx);
    
    // Extend from end
    let extending = true;
    while (extending) {
      const lastPoint = line[line.length - 1];
      const found = findNearestUnused(lastPoint, -1);
      
      if (found) {
        used.add(found.idx);
        const seg = segments[found.idx];
        if (found.end === 0) {
          line.push(seg[1]);
        } else {
          line.push(seg[0]);
        }
      } else {
        extending = false;
      }
    }
    
    // Extend from start
    extending = true;
    while (extending) {
      const firstPoint = line[0];
      const found = findNearestUnused(firstPoint, -1);
      
      if (found) {
        used.add(found.idx);
        const seg = segments[found.idx];
        if (found.end === 0) {
          line.unshift(seg[1]);
        } else {
          line.unshift(seg[0]);
        }
      } else {
        extending = false;
      }
    }
    
    if (line.length >= 2) {
      lines.push(line);
    }
  }
  
  return lines;
}

/**
 * Smooth a polyline using Catmull-Rom spline
 */
function smoothLine(points: THREE.Vector2[]): THREE.Vector2[] {
  if (points.length < 3) return points;
  
  // Convert to Vector3 for CatmullRomCurve3
  const points3D = points.map(p => new THREE.Vector3(p.x, p.y, 0));
  
  // Check if line is closed (first and last points are close)
  const isClosed = points[0].distanceTo(points[points.length - 1]) < 0.1;
  
  const curve = new THREE.CatmullRomCurve3(points3D, isClosed, 'catmullrom', 0.5);
  const smoothed = curve.getPoints(points.length * 3);
  
  // Convert back to Vector2
  return smoothed.map(p => new THREE.Vector2(p.x, p.y));
}

export default SmoothedContours;
