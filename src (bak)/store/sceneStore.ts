import { create } from 'zustand';
import type { ContextMenuState, Emitter, Scene, Track, Vec2 } from '../types';
import { clamp } from '../util/geometry';
import { newId } from '../util/id';
import { blobStore } from './blobStore';

export const MIN_RADIUS = 10;

export interface TrackInput {
  track: Track;
  blob: Blob;
}

interface UiState {
  queuePanelOpen: boolean;
  contextMenu: ContextMenuState | null;
}

export type EmitterPatch = Partial<Omit<Emitter, 'id'>>;

interface SceneState {
  scene: Scene;
  selectedEmitterId: string | null;
  ui: UiState;

  addEmitter: (position: Vec2) => string;
  updateEmitter: (id: string, patch: EmitterPatch) => void;
  removeEmitter: (id: string) => void;
  duplicateEmitter: (id: string) => string | null;
  moveListener: (position: Vec2) => void;
  addTracks: (emitterId: string, items: TrackInput[]) => void;
  removeTrack: (emitterId: string, trackId: string) => void;
  /** `to` is the final index of the moved track in the resulting list. */
  reorderTrack: (emitterId: string, from: number, to: number) => void;
  /** Replaces the scene. Caller is responsible for blobStore contents. */
  setScene: (scene: Scene) => void;
  /** Empty scene and empty blobStore. */
  resetScene: () => void;
  setMasterVolume: (v: number) => void;
  setSceneName: (name: string) => void;

  select: (id: string | null) => void;
  setQueuePanelOpen: (open: boolean) => void;
  toggleQueuePanel: () => void;
  openContextMenu: (emitterId: string, x: number, y: number) => void;
  closeContextMenu: () => void;
}

export function createDefaultScene(): Scene {
  return {
    version: 1,
    name: 'Untitled Scene',
    listener: { position: { x: 0, y: 0 } },
    emitters: [],
    masterVolume: 1,
  };
}

function mapEmitter(scene: Scene, id: string, fn: (e: Emitter) => Emitter): Scene {
  return { ...scene, emitters: scene.emitters.map((e) => (e.id === id ? fn(e) : e)) };
}

function sanitizePatch(patch: EmitterPatch): EmitterPatch {
  const p = { ...patch };
  if (p.radius !== undefined) p.radius = Math.max(MIN_RADIUS, p.radius);
  if (p.volume !== undefined) p.volume = clamp(p.volume, 0, 1);
  return p;
}

let emitterCounter = 0;

export const useSceneStore = create<SceneState>()((set, get) => ({
  scene: createDefaultScene(),
  selectedEmitterId: null,
  ui: { queuePanelOpen: false, contextMenu: null },

  addEmitter: (position) => {
    emitterCounter += 1;
    const emitter: Emitter = {
      id: newId(),
      name: `Emitter ${emitterCounter}`,
      position: { x: position.x, y: position.y },
      radius: 150,
      volume: 1,
      muted: false,
      tracks: [],
      order: 'inOrder',
      gap: { kind: 'immediate' },
    };
    set((s) => ({ scene: { ...s.scene, emitters: [...s.scene.emitters, emitter] } }));
    return emitter.id;
  },

  updateEmitter: (id, patch) => {
    const clean = sanitizePatch(patch);
    set((s) => ({ scene: mapEmitter(s.scene, id, (e) => ({ ...e, ...clean })) }));
  },

  removeEmitter: (id) => {
    const target = get().scene.emitters.find((e) => e.id === id);
    if (!target) return;
    for (const t of target.tracks) blobStore.delete(t.id);
    set((s) => ({
      scene: { ...s.scene, emitters: s.scene.emitters.filter((e) => e.id !== id) },
      selectedEmitterId: s.selectedEmitterId === id ? null : s.selectedEmitterId,
      ui: {
        ...s.ui,
        contextMenu: s.ui.contextMenu?.emitterId === id ? null : s.ui.contextMenu,
      },
    }));
  },

  duplicateEmitter: (id) => {
    const src = get().scene.emitters.find((e) => e.id === id);
    if (!src) return null;
    const tracks: Track[] = src.tracks.map((t) => {
      const copy: Track = { ...t, id: newId() };
      const blob = blobStore.get(t.id);
      if (blob) blobStore.set(copy.id, blob); // Blobs are immutable, sharing the reference is safe.
      return copy;
    });
    const copy: Emitter = {
      ...src,
      id: newId(),
      name: `${src.name} copy`,
      position: { x: src.position.x + 30, y: src.position.y + 30 },
      tracks,
      gap: { ...src.gap },
    };
    set((s) => ({ scene: { ...s.scene, emitters: [...s.scene.emitters, copy] } }));
    return copy.id;
  },

  moveListener: (position) => {
    set((s) => ({ scene: { ...s.scene, listener: { position: { x: position.x, y: position.y } } } }));
  },

  addTracks: (emitterId, items) => {
    if (items.length === 0) return;
    for (const it of items) blobStore.set(it.track.id, it.blob);
    set((s) => ({
      scene: mapEmitter(s.scene, emitterId, (e) => ({ ...e, tracks: [...e.tracks, ...items.map((i) => i.track)] })),
    }));
  },

  removeTrack: (emitterId, trackId) => {
    blobStore.delete(trackId);
    set((s) => ({
      scene: mapEmitter(s.scene, emitterId, (e) => ({ ...e, tracks: e.tracks.filter((t) => t.id !== trackId) })),
    }));
  },

  reorderTrack: (emitterId, from, to) => {
    set((s) => ({
      scene: mapEmitter(s.scene, emitterId, (e) => {
        if (from === to || from < 0 || from >= e.tracks.length) return e;
        const tracks = e.tracks.slice();
        const [moved] = tracks.splice(from, 1);
        tracks.splice(clamp(to, 0, tracks.length), 0, moved);
        return { ...e, tracks };
      }),
    }));
  },

  setScene: (scene) => {
    set((s) => ({ scene, selectedEmitterId: null, ui: { ...s.ui, contextMenu: null } }));
  },

  resetScene: () => {
    blobStore.clear();
    emitterCounter = 0;
    set((s) => ({ scene: createDefaultScene(), selectedEmitterId: null, ui: { ...s.ui, contextMenu: null } }));
  },

  setMasterVolume: (v) => {
    set((s) => ({ scene: { ...s.scene, masterVolume: clamp(v, 0, 1) } }));
  },

  setSceneName: (name) => {
    set((s) => ({ scene: { ...s.scene, name } }));
  },

  select: (id) => set({ selectedEmitterId: id }),
  setQueuePanelOpen: (open) => set((s) => ({ ui: { ...s.ui, queuePanelOpen: open } })),
  toggleQueuePanel: () => set((s) => ({ ui: { ...s.ui, queuePanelOpen: !s.ui.queuePanelOpen } })),
  openContextMenu: (emitterId, x, y) => set((s) => ({ ui: { ...s.ui, contextMenu: { emitterId, x, y } } })),
  closeContextMenu: () => set((s) => (s.ui.contextMenu ? { ui: { ...s.ui, contextMenu: null } } : s)),
}));
