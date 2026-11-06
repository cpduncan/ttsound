import { create } from 'zustand';
import type { Vec2 } from '../types';

export const MIN_SPEED = 1;
export const SLIDER_MAX_SPEED = 1000;
export const DEFAULT_SPEED = 100;

/**
 * Runtime-only listener animation state. Deliberately NOT part of Scene:
 * it is never saved to the scene zip.
 */
interface AnimationState {
  /** World units per second. */
  speed: number;
  /** false = frozen in place (paused), true = moves whenever a target exists. */
  playing: boolean;
  /** "Animate Listener" was pressed; the next canvas click becomes the target. */
  armed: boolean;
  target: Vec2 | null;

  setSpeed: (v: number) => void;
  setPlaying: (v: boolean) => void;
  togglePlaying: () => void;
  toggleArmed: () => void;
  disarm: () => void;
  /** Places the target, leaves armed mode and starts playing. */
  setTarget: (p: Vec2) => void;
  clearTarget: () => void;
  /** Drops armed mode and any target (new scene, load scene). Keeps speed and play state. */
  cancelMotion: () => void;
}

export const useAnimationStore = create<AnimationState>()((set) => ({
  speed: DEFAULT_SPEED,
  playing: true,
  armed: false,
  target: null,

  setSpeed: (v) => set({ speed: Number.isFinite(v) ? Math.max(MIN_SPEED, v) : DEFAULT_SPEED }),
  setPlaying: (v) => set({ playing: v }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  toggleArmed: () => set((s) => ({ armed: !s.armed })),
  disarm: () => set((s) => (s.armed ? { armed: false } : s)),
  setTarget: (p) => set({ target: { x: p.x, y: p.y }, armed: false, playing: true }),
  clearTarget: () => set((s) => (s.target ? { target: null } : s)),
  cancelMotion: () => set({ armed: false, target: null }),
}));
