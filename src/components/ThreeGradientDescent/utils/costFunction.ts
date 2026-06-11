/**
 * Cost Function Utilities for Gradient Descent Visualization
 * 
 * EDUCATIONAL VERSION: Uses Mean Squared Error (MSE) with sample data
 * 
 * Optimal point: (w ≈ 0.95, b ≈ 1.55) with cost ≈ 0.1406
 */

export const SAMPLE_DATA = {
  X: [1.0, 2.0, 3.0, 4.0],
  y: [2.0, 4.0, 5.0, 4.5],
};

export const SURFACE_SIZE = {
  width: 10,
  depth: 13,
};

export const COST_RANGE = {
  wMin: -2,
  wMax: 4,
  bMin: -2,
  bMax: 6,
};

export const OPTIMAL_PARAMS = {
  w: 0.95,
  b: 1.55,
  cost: 0.1406,
};

export const HEIGHT_SCALE = 0.12;
export const MAX_COST = 25;

export function computeCost(w: number, b: number): number {
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

export function computeGradients(w: number, b: number): { dw: number; db: number } {
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

export function meshToParams(
  x: number, 
  z: number
): { w: number; b: number } {
  const w = COST_RANGE.wMin + 
    ((x + SURFACE_SIZE.width / 2) / SURFACE_SIZE.width) * 
    (COST_RANGE.wMax - COST_RANGE.wMin);
  
  const b = COST_RANGE.bMin + 
    ((z + SURFACE_SIZE.depth / 2) / SURFACE_SIZE.depth) * 
    (COST_RANGE.bMax - COST_RANGE.bMin);
  
  return { w, b };
}

export function paramsToMesh(
  w: number, 
  b: number, 
  cost?: number
): [number, number, number] {
  const x = ((w - COST_RANGE.wMin) / (COST_RANGE.wMax - COST_RANGE.wMin) - 0.5) * SURFACE_SIZE.width;
  const z = ((b - COST_RANGE.bMin) / (COST_RANGE.bMax - COST_RANGE.bMin) - 0.5) * SURFACE_SIZE.depth;
  const actualCost = cost ?? computeCost(w, b);
  const y = actualCost * HEIGHT_SCALE;
  
  return [x, y, z];
}

export function paramsToThreeCoords(
  w: number, 
  b: number, 
  cost: number
): [number, number, number] {
  return paramsToMesh(w, b, cost);
}

export function normalizedToParams(
  normalizedX: number, 
  normalizedZ: number
): { w: number; b: number } {
  return meshToParams(normalizedX, normalizedZ);
}

export interface ColorStop {
  position: number;
  color: string;
}

export const LIGHT_MODE_COLORS: ColorStop[] = [
  { position: 0.0,  color: '#00ff88' },
  { position: 0.12, color: '#00e5ff' },
  { position: 0.25, color: '#0088ff' },
  { position: 0.40, color: '#7c3aed' },
  { position: 0.55, color: '#e11d9e' },
  { position: 0.70, color: '#ff6b00' },
  { position: 0.85, color: '#ff2222' },
  { position: 1.0,  color: '#cc0000' },
];

export const DARK_MODE_COLORS: ColorStop[] = [
  { position: 0.0,  color: '#00ffcc' },
  { position: 0.12, color: '#00ccff' },
  { position: 0.25, color: '#5588ff' },
  { position: 0.40, color: '#aa66ff' },
  { position: 0.55, color: '#ff55aa' },
  { position: 0.70, color: '#ff8822' },
  { position: 0.85, color: '#ff4444' },
  { position: 1.0,  color: '#ee1111' },
];

export function getCostColor(normalizedCost: number, isDark: boolean): string {
  const colors = isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS;
  const t = Math.max(0, Math.min(1, normalizedCost));
  
  let lower = colors[0];
  
  for (let i = 0; i < colors.length - 1; i++) {
    if (t >= colors[i].position && t <= colors[i + 1].position) {
      lower = colors[i];
      break;
    }
  }
  
  return lower.color;
}
