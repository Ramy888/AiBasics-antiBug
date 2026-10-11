import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildPrompt, plantBug, type AskFn } from "@/lib/saboteur";

const content = readFileSync(path.join(__dirname, "fixtures/cart.ts"), "utf8");
const input = {
  filename: "cart.ts",
  content,
  eligibleLines: new Set(content.split("\n").map((_, i) => i + 1)),
  avoidLines: new Set([19]),
};
const good = {
  line: 15,
  original: "  return subtotal(items) >= FREE_SHIPPING_MIN ? 0 : 5;",
  mutated: "  return subtotal(items) > FREE_SHIPPING_MIN ? 0 : 5;",
  category: "comparison" as const,
  lesson: "Orders of exactly 50 now pay shipping.",
};

describe("plantBug", () => {
  it("retries with the checker's reason, then returns the valid bug", async () => {
    const ask = vi
      .fn<AskFn>()
      .mockResolvedValueOnce({ mutation: { ...good, mutated: good.original + " " } })
      .mockResolvedValueOnce({ reason: "The model declined to plant a bug in this code." })
      .mockResolvedValueOnce({ mutation: good });
    const r = await plantBug(input, ask);
    expect(r.bugLines).toEqual([15]);
    expect(ask).toHaveBeenCalledTimes(3);
    const lastPrompt = ask.mock.calls[2][0];
    expect(lastPrompt).toContain("changes nothing");
    expect(lastPrompt).toContain("declined");
  });

  it("gives up after 3 failed attempts with a friendly error", async () => {
    const ask = vi.fn<AskFn>().mockResolvedValue({ reason: "nope" });
    await expect(plantBug(input, ask)).rejects.toThrow(/Couldn't plant/);
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it("numbers the file and lists eligible and avoided lines as ranges", () => {
    const p = buildPrompt(input, []);
    expect(p).toContain("  15|   return subtotal(items)");
    expect(p).toContain("ELIGIBLE lines: 1-29");
    expect(p).toContain("AVOID lines: 19");
  });
});
