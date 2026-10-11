import { describe, expect, it } from "vitest";
import { loadStreak, recordFound, recordGiveUp } from "@/lib/streak";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("streak", () => {
  it("starts empty, counts found drills, and keeps the fastest time", () => {
    const s = memory();
    expect(loadStreak(s)).toEqual({ streak: 0, best: null });
    recordFound(40.2, s);
    recordFound(55, s);
    expect(loadStreak(s)).toEqual({ streak: 2, best: 40.2 });
  });

  it("resets the streak on give up but keeps the best time", () => {
    const s = memory();
    recordFound(31, s);
    recordGiveUp(s);
    expect(loadStreak(s)).toEqual({ streak: 0, best: 31 });
  });

  it("survives blocked or corrupt storage", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadStreak(blocked)).toEqual({ streak: 0, best: null });
    expect(recordFound(12, blocked)).toEqual({ streak: 1, best: 12 });
    const corrupt = { getItem: () => "{nope", setItem: () => {} };
    expect(loadStreak(corrupt)).toEqual({ streak: 0, best: null });
    expect(loadStreak(null)).toEqual({ streak: 0, best: null });
  });
});
