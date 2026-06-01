/**
 * Course completion progress — a tiny, framework-agnostic localStorage store
 * shared by the "mark finished" button on a topic page and the catalog graph.
 *
 * State is a set of finished course (topic) slugs under a single key. All
 * mutations broadcast a same-tab event so every island on the page reacts
 * instantly, while the native `storage` event keeps other tabs in sync. Every
 * access is SSR-safe (guards `window`) and tolerant of corrupt/blocked storage,
 * so a private-mode browser or a stale value never throws.
 */

const STORAGE_KEY = 'lessons:finished-courses';
/** Same-tab signal (the `storage` event only fires in *other* tabs). */
const EVENT = 'lessons:progress-change';

/** Read the raw set of finished slugs; never throws. */
export function getFinishedCourses(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((s): s is string => typeof s === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/** Whether a given course slug is marked finished. */
export function isCourseFinished(slug: string): boolean {
  return getFinishedCourses().has(slug);
}

/** Persist the finished/unfinished state for one course and notify listeners. */
export function setCourseFinished(slug: string, finished: boolean): void {
  if (typeof window === 'undefined') return;
  const set = getFinishedCourses();
  if (finished) set.add(slug);
  else set.delete(slug);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Storage blocked (private mode / quota) — keep the UI responsive anyway.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * Subscribe to any change in completion state (this tab or another). Returns an
 * unsubscribe function. The callback fires on both the same-tab custom event
 * and the cross-tab native `storage` event.
 */
export function onProgressChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
