import type { Vec2 } from '../types';

export interface StepResult {
  position: Vec2;
  arrived: boolean;
}

/**
 * Pure. Moves `pos` toward `target` in a straight line at `speed` world units per
 * second for `dtSeconds`. Never overshoots: lands exactly on target and reports arrival.
 */
export function stepToward(pos: Vec2, target: Vec2, speed: number, dtSeconds: number): StepResult {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const distance = Math.hypot(dx, dy);
  const travel = Math.max(0, speed) * Math.max(0, dtSeconds);
  if (distance === 0 || travel >= distance) return { position: { x: target.x, y: target.y }, arrived: true };
  const k = travel / distance;
  return { position: { x: pos.x + dx * k, y: pos.y + dy * k }, arrived: false };
}
