// Streak and best time, kept in this browser only. Every storage call is guarded so the
// page still works when storage is blocked (private windows, strict settings).

export type Streak = { streak: number; best: number | null };

const KEY = "antibug:v1";
const EMPTY: Streak = { streak: 0, best: null };

type Store = Pick<Storage, "getItem" | "setItem">;
const browserStore = (): Store | null => (typeof window === "undefined" ? null : window.localStorage);

export function loadStreak(store: Store | null = browserStore()): Streak {
  try {
    const raw = JSON.parse(store?.getItem(KEY) ?? "null");
    if (raw && Number.isInteger(raw.streak) && raw.streak >= 0 && (raw.best === null || typeof raw.best === "number")) return raw;
  } catch {}
  return EMPTY;
}

const CHANGED = "antibug:streak";

function save(next: Streak, store: Store | null): Streak {
  try {
    store?.setItem(KEY, JSON.stringify(next));
  } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
  return next;
}

// For React's useSyncExternalStore: the snapshot must keep its identity until storage changes.
let cached: { raw: string | null; value: Streak } | null = null;

export function streakSnapshot(): Streak {
  let raw: string | null = null;
  try {
    raw = browserStore()?.getItem(KEY) ?? null;
  } catch {}
  if (cached?.raw !== raw) cached = { raw, value: loadStreak() };
  return cached.value;
}

export const serverStreak = (): Streak => EMPTY;

export function subscribeStreak(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function recordFound(seconds: number, store: Store | null = browserStore()): Streak {
  const { streak, best } = loadStreak(store);
  return save({ streak: streak + 1, best: best === null ? seconds : Math.min(best, seconds) }, store);
}

export function recordGiveUp(store: Store | null = browserStore()): Streak {
  return save({ ...loadStreak(store), streak: 0 }, store);
}
