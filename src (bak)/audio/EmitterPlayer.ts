import type { Emitter, EmitterRuntime, PlayerState, Vec2 } from '../types';
import { blobStore } from '../store/blobStore';
import { dist } from '../util/geometry';
import { computeGain, isInside } from './gain';
import { drawGapSeconds, pickNextInOrder, pickNextShuffle } from './playlist';

type Phase = 'idle' | 'playing' | 'gap';

const GAIN_TIME_CONSTANT = 0.03;

/**
 * One emitter's audio: HTMLAudioElement -> MediaElementSource -> GainNode -> destination.
 *
 * Phases:
 *   idle    nothing loaded (no tracks, all failed, or never started)
 *   playing a track is loaded; the element plays only while the listener is inside
 *   gap     silence between tracks; the countdown only runs while the listener is inside
 */
export class EmitterPlayer {
  private readonly ctx: AudioContext;
  private readonly audio: HTMLAudioElement;
  private readonly source: MediaElementAudioSourceNode;
  private readonly gainNode: GainNode;

  private emitter: Emitter;
  private phase: Phase = 'idle';
  private currentTrackId: string | null = null;
  private currentUrl: string | null = null;
  private lastIndex = -1;
  private shuffleQueue: string[] = [];
  private failedIds = new Set<string>();
  private gapRemainingMs = 0;
  private inside = false;
  private lastTickMs: number;
  private lastGainSet = -1;
  private playPending = false;
  private lastError: string | null = null;
  private disposed = false;

  constructor(ctx: AudioContext, destination: AudioNode, emitter: Emitter) {
    this.ctx = ctx;
    this.emitter = emitter;
    this.lastTickMs = performance.now();

    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.source = ctx.createMediaElementSource(this.audio);
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.source.connect(this.gainNode);
    this.gainNode.connect(destination);

    this.audio.addEventListener('ended', this.onEnded);
    this.audio.addEventListener('error', this.onMediaError);
    this.audio.addEventListener('playing', this.onPlaying);
    this.audio.loop = this.shouldLoop();
  }

  // ---------------------------------------------------------------- public

  /** Called whenever the emitter object in the store changes. */
  setConfig(next: Emitter): void {
    const prev = this.emitter;
    this.emitter = next;
    if (prev.tracks !== next.tracks) this.onTracksChanged();

    const loop = this.shouldLoop();
    this.audio.loop = loop;
    // Switched to seamless loop while sitting in a gap: don't wait it out.
    if (loop && this.phase === 'gap') this.gapRemainingMs = 0;
  }

  /** Called every engine tick (~50 ms). */
  update(listener: Vec2, masterVolume: number, nowMs: number, ctxRunning: boolean): void {
    if (this.disposed) return;
    const dt = Math.max(0, nowMs - this.lastTickMs);
    this.lastTickMs = nowMs;

    const d = dist(listener, this.emitter.position);
    this.inside = isInside(d, this.emitter.radius);
    this.applyGain(
      computeGain({
        distance: d,
        radius: this.emitter.radius,
        volume: this.emitter.volume,
        masterVolume,
        muted: this.emitter.muted,
      }),
    );

    if (!this.inside) {
      // Freeze: position stays in the element, gap countdown simply doesn't advance.
      if (!this.audio.paused) this.audio.pause();
      return;
    }
    if (!ctxRunning) return; // never call play() before the context is running

    if (this.phase === 'gap') {
      this.gapRemainingMs -= dt;
      if (this.gapRemainingMs <= 0) this.startNext();
    } else if (this.phase === 'idle') {
      this.startNext();
    } else if (this.audio.paused && !this.audio.ended) {
      this.tryPlay();
    }
  }

  /** Jump to the next track right now, ignoring any gap. */
  skipNext(): void {
    if (this.disposed) return;
    this.startNext();
  }

