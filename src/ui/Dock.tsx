import type { ReactNode } from 'react';

interface DockProps {
  /** Used for the CSS hook `dock-<id>`. */
  id: string;
  side: 'left' | 'right';
  open: boolean;
  onToggle: () => void;
  /** Accessible name, e.g. "tools". */
  label: string;
  children: ReactNode;
}

/**
 * A panel docked to a screen edge with a hide/show handle tab.
 * The handle is a sibling of the scrolling body (not a child), so it is never
 * clipped, and it stays visible at the screen edge when the dock is closed.
 * Layout (desktop side panel vs. mobile bottom sheet) is pure CSS.
 */
export function Dock({ id, side, open, onToggle, label, children }: DockProps) {
  const openGlyph = side === 'left' ? '‹' : '›';
  const closedGlyph = side === 'left' ? '›' : '‹';
  return (
    <div className={`dock dock-${side} dock-${id} ${open ? 'open' : 'closed'}`}>
      <div className="dock-body">{children}</div>
      <button
        type="button"
        className="dock-handle"
        aria-label={`${open ? 'Hide' : 'Show'} ${label}`}
        aria-expanded={open}
        title={`${open ? 'Hide' : 'Show'} ${label}`}
        onClick={onToggle}
      >
        <span className="g-h">{open ? openGlyph : closedGlyph}</span>
        <span className="g-v">{open ? '▾' : '▴'}</span>
      </button>
    </div>
  );
}
