import type { Vec2 } from '../types';
import { clamp } from '../util/geometry';

/**
 * Camera. (cx, cy) is the world point at the center of the canvas.
 * Kept outside React/zustand: panning and zooming must never cause renders.
 */
export interface Viewport {
  cx: number;
  cy: number;
  zoom: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;

export const viewport: Viewport = { cx: 0, cy: 0, zoom: 1 };

/** w/h are the canvas size in CSS pixels. */
export function worldToScreen(vp: Viewport, p: Vec2, w: number, h: number): Vec2 {
  return { x: (p.x - vp.cx) * vp.zoom + w / 2, y: (p.y - vp.cy) * vp.zoom + h / 2 };
}

export function screenToWorld(vp: Viewport, p: Vec2, w: number, h: number): Vec2 {
  return { x: (p.x - w / 2) / vp.zoom + vp.cx, y: (p.y - h / 2) / vp.zoom + vp.cy };
}

/** Drag the world by (dx, dy) screen pixels. */
export function panBy(vp: Viewport, dx: number, dy: number): void {
  vp.cx -= dx / vp.zoom;
  vp.cy -= dy / vp.zoom;
}

/** Multiply zoom by factor, keeping the world point under `screen` fixed. */
export function zoomAt(vp: Viewport, screen: Vec2, factor: number, w: number, h: number): void {
  const before = screenToWorld(vp, screen, w, h);
  vp.zoom = clamp(vp.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const after = screenToWorld(vp, screen, w, h);
  vp.cx += before.x - after.x;
  vp.cy += before.y - after.y;
}
