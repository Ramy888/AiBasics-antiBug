import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkMutation, type CheckInput, type Mutation } from "@/lib/validate";

const content = readFileSync(path.join(__dirname, "fixtures/cart.ts"), "utf8");
const allLines = new Set(content.split("\n").map((_, i) => i + 1));
const input = (over: Partial<CheckInput> = {}): CheckInput => ({
  filename: "cart.ts",
  content,
  eligibleLines: allLines,
  avoidLines: new Set(),
  ...over,
});
const m = (over: Partial<Mutation>): Mutation => ({
  line: 15,
  original: "  return subtotal(items) >= FREE_SHIPPING_MIN ? 0 : 5;",
  mutated: "  return subtotal(items) > FREE_SHIPPING_MIN ? 0 : 5;",
  category: "comparison",
  lesson: "x",
  ...over,
});

describe("checkMutation", () => {
  it("accepts a real one-line logic change and reports the bug line", () => {
    const r = checkMutation(input(), m({}));
    expect(r).toMatchObject({ ok: true, bugLines: [15] });
    if (r.ok) expect(r.sabotagedContent.split("\n")[14]).toContain("> FREE_SHIPPING_MIN");
  });

  it("accepts a multi-line change and lists only the lines that differ", () => {
    const r = checkMutation(
      input(),
      m({
        line: 7,
        original: "  for (let i = 0; i < items.length; i++) {\n    total += items[i].price * items[i].qty;",
        mutated: "  for (let i = 1; i < items.length; i++) {\n    total += items[i].price * items[i].qty;",
        category: "off_by_one",
      }),
    );
    expect(r).toMatchObject({ ok: true, bugLines: [7] });
  });

  it("ignores trailing whitespace when matching the original", () => {
    expect(checkMutation(input(), m({ original: "  return subtotal(items) >= FREE_SHIPPING_MIN ? 0 : 5;   " })).ok).toBe(true);
  });

  it("rejects an original that does not match the file", () => {
    expect(checkMutation(input(), m({ line: 16 }))).toMatchObject({ ok: false });
  });

  it("rejects whitespace-only changes", () => {
    expect(checkMutation(input(), m({ mutated: "  return subtotal(items)  >= FREE_SHIPPING_MIN ? 0 : 5;" }))).toMatchObject({ ok: false });
  });

  it("rejects comment-only changes", () => {
    expect(
      checkMutation(input(), m({ line: 14, original: "  // Orders at or above the minimum ship free.", mutated: "  // Orders above the minimum ship free." })),
    ).toMatchObject({ ok: false, reason: expect.stringContaining("runtime behaviour") });
  });

  it("rejects type-only changes", () => {
    expect(
      checkMutation(input(), m({ line: 13, original: "export function shipping(items: Item[]): number {", mutated: "export function shipping(items: Item[]): any {" })),
    ).toMatchObject({ ok: false });
  });

  it("rejects a change that breaks parsing", () => {
    expect(checkMutation(input(), m({ mutated: "  return subtotal(items) >= FREE_SHIPPING_MIN ? 0 : ;" }))).toMatchObject({
      ok: false,
      reason: expect.stringContaining("parse"),
    });
  });

  it("rejects lines outside the eligible set", () => {
    expect(checkMutation(input({ eligibleLines: new Set([1, 2, 3]) }), m({}))).toMatchObject({ ok: false });
  });

  it("rejects lines on the avoid list", () => {
    expect(checkMutation(input({ avoidLines: new Set([15]) }), m({}))).toMatchObject({ ok: false });
  });

  it("rejects more than 3 lines and a changed line count", () => {
    const four = content.split("\n").slice(5, 9).join("\n");
    expect(checkMutation(input(), m({ line: 6, original: four, mutated: four.replace("0", "1") }))).toMatchObject({ ok: false });
    expect(checkMutation(input(), m({ mutated: "  return 0;\n  return 1;" }))).toMatchObject({ ok: false });
  });

  it("rejects no-op and out-of-range mutations", () => {
    expect(checkMutation(input(), m({ mutated: m({}).original }))).toMatchObject({ ok: false });
    expect(checkMutation(input(), m({ line: 999 }))).toMatchObject({ ok: false });
  });

  it("parses JSX without false syntax errors", () => {
    const tsx = "export function A({ n }: { n: number }) {\n  return <b>{n > 1 ? 'many' : 'one'}</b>;\n}\n";
    const r = checkMutation(
      { filename: "a.tsx", content: tsx, eligibleLines: new Set([2]), avoidLines: new Set() },
      { line: 2, original: "  return <b>{n > 1 ? 'many' : 'one'}</b>;", mutated: "  return <b>{n >= 1 ? 'many' : 'one'}</b>;", category: "comparison", lesson: "x" },
    );
    expect(r.ok).toBe(true);
  });
});
