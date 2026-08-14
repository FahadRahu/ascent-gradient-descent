import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Activity,
  BookOpenText,
  History,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

export type ResponsiveTabId = 'setup' | 'signal' | 'playback' | 'learn';

interface ResponsiveTabsProps {
  activeTab: ResponsiveTabId;
  onSelect: (tab: ResponsiveTabId) => void;
}

const TABS: readonly {
  id: ResponsiveTabId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'setup', label: 'Setup', icon: SlidersHorizontal },
  { id: 'signal', label: 'Signal', icon: Activity },
  { id: 'playback', label: 'Playback', icon: History },
  { id: 'learn', label: 'Learn', icon: BookOpenText },
];

export function ResponsiveTabs({
  activeTab,
  onSelect,
}: ResponsiveTabsProps) {
  const moveFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    tabIndex: number,
  ) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (tabIndex + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (tabIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();

    const nextTab = TABS[nextIndex];
    onSelect(nextTab.id);
    document.getElementById(`responsive-tab-${nextTab.id}`)?.focus();
  };

  return (
    <div
      className="responsive-tabs"
      role="tablist"
      aria-label="Lab controls"
      aria-orientation="horizontal"
    >
      {TABS.map((tab, index) => {
        const selected = tab.id === activeTab;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            id={`responsive-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`responsive-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={clsx(
              'inline-flex min-h-[44px] min-w-0 flex-1 touch-manipulation',
              'items-center justify-center gap-1 border-x-0 border-t-0',
              'border-b-2 bg-transparent px-2 text-label font-semibold',
              'transition-colors duration-150',
              selected
                ? 'border-cyan text-cyan'
                : 'border-transparent text-muted hover:text-text',
            )}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
