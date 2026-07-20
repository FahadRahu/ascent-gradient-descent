import { computeDescentArrowPose } from './OptimizationCues';
import { getFunction } from '../engine/functions';
import { SURFACE_SIZE } from './surfaceMapping';

describe('computeDescentArrowPose', () => {
  it('maps the direction to a negative directional derivative', () => {
    const fn = getFunction('sphere');
    const theta = [2, 1] as const;
    const gradient = fn.grad(theta);
    const pose = computeDescentArrowPose('sphere', theta);
    expect(pose).not.toBeNull();

    const [xMin, xMax, yMin, yMax] = fn.domain;
    const parameterDx = (pose!.direction[0] * (xMax - xMin)) / SURFACE_SIZE;
    const parameterDy = (pose!.direction[2] * (yMax - yMin)) / SURFACE_SIZE;
    const directionalDerivative = gradient[0] * parameterDx + gradient[1] * parameterDy;

    expect(directionalDerivative).toBeLessThan(0);
    expect(pose!.direction[1]).toBeLessThan(0);
  });

  it('hides the arrow at a stationary point', () => {
    expect(computeDescentArrowPose('sphere', [0, 0])).toBeNull();
  });
});
