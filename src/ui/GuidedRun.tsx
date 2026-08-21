import { Route } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Driver } from 'driver.js';
import type { GraphicsStatus } from './GraphicsState';
import type { ResponsiveTabId } from './ResponsiveTabs';

type LoadState = 'idle' | 'loading' | 'error';

interface GuidedRunProps {
  graphicsStatus: GraphicsStatus;
  activeTab: ResponsiveTabId;
  onSelectTab: (tab: ResponsiveTabId) => void;
}

function clearDriverTargetDialogAttributes(driver: Driver) {
  const target = driver.getActiveElement();
  target?.removeAttribute('aria-controls');
  target?.removeAttribute('aria-expanded');
  target?.removeAttribute('aria-haspopup');
}

export function GuidedRun({
  graphicsStatus,
  activeTab,
  onSelectTab,
}: GuidedRunProps) {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const driverRef = useRef<Driver | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingFrameRef = useRef(0);
  const launchTabRef = useRef<ResponsiveTabId>('setup');
  const closingRef = useRef(false);
  const mountedRef = useRef(true);

  const cancelPendingFrame = () => {
    if (pendingFrameRef.current !== 0) {
      window.cancelAnimationFrame(pendingFrameRef.current);
      pendingFrameRef.current = 0;
    }
  };

  const afterLayout = (callback: () => void) => {
    cancelPendingFrame();
    pendingFrameRef.current = window.requestAnimationFrame(() => {
      pendingFrameRef.current = window.requestAnimationFrame(() => {
        pendingFrameRef.current = 0;
        callback();
      });
    });
  };

  const moveAfterSelectingTab = (
    tab: ResponsiveTabId,
    move: (driver: Driver) => void,
  ) => {
    const instance = driverRef.current;
    if (!instance) return;

    onSelectTab(tab);
    afterLayout(() => {
      if (driverRef.current === instance && instance.isActive()) move(instance);
    });
  };

  const closeTour = (instance: Driver) => {
    if (closingRef.current) return;
    closingRef.current = true;
    onSelectTab(launchTabRef.current);
    afterLayout(() => {
      instance.destroy();
      if (driverRef.current === instance) driverRef.current = null;
      closingRef.current = false;
      if (mountedRef.current) {
        setLoadState('idle');
        triggerRef.current?.focus();
      }
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelPendingFrame();
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, []);

  const startTour = async () => {
    if (graphicsStatus !== 'ready' || loadState === 'loading') return;

    setLoadState('loading');
    launchTabRef.current = activeTab;
    closingRef.current = false;

    try {
      const [driverModule] = await Promise.all([
        import('driver.js'),
        import('driver.js/dist/driver.css'),
      ]);
      if (!mountedRef.current) return;

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const overlayColor =
        window.getComputedStyle(document.documentElement)
          .getPropertyValue('--color-void')
          .trim() || '#080b14';

      const instance = driverModule.driver({
        animate: !reducedMotion,
        duration: reducedMotion ? 0 : 180,
        smoothScroll: false,
        allowClose: true,
        allowScroll: true,
        disableActiveInteraction: true,
        overlayColor,
        overlayOpacity: 0.78,
        stagePadding: 8,
        stageRadius: 6,
        popoverOffset: 10,
        popoverClass: 'ascent-tour-popover',
        showProgress: true,
        progressText: 'Step {{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        doneBtnText: 'Done',
        onPopoverRender: (popover, { driver }) => {
          popover.wrapper.setAttribute('aria-modal', 'true');
          popover.closeButton.setAttribute('aria-label', 'Exit guided run');
          window.queueMicrotask(() => clearDriverTargetDialogAttributes(driver));
        },
        onHighlighted: (_element, _step, { driver }) => {
          clearDriverTargetDialogAttributes(driver);
        },
        onDestroyStarted: (_element, _step, { driver }) => {
          closeTour(driver);
        },
        onDoneClick: (_element, _step, { driver }) => {
          closeTour(driver);
        },
        steps: [
          {
            element: '[data-tour="landscape"]',
            popover: {
              title: 'Choose a landscape',
              description:
                'Pick the cost surface and behavior you want to explore.',
            },
          },
          {
            element: '[data-tour="optimizer"]',
            popover: {
              title: 'Choose an optimizer',
              description:
                'Compare how each update rule moves across the same landscape. Changing it starts a fresh run.',
            },
          },
          {
            element: '[data-tour="learning-rate"]',
            popover: {
              title: 'Set the learning rate',
              description:
                'Control the step size. Small values move carefully; large values can overshoot. Newton uses curvature instead.',
            },
          },
          {
            element: '[data-tour="transport"]',
            popover: {
              title: 'Run the experiment',
              description:
                'Run continuously, advance one iteration, restart the optimization, or reset the camera.',
              side: 'top',
              onNextClick: () => {
                moveAfterSelectingTab('playback', (driver) => driver.moveNext());
              },
              onPrevClick: () => {
                moveAfterSelectingTab('setup', (driver) => driver.movePrevious());
              },
            },
          },
          {
            element: '[data-tour="scrubber"]',
            popover: {
              title: 'Review retained history',
              description:
                'After the run has steps, move through earlier iterations without changing the true live endpoint.',
              side: 'top',
            },
          },
        ],
      });

      driverRef.current = instance;
      instance.drive();
      setLoadState('idle');
    } catch {
      if (mountedRef.current) setLoadState('error');
    }
  };

  const buttonLabel =
    loadState === 'loading'
      ? 'Loading guide'
      : loadState === 'error'
        ? 'Try guided run again'
        : 'Guided run';
  const statusMessage =
    loadState === 'loading'
      ? 'Loading the guided run.'
      : loadState === 'error'
        ? 'The guided run could not load. Try again.'
        : '';

  return (
    <div className="guided-run">
      <button
        ref={triggerRef}
        type="button"
        className="guided-run-trigger"
        data-state={loadState}
        disabled={graphicsStatus !== 'ready' || loadState === 'loading'}
        title="Tour the experiment controls"
        onClick={() => void startTour()}
      >
        <Route size={16} aria-hidden="true" />
        <span>{buttonLabel}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </span>
    </div>
  );
}