import { computeGain, isInside } from '../audio/gain';
import type { Scene } from '../types';
import { dist } from '../util/geometry';
import { worldToScreen, type Viewport } from './viewport';

export interface RenderSize {
  /** CSS pixels */
  width: number;
  height: number;
  dpr: number;
}

const BG = '#181818';
const GRID = 'rgba(255,255,255,0.06)';
const EMITTER = '#5ab0ff';
const EMITTER_MUTED = '#888888';
const TEXT = '#e6e6e6';
const LISTENER = '#ffb347';

function drawGrid(ctx: CanvasRenderingContext2D, size: RenderSize, vp: Viewport): void {
  let spacing = 100;
  while (spacing * vp.zoom < 24) spacing *= 5; // keep the grid readable when zoomed out
  const { width: w, height: h } = size;
  const left = vp.cx - w / 2 / vp.zoom;
  const right = vp.cx + w / 2 / vp.zoom;
  const top = vp.cy - h / 2 / vp.zoom;
  const bottom = vp.cy + h / 2 / vp.zoom;
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.floor(left / spacing) * spacing; x <= right; x += spacing) {
    const sx = Math.round((x - vp.cx) * vp.zoom + w / 2) + 0.5;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  for (let y = Math.floor(top / spacing) * spacing; y <= bottom; y += spacing) {
    const sy = Math.round((y - vp.cy) * vp.zoom + h / 2) + 0.5;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();
}

export function render(
  ctx: CanvasRenderingContext2D,
  size: RenderSize,
  scene: Scene,
  selectedId: string | null,
  vp: Viewport,
): void {
  const { width: w, height: h, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, size, vp);

  const listener = scene.listener.position;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '12px system-ui, sans-serif';

  for (const e of scene.emitters) {
    const c = worldToScreen(vp, e.position, w, h);
    const r = e.radius * vp.zoom;
    const d = dist(listener, e.position);
    const active = isInside(d, e.radius);
    const color = e.muted ? EMITTER_MUTED : EMITTER;
    const selected = e.id === selectedId;

    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    if (active) {
      ctx.fillStyle = e.muted ? 'rgba(136,136,136,0.15)' : 'rgba(90,176,255,0.18)';
      ctx.fill();
    }
    ctx.setLineDash(e.muted ? [6, 4] : []);
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? '#ffffff' : color;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    let label = e.name;
    if (active) {
      const gain = computeGain({
        distance: d,
        radius: e.radius,
        volume: e.volume,
        masterVolume: scene.masterVolume,
        muted: e.muted,
      });
      label += `  ${Math.round(gain * 100)}%`;
    }
    ctx.fillStyle = TEXT;
    ctx.fillText(label, c.x, c.y - 9);
  }

  const l = worldToScreen(vp, listener, w, h);
  ctx.beginPath();
  ctx.arc(l.x, l.y, 14, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = LISTENER;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(l.x, l.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = LISTENER;
  ctx.fill();
}
