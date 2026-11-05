import type { Emitter, Scene, Vec2 } from '../types';
import { dist } from '../util/geometry';

export type Hit = { kind: 'none' } | { kind: 'listener' } | { kind: 'emitter'; id: string };

/** Hit sizes are in screen pixels so they feel the same at any zoom. */
const LISTENER_HIT_PX = 16;
const CENTER_HIT_PX = 10;

/**
 * Priority: listener, then an emitter's center dot (nearest), then emitter
 * circles (smallest radius wins when they overlap).
 */
export function hitTest(scene: Scene, world: Vec2, zoom: number): Hit {
  if (dist(world, scene.listener.position) <= LISTENER_HIT_PX / zoom) return { kind: 'listener' };

  let centerHit: Emitter | null = null;
  let centerDist = Infinity;
  let circleHit: Emitter | null = null;
  for (const e of scene.emitters) {
    const d = dist(world, e.position);
    if (d <= CENTER_HIT_PX / zoom && d < centerDist) {
      centerHit = e;
      centerDist = d;
    }
    if (d <= e.radius && (circleHit === null || e.radius < circleHit.radius)) circleHit = e;
  }
  const hit = centerHit ?? circleHit;
  return hit ? { kind: 'emitter', id: hit.id } : { kind: 'none' };
}
