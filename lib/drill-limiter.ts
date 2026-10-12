import { slide } from "./window";

// Only the parts of Cloudflare's Durable Object state this class uses, so it needs no Workers types.
type State = { storage: { get(key: string): Promise<unknown>; put(key: string, value: unknown): Promise<void> } };

/**
 * Durable Object holding one visitor's drill times. Cloudflare runs exactly one instance per
 * name (the visitor's IP) and handles its requests one at a time, so every server copy shares one count.
 * Exported from worker.ts; deployed only on Cloudflare.
 */
export class DrillLimiter {
  constructor(private state: State) {}

  async fetch(req: Request): Promise<Response> {
    const { now, limit } = (await req.json()) as { now: number; limit: number };
    const times = ((await this.state.storage.get("times")) as number[] | undefined) ?? [];
    const result = slide(times, now, limit);
    await this.state.storage.put("times", result.times);
    return Response.json({ allowed: result.allowed });
  }
}
