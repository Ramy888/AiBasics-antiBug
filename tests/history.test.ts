import { describe, expect, it } from "vitest";
import { HISTORY_MAX, loadHistory, recordDrill } from "@/lib/history";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("drill history", () => {
  it("keeps the newest drills first, capped", () => {
    const s = memory();
    for (let i = 0; i < HISTORY_MAX + 3; i++) recordDrill({ file: `f${i}.ts`, seconds: i, found: true, at: i }, s);
    const h = loadHistory(s);
    expect(h).toHaveLength(HISTORY_MAX);
    expect(h[0].file).toBe(`f${HISTORY_MAX + 2}.ts`);
  });

  it("records give-ups with no time", () => {
    const s = memory();
    recordDrill({ file: "a.ts", seconds: null, found: false, at: 1 }, s);
    expect(loadHistory(s)).toEqual([{ file: "a.ts", seconds: null, found: false, at: 1 }]);
  });

  it("survives blocked or corrupt storage", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadHistory(blocked)).toEqual([]);
    expect(() => recordDrill({ file: "a.ts", seconds: 3, found: true, at: 1 }, blocked)).not.toThrow();
    const s = memory();
    s.setItem("antibug:history:v1", '[{"file":1}]');
    expect(loadHistory(s)).toEqual([]);
  });
});
