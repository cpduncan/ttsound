export type Vec2 = { x: number; y: number };

export type PlayOrder = 'inOrder' | 'shuffle';

export type GapMode =
  | { kind: 'immediate' }
  | { kind: 'fixed'; seconds: number }
  | { kind: 'random'; minSeconds: number; maxSeconds: number };

/** Audio bytes are NOT stored here. They live in blobStore, keyed by Track.id. */
export interface Track {
  id: string;
  name: string;
  mime: string;
}

export interface Emitter {
  id: string;
  name: string;
  position: Vec2;
  /** World units, min 10. */
  radius: number;
  /** 0..1 */
  volume: number;
  muted: boolean;
  tracks: Track[];
  order: PlayOrder;
  gap: GapMode;
}

export interface Scene {
  version: 1;
  name: string;
  listener: { position: Vec2 };
  emitters: Emitter[];
  /** 0..1 */
  masterVolume: number;
}

/** Runtime-only (never persisted). Produced by the audio engine, polled by the UI. */
export type PlayerState = 'idle' | 'playing' | 'paused' | 'gap';

export interface EmitterRuntime {
  state: PlayerState;
  gapSecondsLeft: number;
  currentTrackId: string | null;
  error: string | null;
}

export interface ContextMenuState {
  emitterId: string;
  /** Client (viewport) pixel coordinates. */
  x: number;
  y: number;
}
