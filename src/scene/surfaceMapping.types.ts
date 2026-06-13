/**
 * A cost function's sampling domain tuple: [xMin, xMax, yMin, yMax].
 *
 * Prefer importing this via `./surfaceMapping` (which re-exports it) so the
 * mapping module stays the single public entry point; this peer file exists only
 * to break a potential import cycle between surfaceMapping and its consumers.
 */
export type Domain = readonly [number, number, number, number];
