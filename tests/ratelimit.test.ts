import { describe, expect, it } from "vitest";
import { DrillLimiter } from "@/lib/drill-limiter";
import { clientIp, takeDrill, type LimiterNamespace } from "@/lib/ratelimit";

const HOUR = 60 * 60 * 1000;

/** Stands in for the Durable Object namespace: one DrillLimiter per name, each with its own storage. */
function fakeNamespace(): LimiterNamespace {
  const objects = new Map<string, DrillLimiter>();
  return {
    idFromName: (name) => name,
    get: (id) => {
      const name = id as string;
      if (!objects.has(name)) {
        const data = new Map<string, unknown>();
        const storage = { get: async (k: string) => data.get(k), put: async (k: string, v: unknown) => void data.set(k, v) };
        objects.set(name, new DrillLimiter({ storage } as ConstructorParameters<typeof DrillLimiter>[0]));
      }
      const limiter = objects.get(name)!;
      return { fetch: (url: string, init?: RequestInit) => limiter.fetch(new Request(url, init)) };
    },
  };
}

describe("rate limit", () => {
  it("allows 10 drills an hour per visitor, then refuses the 11th until the window passes", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) await takeDrill("1.2.3.4", t0 + i, 10, null);
    await expect(takeDrill("1.2.3.4", t0 + 10, 10, null)).rejects.toThrow(/Easy, tiger/);
    await expect(takeDrill("5.6.7.8", t0 + 10, 10, null)).resolves.toBeUndefined();
    await expect(takeDrill("1.2.3.4", t0 + HOUR + 1, 10, null)).resolves.toBeUndefined();
  });

  it("keeps the count in one Durable Object per visitor when deployed, so every server copy shares it", async () => {
    const ns = fakeNamespace();
    const t0 = 2_000_000;
    for (let i = 0; i < 3; i++) await takeDrill("9.9.9.9", t0 + i, 3, ns);
    await expect(takeDrill("9.9.9.9", t0 + 3, 3, ns)).rejects.toThrow(/Easy, tiger/);
    await expect(takeDrill("8.8.8.8", t0 + 3, 3, ns)).resolves.toBeUndefined();
    await expect(takeDrill("9.9.9.9", t0 + HOUR + 1, 3, ns)).resolves.toBeUndefined();
  });

  it("reads the visitor's IP from Cloudflare first, then proxy headers", () => {
    const h = (headers: Record<string, string>) => clientIp(new Request("http://x", { headers }));
    expect(h({ "cf-connecting-ip": "7.7.7.7", "x-forwarded-for": "9.9.9.9" })).toBe("7.7.7.7");
    expect(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })).toBe("9.9.9.9");
    expect(h({})).toBe("local");
  });
});
