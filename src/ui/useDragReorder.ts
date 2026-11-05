import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export interface DragReorderOptions {
  /** Number of rows. */
  count: number;
  /** `to` is the final index of the moved row in the resulting list. */
  onReorder: (from: number, to: number) => void;
  /** The scrollable element holding the rows (enables edge auto-scroll). */
  getContainer?: () => HTMLElement | null;
}

export interface HandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  style: CSSProperties;
}

export interface DragReorderApi {
  /** Index being dragged, or null. */
  dragIndex: number | null;
  /** Ref callback factory: <div ref={registerRow(i)}> */
  registerRow: (index: number) => (el: HTMLElement | null) => void;
  /** Spread onto the drag handle element. */
  getHandleProps: (index: number) => HandleProps;
  /** Inline style for each row (translate + gap animation). */
  getRowStyle: (index: number) => CSSProperties;
}

interface Session {
  pointerId: number;
  from: number;
  startY: number;
  startScroll: number;
  rects: { top: number; height: number }[];
  lastClientY: number;
  target: number;
}

interface View {
  from: number;
  target: number;
  dy: number;
  height: number;
}

const EDGE_PX = 36;
const MAX_SCROLL_SPEED = 14;

/**
 * Generic pointer-based drag reordering (mouse + touch). Native HTML5 drag and drop
 * does not fire on touch screens, so this uses Pointer Events + pointer capture.
 * Not tied to tracks: it only knows row count and an onReorder callback.
 */
export function useDragReorder(options: DragReorderOptions): DragReorderApi {
  const optsRef = useRef(options);
  optsRef.current = options;

  const rowEls = useRef<(HTMLElement | null)[]>([]);
  const session = useRef<Session | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const keyHandler = useRef<((e: KeyboardEvent) => void) | null>(null);
  const [view, setView] = useState<View | null>(null);

  const compute = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const container = optsRef.current.getContainer?.() ?? null;
    const scrollDelta = container ? container.scrollTop - s.startScroll : 0;
    const dy = s.lastClientY - s.startY + scrollDelta;
    let target = 0;
    for (let i = 0; i < s.rects.length; i++) {
      if (i === s.from) continue;
      const r = s.rects[i];
      // Rows moved up by scrollDelta in viewport coordinates since the drag began.
      const mid = r.top + r.height / 2 - scrollDelta;
      if (mid < s.lastClientY) target++;
    }
    s.target = target;
    setView({ from: s.from, target, dy, height: s.rects[s.from].height });
  }, []);

  const stop = useCallback(() => {
    session.current = null;
    if (scrollTimer.current !== null) window.clearInterval(scrollTimer.current);
    scrollTimer.current = null;
    if (keyHandler.current) window.removeEventListener('keydown', keyHandler.current);
    keyHandler.current = null;
    setView(null);
  }, []);

  useEffect(() => stop, [stop]); // cleanup on unmount

  const begin = useCallback(
    (e: ReactPointerEvent<HTMLElement>, index: number) => {
      if (session.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const count = optsRef.current.count;
      const rects: Session['rects'] = [];
      for (let i = 0; i < count; i++) {
        const el = rowEls.current[i];
        if (!el) return;
        const r = el.getBoundingClientRect();
        rects.push({ top: r.top, height: r.height });
      }
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const container = optsRef.current.getContainer?.() ?? null;
      session.current = {
        pointerId: e.pointerId,
        from: index,
        startY: e.clientY,
        startScroll: container ? container.scrollTop : 0,
        rects,
        lastClientY: e.clientY,
        target: index,
      };
      compute();

      // Auto-scroll while the pointer sits near the top/bottom edge of the list.
      scrollTimer.current = window.setInterval(() => {
        const s = session.current;
        const c = optsRef.current.getContainer?.() ?? null;
        if (!s || !c) return;
        const cr = c.getBoundingClientRect();
        let speed = 0;
        if (s.lastClientY < cr.top + EDGE_PX) speed = -MAX_SCROLL_SPEED * Math.min(1, (cr.top + EDGE_PX - s.lastClientY) / EDGE_PX);
        else if (s.lastClientY > cr.bottom - EDGE_PX) speed = MAX_SCROLL_SPEED * Math.min(1, (s.lastClientY - (cr.bottom - EDGE_PX)) / EDGE_PX);
        if (speed === 0) return;
        const before = c.scrollTop;
        c.scrollTop = before + speed;
        if (c.scrollTop !== before) compute();
      }, 16);

      keyHandler.current = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') stop(); // cancel without reordering
      };
      window.addEventListener('keydown', keyHandler.current);
    },
    [compute, stop],
  );

  const move = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = session.current;
      if (!s || s.pointerId !== e.pointerId) return;
      s.lastClientY = e.clientY;
      compute();
    },
    [compute],
  );

  const end = useCallback(
    (e: ReactPointerEvent<HTMLElement>, commit: boolean) => {
      const s = session.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const { from, target } = s;
      stop();
      if (commit && from !== target) optsRef.current.onReorder(from, target);
    },
    [stop],
  );

  const registerRow = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      rowEls.current[index] = el;
    },
    [],
  );

  const getHandleProps = (index: number): HandleProps => ({
    onPointerDown: (e) => begin(e, index),
    onPointerMove: move,
    onPointerUp: (e) => end(e, true),
    onPointerCancel: (e) => end(e, false),
    style: { touchAction: 'none', cursor: view ? 'grabbing' : 'grab' },
  });

  const getRowStyle = (index: number): CSSProperties => {
    if (!view) return {};
    if (index === view.from) {
      return {
        position: 'relative',
        zIndex: 5,
        transform: `translateY(${view.dy}px)`,
        transition: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        outline: '1px solid #5ab0ff',
      };
    }
    let shift = 0;
    if (view.from < view.target && index > view.from && index <= view.target) shift = -view.height;
    else if (view.from > view.target && index >= view.target && index < view.from) shift = view.height;
    return {
      position: 'relative',
      transform: shift !== 0 ? `translateY(${shift}px)` : undefined,
      transition: 'transform 120ms ease',
    };
  };

  return { dragIndex: view ? view.from : null, registerRow, getHandleProps, getRowStyle };
}
