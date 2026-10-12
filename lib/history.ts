// Recent drills, kept in this browser only, for the sidebar. Same guarded-storage rules as streak.ts.

export type Drill = { file: string; seconds: number | null; found: boolean; at: number };

export const HISTORY_MAX = 8;
const KEY = "antibug:history:v1";
const CHANGED = "antibug:history";
const EMPTY: Drill[] = [];

type Store = Pick<Storage, "getItem" | "setItem">;
const browserStore = (): Store | null => (typeof window === "undefined" ? null : window.localStorage);

const isDrill = (d: unknown): d is Drill => {
  const x = d as Drill;
  return !!x && typeof x.file === "string" && typeof x.found === "boolean" && typeof x.at === "number" && (x.seconds === null || typeof x.seconds === "number");
};

export function loadHistory(store: Store | null = browserStore()): Drill[] {
  try {
    const raw = JSON.parse(store?.getItem(KEY) ?? "null");
    if (Array.isArray(raw) && raw.every(isDrill)) return raw.slice(0, HISTORY_MAX);
  } catch {}
  return EMPTY;
}

export function recordDrill(drill: Drill, store: Store | null = browserStore()): Drill[] {
  const next = [drill, ...loadHistory(store)].slice(0, HISTORY_MAX);
  try {
    store?.setItem(KEY, JSON.stringify(next));
  } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
  return next;
}

// For React's useSyncExternalStore: the snapshot must keep its identity until storage changes.
let cached: { raw: string | null; value: Drill[] } | null = null;

export function historySnapshot(): Drill[] {
  let raw: string | null = null;
  try {
    raw = browserStore()?.getItem(KEY) ?? null;
  } catch {}
  if (cached?.raw !== raw) cached = { raw, value: loadHistory() };
  return cached.value;
}

export const serverHistory = (): Drill[] => EMPTY;

export function subscribeHistory(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
