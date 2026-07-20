import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

interface HelpTooltipProps {
  id: string;
  label: string;
  description: string;
  side?: 'top' | 'bottom';
}

interface TooltipPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

export function HelpTooltip({
  id,
  label,
  description,
  side = 'bottom',
}: HelpTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [isPinned, setPinned] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const isOpen = isHovered || isFocused || isPinned;

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const margin = 12;
      const gap = 9;
      let placement = side;
      let top = placement === 'top'
        ? triggerRect.top - tooltipRect.height - gap
        : triggerRect.bottom + gap;

      if (placement === 'top' && top < margin) {
        placement = 'bottom';
        top = triggerRect.bottom + gap;
      } else if (
        placement === 'bottom' &&
        top + tooltipRect.height > window.innerHeight - margin
      ) {
        placement = 'top';
        top = triggerRect.top - tooltipRect.height - gap;
      }

      top = Math.min(
        Math.max(top, margin),
        window.innerHeight - tooltipRect.height - margin,
      );
      const left = Math.min(
        Math.max(triggerRect.right - tooltipRect.width, margin),
        window.innerWidth - tooltipRect.width - margin,
      );

      setPosition({ top, left, placement });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, side]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) return;
      setPinned(false);
      setFocused(false);
      setHovered(false);
    };

    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setFocused(false);
      setHovered(false);
      triggerRef.current?.blur();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isPinned) {
      setPinned(false);
      setFocused(false);
      setHovered(false);
      event.currentTarget.blur();
      return;
    }
    setPinned(true);
  };

  const tooltipStyle = position
    ? ({ top: position.top, left: position.left } satisfies CSSProperties)
    : undefined;

  return (
    <span
      className="help-tooltip"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        className="help-tooltip-trigger"
        aria-label={`Explain ${label}`}
        aria-describedby={id}
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={onClick}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      {isOpen && createPortal(
        <span
          ref={tooltipRef}
          id={id}
          className="help-tooltip-content"
          role="tooltip"
          data-placement={position?.placement ?? side}
          data-ready={position ? 'true' : 'false'}
          style={tooltipStyle}
        >
          <strong>{label}</strong>
          {description}
        </span>,
        document.body,
      )}
    </span>
  );
}
