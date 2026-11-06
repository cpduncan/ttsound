import type { Track } from '../types';
import { newId } from '../util/id';
import type { TrackInput } from '../store/sceneStore';

const EXT_MIME = new Map<string, string>([
  ['mp3', 'audio/mpeg'],
  ['ogg', 'audio/ogg'],
  ['oga', 'audio/ogg'],
  ['opus', 'audio/ogg'],
  ['wav', 'audio/wav'],
  ['m4a', 'audio/mp4'],
  ['aac', 'audio/aac'],
  ['flac', 'audio/flac'],
  ['weba', 'audio/webm'],
  ['webm', 'audio/webm'],
]);

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function getExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || EXT_MIME.has(getExt(file.name));
}

export function mimeFor(file: File): string {
  return file.type || EXT_MIME.get(getExt(file.name)) || 'application/octet-stream';
}

/** File extension to use inside a scene zip, derived from the track name or mime. */
export function extForTrack(track: Track): string {
  const fromName = getExt(track.name);
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  for (const [ext, mime] of EXT_MIME) if (mime === track.mime) return ext;
  return 'bin';
}

/**
 * Turns picked files (or a picked folder) into tracks + blobs.
 * Non-audio files are dropped. Natural sort: "track2" before "track10".
 * Folder picks sort by relative path so subfolders stay grouped.
 */
export function filesToTracks(files: FileList | File[] | null): TrackInput[] {
  if (!files) return [];
  const audio = Array.from(files).filter(isAudioFile);
  audio.sort((a, b) => collator.compare(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));
  return audio.map((file) => {
    const mime = mimeFor(file);
    return {
      track: { id: newId(), name: file.name, mime },
      // Wrapping keeps a reference to the file (no copy) and guarantees a usable mime type.
      blob: new Blob([file], { type: mime }),
    };
  });
}
