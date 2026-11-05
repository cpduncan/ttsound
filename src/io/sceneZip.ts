import JSZip from 'jszip';
import { audioEngine } from '../audio/AudioEngine';
import { blobStore } from '../store/blobStore';
import { useSceneStore } from '../store/sceneStore';
import type { Emitter, GapMode, PlayOrder, Scene, Track, Vec2 } from '../types';
import { extForTrack } from './fileIngest';

// ------------------------------------------------------------------ export

export async function exportSceneZip(): Promise<void> {
  const { scene } = useSceneStore.getState();
  const zip = new JSZip();
  zip.file('scene.json', JSON.stringify(scene, null, 2));
  for (const emitter of scene.emitters) {
    for (const track of emitter.tracks) {
      const blob = blobStore.get(track.id);
      if (!blob) continue; // missing audio stays missing; scene.json still lists the track
      // Audio is already compressed: store it as-is.
      zip.file(`audio/${track.id}.${extForTrack(track)}`, blob, { compression: 'STORE', createFolders: false });
    }
  }
  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  download(out, `${safeFileName(scene.name)}.zip`);
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'scene';
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ------------------------------------------------------------------ import

export interface ParsedScene {
  scene: Scene;
  blobs: Map<string, Blob>;
  missingTrackCount: number;
}

/** Reads and validates a zip without touching the current scene. Throws Error with a readable message. */
export async function parseSceneZip(file: File): Promise<ParsedScene> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('That file is not a valid zip archive.');
  }
  const jsonEntry = zip.file('scene.json');
  if (!jsonEntry) throw new Error('Not a scene zip: scene.json is missing.');

  let raw: unknown;
  try {
    raw = JSON.parse(await jsonEntry.async('string'));
  } catch {
    throw new Error('scene.json is not valid JSON.');
  }
  const scene = validateScene(raw);

  const entries = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, entry) => {
    const m = /^audio\/([^/]+)\.[^./]+$/.exec(path);
    if (m && !entry.dir) entries.set(m[1], entry);
  });

  const blobs = new Map<string, Blob>();
  let missing = 0;
  for (const emitter of scene.emitters) {
    for (const track of emitter.tracks) {
      const entry = entries.get(track.id);
      if (!entry) {
        missing++;
        continue;
      }
      const data = await entry.async('blob');
      blobs.set(track.id, new Blob([data], { type: track.mime }));
    }
  }
  return { scene, blobs, missingTrackCount: missing };
}

/** Fully tears down the old scene (players, object URLs, blobs), then installs the new one. */
export function applyParsedScene(parsed: ParsedScene): void {
  audioEngine.disposeAll();
  blobStore.clear();
  for (const [id, blob] of parsed.blobs) blobStore.set(id, blob);
  useSceneStore.getState().setScene(parsed.scene);
}

// -------------------------------------------------------------- validation

function fail(path: string, msg: string): never {
  throw new Error(`Invalid scene.json: ${path} ${msg}.`);
}

function asRecord(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'must be an object');
  return v as Record<string, unknown>;
}

function asString(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, 'must be a string');
  return v;
}

function asNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'must be a finite number');
  return v;
}

function asBool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'must be true or false');
  return v;
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'must be an array');
  return v;
}

function asVec2(v: unknown, path: string): Vec2 {
  const o = asRecord(v, path);
  return { x: asNumber(o.x, `${path}.x`), y: asNumber(o.y, `${path}.y`) };
}

function asGap(v: unknown, path: string): GapMode {
  const o = asRecord(v, path);
  switch (o.kind) {
    case 'immediate':
      return { kind: 'immediate' };
    case 'fixed':
      return { kind: 'fixed', seconds: Math.max(0, asNumber(o.seconds, `${path}.seconds`)) };
    case 'random': {
      const min = Math.max(0, asNumber(o.minSeconds, `${path}.minSeconds`));
      const max = Math.max(min, asNumber(o.maxSeconds, `${path}.maxSeconds`));
      return { kind: 'random', minSeconds: min, maxSeconds: max };
    }
    default:
      return fail(`${path}.kind`, 'must be "immediate", "fixed" or "random"');
  }
}

function asTrack(v: unknown, path: string): Track {
  const o = asRecord(v, path);
  return {
    id: asString(o.id, `${path}.id`),
    name: asString(o.name, `${path}.name`),
    mime: asString(o.mime, `${path}.mime`),
  };
}

function asEmitter(v: unknown, path: string): Emitter {
  const o = asRecord(v, path);
  const order = o.order;
  if (order !== 'inOrder' && order !== 'shuffle') fail(`${path}.order`, 'must be "inOrder" or "shuffle"');
  return {
    id: asString(o.id, `${path}.id`),
    name: asString(o.name, `${path}.name`),
    position: asVec2(o.position, `${path}.position`),
    radius: Math.max(10, asNumber(o.radius, `${path}.radius`)),
    volume: Math.min(1, Math.max(0, asNumber(o.volume, `${path}.volume`))),
    muted: asBool(o.muted, `${path}.muted`),
    tracks: asArray(o.tracks, `${path}.tracks`).map((t, i) => asTrack(t, `${path}.tracks[${i}]`)),
    order: order as PlayOrder,
    gap: asGap(o.gap, `${path}.gap`),
  };
}

export function validateScene(raw: unknown): Scene {
  const o = asRecord(raw, 'scene');
  if (o.version !== 1) fail('version', `must be 1 (found ${JSON.stringify(o.version)})`);
  const listener = asRecord(o.listener, 'listener');
  const emitters = asArray(o.emitters, 'emitters').map((e, i) => asEmitter(e, `emitters[${i}]`));
  const ids = new Set<string>();
  for (const e of emitters) {
    if (ids.has(e.id)) fail('emitters', `contains duplicate id ${e.id}`);
    ids.add(e.id);
  }
  return {
    version: 1,
    name: asString(o.name, 'name'),
    listener: { position: asVec2(listener.position, 'listener.position') },
    emitters,
    masterVolume: Math.min(1, Math.max(0, asNumber(o.masterVolume, 'masterVolume'))),
  };
}
