import { computeGain, isInside } from '../audio/gain';
import type { Scene, Vec2 } from '../types';
import { dist } from '../util/geometry';
import { worldToScreen, type Viewport } from './viewport';

export interface RenderSize {
  /** CSS pixels */
  width: number;
  height: number;
  dpr: number;
}

// Design tokens (keep in sync with :root in styles.css)
const BG = '#000000';
const DOT = '#27272a';
const ACCENT = '#3b82f6';
const ACCENT_BRIGHT = '#60a5fa';
const TINT = '#1e3a8a';
const TEXT = '#a1a1aa';
const TEXT_DIM = '#71717a';
const WHITE = '#ffffff';
const FONT = "12px 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const DOT_SPACING = 24; // world units; drawn on a 24 x 24 matrix at zoom 1
const MIN_DOT_PX = 10; // thin the matrix out when zoomed far out

function drawDotGrid(ctx: CanvasRenderingContext2D, size: RenderSize, vp: Viewport): void {
  let step = DOT_SPACING;
  while (step * vp.zoom < MIN_DOT_PX) step *= 2;
  const { width: w, height: h } = size;
  const left = vp.cx - w / 2 / vp.zoom;
  const right = vp.cx + w / 2 / vp.zoom;
  const top = vp.cy - h / 2 / vp.zoom;
  const bottom = vp.cy + h / 2 / vp.zoom;
  ctx.fillStyle = DOT;
  for (let x = Math.floor(left / step) * step; x <= right; x += step) {
    const sx = Math.round((x - vp.cx) * vp.zoom + w / 2);
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      const sy = Math.round((y - vp.cy) * vp.zoom + h / 2);
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  size: RenderSize,
  scene: Scene,
  selectedId: string | null,
  vp: Viewport,
  target: Vec2 | null = null,
): void {
  const { width: w, height: h, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  drawDotGrid(ctx, size, vp);

  const listener = scene.listener.position;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = FONT;

  for (const e of scene.emitters) {
    const c = worldToScreen(vp, e.position, w, h);
    const r = e.radius * vp.zoom;
    const d = dist(listener, e.position);
    const active = isInside(d, e.radius);
    const color = e.muted ? TEXT_DIM : ACCENT;
    const selected = e.id === selectedId;

    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    if (active) {
      ctx.globalAlpha = e.muted ? 0.25 : 0.55;
      ctx.fillStyle = e.muted ? DOT : TINT;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash(e.muted ? [6, 4] : []);
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected && !e.muted ? ACCENT_BRIGHT : color;
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

  if (target) {
    const t = worldToScreen(vp, target, w, h);
    // dotted path, new palette
    ctx.setLineDash([2, 7]);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = ACCENT_BRIGHT;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    // blue X with a sharp white outer stroke: white pass underneath, blue pass on top
    const s = 7;
    ctx.beginPath();
    ctx.moveTo(t.x - s, t.y - s);
    ctx.lineTo(t.x + s, t.y + s);
    ctx.moveTo(t.x + s, t.y - s);
    ctx.lineTo(t.x - s, t.y + s);
    ctx.lineWidth = 6;
    ctx.strokeStyle = WHITE;
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = ACCENT;
    ctx.stroke();
  }

  // listener: small bright-blue filled dot, sharp white outer stroke, plus label
  ctx.beginPath();
  ctx.arc(l.x, l.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = WHITE;
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.textBaseline = 'top';
  ctx.fillText('Listener', l.x, l.y + 12);
}
