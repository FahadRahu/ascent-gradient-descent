// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useUIStore } from '../state/uiStore';
import { SimulationTransport } from './SimulationTransport';

describe('SimulationTransport', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useUIStore.getState().reset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const getButton = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('drives live simulation actions through Channel A', () => {
    act(() => {
      root.render(<SimulationTransport graphicsStatus="ready" />);
    });

    const primary = container.querySelector<HTMLButtonElement>(
      '.primary-action',
    )!;
    const stepRequest = useUIStore.getState().stepRequest;
    const runRevision = useUIStore.getState().runRevision;
    const cameraResetRequest = useUIStore.getState().cameraResetRequest;

    act(() => primary.click());
    expect(useUIStore.getState().isPlaying).toBe(true);

    act(() => getButton('Advance one iteration').click());
    expect(useUIStore.getState().isPlaying).toBe(false);
    expect(useUIStore.getState().stepRequest).toBe(stepRequest + 1);

    act(() => getButton('Restart optimization').click());
    expect(useUIStore.getState().runRevision).toBe(runRevision + 1);

    act(() => getButton('Reset camera view').click());
    expect(useUIStore.getState().cameraResetRequest)
      .toBe(cameraResetRequest + 1);
  });

  it('disables simulation actions while graphics are unavailable', () => {
    act(() => {
      root.render(<SimulationTransport graphicsStatus="unavailable" />);
    });

    expect(container.querySelector('.primary-action')?.textContent)
      .toContain('Unavailable');
    expect(getButton('Advance one iteration').disabled).toBe(true);
    expect(getButton('Restart optimization').disabled).toBe(true);
    expect(getButton('Reset camera view').disabled).toBe(true);
  });
});
