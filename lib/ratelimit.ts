import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AppError } from "./errors";
import { slide } from "./window";

// Protects the demo's API budget, not a security boundary.

/** The Durable Object namespace binding, reduced to what takeDrill calls. */
export type LimiterNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(url: string, init?: RequestInit): Promise<Response> };
};

const hits = new Map<string, number[]>();

export function drillsPerHour(): number {
  const n = Number(process.env.ANTIBUG_DRILLS_PER_HOUR);
  return Number.isInteger(n) && n > 0 ? n : 10;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

/** The DRILL_LIMITER binding on Cloudflare; null anywhere else (next dev, next start, tests). */
export function cloudflareLimiter(): LimiterNamespace | null {
  let env: Record<string, unknown>;
  try {
    env = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    return null; // not running on Cloudflare
  }
  if (!env.DRILL_LIMITER) throw new Error("DRILL_LIMITER Durable Object binding is missing from wrangler.jsonc");
  return env.DRILL_LIMITER as LimiterNamespace;
}

async function allowed(key: string, now: number, limit: number, limiter: LimiterNamespace | null): Promise<boolean> {
  if (limiter) {
    const res = await limiter.get(limiter.idFromName(key)).fetch("https://limiter/take", {
      method: "POST",
      body: JSON.stringify({ now, limit }),
    });
    return ((await res.json()) as { allowed: boolean }).allowed;
  }
  // One count per server process: fine for a single local or self-hosted instance.
  const result = slide(hits.get(key) ?? [], now, limit);
  hits.set(key, result.times);
  if (hits.size > 10_000) hits.delete(hits.keys().next().value!); // keep memory bounded
  return result.allowed;
}

/** Count one drill for `key`; throws once it has used up this hour's allowance. */
export async function takeDrill(
  key: string,
  now = Date.now(),
  limit = drillsPerHour(),
  limiter = cloudflareLimiter(),
): Promise<void> {
  if (!(await allowed(key, now, limit, limiter))) {
    throw new AppError("rate_limited", "Easy, tiger. You've hit this hour's drill limit. Try again in a few minutes.");
  }
}
