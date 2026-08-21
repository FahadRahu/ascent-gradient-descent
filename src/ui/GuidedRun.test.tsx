// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vi } from 'vitest';
import type { ResponsiveTabId } from './ResponsiveTabs';
import { GuidedRun } from './GuidedRun';

const driverMocks = vi.hoisted(() => {
  let importGate = Promise.resolve();
  let releaseImport: (() => void) | null = null;
  const instance = {
    destroy: vi.fn(),
    drive: vi.fn(),
    isActive: vi.fn(() => true),
    moveNext: vi.fn(),
    movePrevious: vi.fn(),
  };
  return {
    factory: vi.fn<(config: Record<string, any>) => typeof instance>(() => instance),
    instance,
    deferImport: () => {
      importGate = new Promise<void>((resolve) => {
        releaseImport = resolve;
      });
    },
    releaseImport: () => {
      releaseImport?.();
      releaseImport = null;
    },
    waitForImport: () => importGate,
  };
});

vi.mock('driver.js', async () => {
  await driverMocks.waitForImport();
  return { driver: driverMocks.factory };
});

describe('GuidedRun', () => {
  let container: HTMLDivElement;
  let root: Root;
  const selectTab = vi.fn<(tab: ResponsiveTabId) => void>();

  beforeEach(() => {
    driverMocks.factory.mockReset();
    driverMocks.factory.mockReturnValue(driverMocks.instance);
    driverMocks.instance.destroy.mockReset();
    driverMocks.instance.drive.mockReset();
    driverMocks.instance.isActive.mockReset();
    driverMocks.instance.isActive.mockReturnValue(true);
    driverMocks.instance.moveNext.mockReset();
    driverMocks.instance.movePrevious.mockReset();

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    selectTab.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (graphicsStatus: 'loading' | 'ready' | 'unavailable' = 'ready') => {
    act(() => {
      root.render(
        <GuidedRun
          graphicsStatus={graphicsStatus}
          activeTab="setup"
          onSelectTab={selectTab}
        />,
      );
    });
    return container.querySelector<HTMLButtonElement>('.guided-run-trigger')!;
  };

  const start = async (button: HTMLButtonElement) => {
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(driverMocks.factory).toHaveBeenCalledTimes(1));
  };

  it('is opt-in and unavailable until the graphics controls are ready', () => {
    const button = render('loading');

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Guided run');
    expect(driverMocks.factory).not.toHaveBeenCalled();
  });

  it('shows loading feedback while the tour bundle is pending', async () => {
    driverMocks.deferImport();
    const button = render();

    act(() => button.click());

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Loading guide');
    expect(button.querySelector('.lucide-loader-circle')).not.toBeNull();

    await act(async () => {
      driverMocks.releaseImport();
      await vi.waitFor(() => {
        expect(driverMocks.factory).toHaveBeenCalledTimes(1);
      });
    });
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(button.querySelector('.lucide-loader-circle')).toBeNull();
  });

  it('starts a five-step reduced-motion tour without writing browser storage', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const button = render();

    await start(button);

    const config = driverMocks.factory.mock.calls[0]![0];
    expect(config.animate).toBe(false);
    expect(config.disableActiveInteraction).toBe(true);
    expect(config.showProgress).toBe(true);
    expect(config.steps).toHaveLength(5);
    expect(config.steps.map((step: { element: string }) => step.element)).toEqual([
      '[data-tour="landscape"]',
      '[data-tour="optimizer"]',
      '[data-tour="learning-rate"]',
      '[data-tour="transport"]',
      '[data-tour="scrubber"]',
    ]);
    expect(driverMocks.instance.drive).toHaveBeenCalledTimes(1);
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it('coordinates responsive tabs before moving between transport and scrubber', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const button = render();
    await start(button);
    const config = driverMocks.factory.mock.calls[0]![0];
    const transport = config.steps[3].popover;

    act(() => transport.onNextClick());
    expect(selectTab).toHaveBeenLastCalledWith('playback');
    act(() => {
      while (frames.length > 0) frames.shift()!(0);
    });
    expect(driverMocks.instance.moveNext).toHaveBeenCalledTimes(1);

    act(() => transport.onPrevClick());
    expect(selectTab).toHaveBeenLastCalledWith('setup');
    act(() => {
      while (frames.length > 0) frames.shift()!(0);
    });
    expect(driverMocks.instance.movePrevious).toHaveBeenCalledTimes(1);

    act(() => {
      config.onDestroyStarted(undefined, config.steps[3], {
        driver: driverMocks.instance,
      });
      while (frames.length > 0) frames.shift()!(0);
    });
    expect(selectTab).toHaveBeenLastCalledWith('setup');
    expect(driverMocks.instance.destroy).toHaveBeenCalledTimes(1);
    expect(button).toBe(document.activeElement);
  });

  it('surfaces a retry state when the lazy tour cannot start', async () => {
    driverMocks.factory.mockImplementationOnce(() => {
      throw new Error('driver failed');
    });
    const button = render();

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(button.textContent).toContain('Try guided run again');
    });
    expect(container.getAttribute('data-driver-active')).toBeNull();
    expect(container.textContent).toContain('The guided run could not load. Try again.');
  });
});