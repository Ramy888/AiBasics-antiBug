import { AppError } from "./errors";

// Best-effort, per server instance: protects the demo's API budget, not a security boundary.
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export function drillsPerHour(): number {
  const n = Number(process.env.ANTIBUG_DRILLS_PER_HOUR);
  return Number.isInteger(n) && n > 0 ? n : 10;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** Count one drill for `key`; throws once it has used up this hour's allowance. */
export function takeDrill(key: string, now = Date.now(), limit = drillsPerHour()): void {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    throw new AppError("rate_limited", "Easy, tiger. You've hit this hour's drill limit. Try again in a few minutes.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.delete(hits.keys().next().value!); // keep memory bounded
}
