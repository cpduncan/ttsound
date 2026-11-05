export interface GainInput {
  /** Listener-to-emitter-center distance, world units. */
  distance: number;
  radius: number;
  /** Emitter's own set volume, 0..1. */
  volume: number;
  masterVolume: number;
  muted: boolean;
}

/** Listener is inside iff strictly closer than the radius. */
export function isInside(distance: number, radius: number): boolean {
  return distance < radius;
}

/**
 * Linear proximity gain.
 * gain = volume * master * max(0, 1 - d/radius). Muted = 0.
 * d = 0.5*radius, volume 1, master 1 -> 0.5. d = 0.25*radius -> 0.75.
 */
export function computeGain(i: GainInput): number {
  if (i.muted || i.radius <= 0) return 0;
  const proximity = Math.max(0, 1 - i.distance / i.radius);
  return i.volume * i.masterVolume * proximity;
}
