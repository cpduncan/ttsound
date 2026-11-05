import { useSceneStore } from '../store/sceneStore';
import type { EmitterRuntime } from '../types';
import { EmitterPlayer } from './EmitterPlayer';

const TICK_MS = 50;
/** Events that browsers accept as a user activation for audio. pointerdown/keydown cover desktop; the rest cover iOS/Android. */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'] as const;

/**
 * Framework-agnostic. Owns the AudioContext and one EmitterPlayer per emitter.
 * Never touches React. Reads the scene straight from the zustand store.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly players = new Map<string, EmitterPlayer>();
  private timer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private started = false;
  private unlockInstalled = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.installUnlockListeners();
    this.unsubscribe = useSceneStore.subscribe((state, prev) => {
      if (state.scene.emitters !== prev.scene.emitters) this.sync();
    });
    // setInterval (not rAF) so playback logic keeps running in background tabs.
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.sync();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.removeUnlockListeners();
    this.disposeAll();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.master = null;
    }
  }

  /**
   * Call at the start of any user-initiated action that can lead to audio.
   * Creates the AudioContext lazily (inside a user gesture) and resumes it.
   */
  ensureUnlocked(): void {
    if (!this.ctx) this.createContext();
    const ctx = this.ctx;
    if (ctx && ctx.state !== 'running') {
      ctx.resume().then(
        () => this.checkRunning(),
        () => undefined,
      );
    }
  }

  getRuntime(emitterId: string): EmitterRuntime | null {
    return this.players.get(emitterId)?.getRuntime() ?? null;
  }

  skipNext(emitterId: string): void {
    this.ensureUnlocked();
    this.players.get(emitterId)?.skipNext();
  }

  /** Stop and free every player (used before replacing the scene). */
  disposeAll(): void {
    for (const p of this.players.values()) p.dispose();
    this.players.clear();
  }

  // --------------------------------------------------------------- private

  private createContext(): void {
    try {
      const ctx = new AudioContext({ latencyHint: 'playback' });
      const master = ctx.createGain();
      master.gain.value = 1; // master volume is already folded into each emitter's gain (computeGain)
      master.connect(ctx.destination);
      ctx.addEventListener('statechange', () => {
        if (ctx.state === 'running') this.removeUnlockListeners();
        else if (this.started) this.installUnlockListeners(); // e.g. iOS interruption
      });
      this.ctx = ctx;
      this.master = master;
      this.sync();
    } catch (err) {
      console.error('Web Audio is not available', err);
    }
  }

  private sync(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const { scene } = useSceneStore.getState();
    const seen = new Set<string>();
    for (const e of scene.emitters) {
      seen.add(e.id);
      const existing = this.players.get(e.id);
      if (existing) existing.setConfig(e);
      else this.players.set(e.id, new EmitterPlayer(ctx, master, e));
    }
    for (const [id, p] of this.players) {
      if (!seen.has(id)) {
        p.dispose();
        this.players.delete(id);
      }
    }
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { scene } = useSceneStore.getState();
    const now = performance.now();
    const running = ctx.state === 'running';
    for (const e of scene.emitters) {
      this.players.get(e.id)?.update(scene.listener.position, scene.masterVolume, now, running);
    }
  }

  private checkRunning(): void {
    if (this.ctx?.state === 'running') this.removeUnlockListeners();
  }

  private readonly onGesture = (): void => {
    this.ensureUnlocked();
  };

  private installUnlockListeners(): void {
    if (this.unlockInstalled) return;
    this.unlockInstalled = true;
    for (const type of UNLOCK_EVENTS) {
      document.addEventListener(type, this.onGesture, { capture: true, passive: true });
    }
  }

  private removeUnlockListeners(): void {
    if (!this.unlockInstalled) return;
    this.unlockInstalled = false;
    for (const type of UNLOCK_EVENTS) {
      document.removeEventListener(type, this.onGesture, { capture: true });
    }
  }
}

export const audioEngine = new AudioEngine();
