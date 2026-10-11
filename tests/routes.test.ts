import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Claude is mocked: these tests exercise the routes, checker and seal without spending API budget.
vi.mock("@/lib/saboteur", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/saboteur")>();
  return {
    ...real,
    askClaude: vi.fn(async () => ({
      mutation: {
        line: 15,
        original: "  return subtotal(items) >= FREE_SHIPPING_MIN ? 0 : 5;",
        mutated: "  return subtotal(items) > FREE_SHIPPING_MIN ? 0 : 5;",
        category: "comparison",
        lesson: "Orders of exactly 50 now pay shipping.",
      },
    })),
  };
});

const { POST: drill } = await import("@/app/api/drill/route");
const { POST: guess } = await import("@/app/api/guess/route");
const { POST: reveal } = await import("@/app/api/reveal/route");

const code = readFileSync(path.join(__dirname, "fixtures/cart.ts"), "utf8");
const req = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("drill → guess → reveal", () => {
  it("plants a bug, hides the answer, and reveals it after the right guess", async () => {
    const res = await drill(req({ code, filename: "cart.ts" }));
    expect(res.status).toBe(200);
    const raw = await res.text();
    const d = JSON.parse(raw);
    expect(d.file).toBe("cart.ts");
    expect(d.regions[0].start).toBe(1);
    expect(d.regions[0].lines[14]).toContain("> FREE_SHIPPING_MIN");
    for (const leak of ["comparison", "exactly 50", "bugLines", ">= FREE_SHIPPING_MIN"]) expect(raw).not.toContain(leak);

    const far = await (await guess(req({ token: d.token, line: 1 }))).json();
    expect(far).toEqual({ correct: false, temperature: "cold" });
    const near = await (await guess(req({ token: d.token, line: 13 }))).json();
    expect(near).toEqual({ correct: false, temperature: "hot" });
    const mid = await (await guess(req({ token: d.token, line: 8 }))).json();
    expect(mid).toEqual({ correct: false, temperature: "warm" });
    const hit = await (await guess(req({ token: d.token, line: 15 }))).json();
    expect(hit).toEqual({ correct: true, temperature: null });

    const r = await (await reveal(req({ token: d.token }))).json();
    expect(r).toMatchObject({ bugLines: [15], category: "comparison", lesson: expect.stringContaining("50") });
  });

  it("rejects over-long pastes, bad JSON and forged tokens with clear errors", async () => {
    const long = Array.from({ length: 301 }, (_, i) => `const a${i} = ${i};`).join("\n");
    const tooLong = await drill(req({ code: long }));
    expect(tooLong.status).toBe(413);
    expect((await tooLong.json()).error.message).toMatch(/300/);

    const bad = await drill(new Request("http://x", { method: "POST", body: "{" }));
    expect(bad.status).toBe(400);

    const forged = await guess(req({ token: "abc", line: 1 }));
    expect(forged.status).toBe(400);
    expect((await forged.json()).error.code).toBe("token_invalid");
  });
});
