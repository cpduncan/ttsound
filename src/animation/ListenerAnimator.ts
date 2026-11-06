import { useAnimationStore } from '../store/animationStore';
import { useSceneStore } from '../store/sceneStore';
import { stepToward } from './step';

const TICK_MS = 16;

/**
 * Moves the listener toward the animation target. Framework-agnostic, never touches React.
 * Uses setInterval + performance.now() (not rAF) so travel keeps going, time-correct,
 * in background tabs just like the audio engine.
 */
export class ListenerAnimator {
  private timer: number | null = null;
  private last = 0;

  start(): void {
    if (this.timer !== null) return;
    this.last = performance.now();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const now = performance.now();
    const dt = (now - this.last) / 1000;
    this.last = now; // always advance, so paused time never turns into a jump on resume

    const anim = useAnimationStore.getState();
    if (!anim.playing || anim.target === null) return;

    const scene = useSceneStore.getState();
    const { position, arrived } = stepToward(scene.scene.listener.position, anim.target, anim.speed, dt);
    scene.moveListener(position);
    if (arrived) anim.clearTarget();
  }
}

export const listenerAnimator = new ListenerAnimator();
