/**
 * Audio bytes, keyed by Track.id. Deliberately kept out of the zustand state:
 * Blobs are big, not serializable, and must never trigger React renders.
 */
const blobs = new Map<string, Blob>();

export const blobStore = {
  get(trackId: string): Blob | undefined {
    return blobs.get(trackId);
  },
  has(trackId: string): boolean {
    return blobs.has(trackId);
  },
  set(trackId: string, blob: Blob): void {
    blobs.set(trackId, blob);
  },
  delete(trackId: string): void {
    blobs.delete(trackId);
  },
  clear(): void {
    blobs.clear();
  },
};
