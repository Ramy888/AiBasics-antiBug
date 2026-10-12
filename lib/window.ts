export const WINDOW_MS = 60 * 60 * 1000;

/** One-hour sliding window: forgets hits older than an hour, then counts this one if there's room. */
export function slide(times: number[], now: number, limit: number): { allowed: boolean; times: number[] } {
  const recent = times.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) return { allowed: false, times: recent };
  return { allowed: true, times: [...recent, now] };
}
