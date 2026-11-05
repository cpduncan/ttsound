import type { GapMode } from '../types';

/** Returns a number in [0, 1). Injected so the logic is deterministic in tests. */
export type Rng = () => number;

/** Fisher-Yates. Returns a new array. */
export function shuffleArray<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * New shuffled permutation. When there is more than one id, the first entry is
 * guaranteed to differ from lastId (the last track of the previous permutation).
 */
export function buildShuffleQueue(ids: readonly string[], lastId: string | null, rng: Rng = Math.random): string[] {
  const q = shuffleArray(ids, rng);
  if (q.length > 1 && lastId !== null && q[0] === lastId) {
    const j = 1 + Math.floor(rng() * (q.length - 1));
    const tmp = q[0];
    q[0] = q[j];
    q[j] = tmp;
  }
  return q;
}

/**
 * Pops the next id from the shuffle queue, rebuilding the permutation when it is
 * exhausted. Ids that are no longer playable are dropped from the queue.
 */
export function pickNextShuffle(
  playableIds: readonly string[],
  queue: readonly string[],
  lastId: string | null,
  rng: Rng = Math.random,
): { next: string | null; queue: string[] } {
  if (playableIds.length === 0) return { next: null, queue: [] };
  const allowed = new Set(playableIds);
  let q = queue.filter((id) => allowed.has(id));
  if (q.length === 0) q = buildShuffleQueue(playableIds, lastId, rng);
  const [next, ...rest] = q;
  return { next: next ?? null, queue: rest };
}

/**
 * Next id in list order, wrapping at the end, skipping unplayable ids.
 * base = index of currentId if it is still in the list, else lastIndex.
 * (After a removal, callers set lastIndex = removedIndex - 1 so the track that
 * slid into the removed slot plays next.)
 */
export function pickNextInOrder(
  ids: readonly string[],
  currentId: string | null,
  lastIndex: number,
  isPlayable: (id: string) => boolean,
): string | null {
  const n = ids.length;
  if (n === 0) return null;
  const cur = currentId !== null ? ids.indexOf(currentId) : -1;
  const base = cur >= 0 ? cur : lastIndex;
  for (let step = 1; step <= n; step++) {
    const idx = (((base + step) % n) + n) % n;
    const id = ids[idx];
    if (isPlayable(id)) return id;
  }
  return null;
}

/** Seconds of silence after a track ends. Random draws a fresh uniform value each call. */
export function drawGapSeconds(gap: GapMode, rng: Rng = Math.random): number {
  switch (gap.kind) {
    case 'immediate':
      return 0;
    case 'fixed':
      return Math.max(0, gap.seconds);
    case 'random': {
      const lo = Math.max(0, Math.min(gap.minSeconds, gap.maxSeconds));
      const hi = Math.max(0, Math.max(gap.minSeconds, gap.maxSeconds));
      return lo + rng() * (hi - lo);
    }
  }
}