  getRuntime(): EmitterRuntime {
    const hasPlayable = this.emitter.tracks.some((t) => this.isPlayable(t.id));
    let state: PlayerState;
    if (!this.inside) state = hasPlayable ? 'paused' : 'idle';
    else if (this.phase === 'gap') state = 'gap';
    else if (this.phase === 'playing') state = 'playing';
    else state = 'idle';
    return {
      state,
      gapSecondsLeft: Math.max(0, Math.ceil(this.gapRemainingMs / 1000)),
      currentTrackId: this.currentTrackId,
      error: this.lastError,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.audio.removeEventListener('ended', this.onEnded);
    this.audio.removeEventListener('error', this.onMediaError);
    this.audio.removeEventListener('playing', this.onPlaying);
    this.unloadCurrent();
    this.source.disconnect();
    this.gainNode.disconnect();
  }

  // --------------------------------------------------------------- private

  /** Seamless gapless loop: exactly one track and no gap. */
  private shouldLoop(): boolean {
    return this.emitter.tracks.length === 1 && this.emitter.gap.kind === 'immediate';
  }

  private isPlayable(id: string): boolean {
    return !this.failedIds.has(id) && blobStore.has(id);
  }

  private applyGain(target: number): void {
    if (target === this.lastGainSet) return;
    this.lastGainSet = target;
    this.gainNode.gain.setTargetAtTime(target, this.ctx.currentTime, GAIN_TIME_CONSTANT);
  }

  private onTracksChanged(): void {
    const ids = this.emitter.tracks.map((t) => t.id);
    const present = new Set(ids);
    for (const id of this.failedIds) if (!present.has(id)) this.failedIds.delete(id);
    this.shuffleQueue = this.shuffleQueue.filter((id) => present.has(id));

    if (this.currentTrackId === null) return;
    const idx = ids.indexOf(this.currentTrackId);
    if (idx >= 0) {
      // Still there (maybe reordered): keep playing, next track is computed from the new position.
      this.lastIndex = idx;
      return;
    }
    // Current track was removed: stop it and move on as soon as we are inside.
    this.lastIndex = this.lastIndex - 1;
    this.unloadCurrent();
    this.phase = 'gap';
    this.gapRemainingMs = 0;
  }

  private startNext(): void {
    const ids = this.emitter.tracks.map((t) => t.id);
    const playable = ids.filter((id) => this.isPlayable(id));
    if (playable.length === 0) {
      this.unloadCurrent();
      this.phase = 'idle';
      return;
    }

    let next: string | null;
    if (this.emitter.order === 'shuffle') {
      const res = pickNextShuffle(playable, this.shuffleQueue, this.currentTrackId, Math.random);
      next = res.next;
      this.shuffleQueue = res.queue;
    } else {
      next = pickNextInOrder(ids, this.currentTrackId, this.lastIndex, (id) => this.isPlayable(id));
    }

    if (next === null) {
      this.unloadCurrent();
      this.phase = 'idle';
      return;
    }
    this.loadTrack(next, ids);
  }

  private loadTrack(id: string, ids: string[]): void {
    const blob = blobStore.get(id);
    if (!blob) {
      this.failTrack(id, 'audio data missing');
      return;
    }
    this.revokeUrl();
    const url = URL.createObjectURL(blob);
    this.currentUrl = url;
    this.currentTrackId = id;
    this.lastIndex = ids.indexOf(id);
    this.phase = 'playing';
    this.playPending = false;
    this.audio.loop = this.shouldLoop();
    this.audio.src = url;
    // Starts now if inside; otherwise update() starts it when the listener enters.
    if (this.inside && this.ctx.state === 'running') this.tryPlay();
  }

  private tryPlay(): void {
    if (this.playPending || this.currentTrackId === null) return;
    this.playPending = true;
    const id = this.currentTrackId;
    this.audio.play().then(
      () => {
        this.playPending = false;
      },
      (err: unknown) => {
        this.playPending = false;
        const name = err instanceof DOMException ? err.name : '';
        // NotAllowedError (autoplay) and AbortError (src swapped) are retried / ignored.
        if (name === 'NotSupportedError') this.failTrack(id, 'unsupported audio format');
      },
    );
  }

  private failTrack(id: string, why: string): void {
    this.failedIds.add(id);
    const track = this.emitter.tracks.find((t) => t.id === id);
    this.lastError = `${track ? track.name : 'Track'}: ${why}`;
    if (this.currentTrackId === id) this.unloadCurrent();
    // Move on at the next tick. If every track failed, startNext() lands in 'idle' (no retry loop).
    this.phase = 'gap';
    this.gapRemainingMs = 0;
  }

  private unloadCurrent(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.revokeUrl();
    this.currentTrackId = null;
    this.playPending = false;
  }

  private revokeUrl(): void {
    if (this.currentUrl !== null) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  // Arrow functions so they can be added/removed as listeners.
  private onEnded = (): void => {
    if (this.disposed) return;
    // Only reached when not looping. Gap = silence after the track ends.
    const seconds = drawGapSeconds(this.emitter.gap, Math.random);
    if (seconds <= 0 && this.inside) {
      this.startNext();
      return;
    }
    this.phase = 'gap';
    this.gapRemainingMs = seconds * 1000;
  };

  private onMediaError = (): void => {
    if (this.disposed || this.currentTrackId === null || this.audio.error === null) return;
    this.failTrack(this.currentTrackId, 'failed to load or decode');
  };

  private onPlaying = (): void => {
    this.lastError = null;
  };
}
