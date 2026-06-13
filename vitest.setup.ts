import { afterEach, vi } from 'vitest';

// requestAnimationFrame / cancelAnimationFrame shims (jsdom/happy-dom + node).
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number);
  globalThis.cancelAnimationFrame = ((id: number): void =>
    clearTimeout(id as unknown as NodeJS.Timeout));
}

afterEach(() => {
  vi.restoreAllMocks();
});
