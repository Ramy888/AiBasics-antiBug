import { describe, expect, it } from "vitest";
import { open, seal } from "@/lib/seal";

const answer = { bugLines: [15], original: "a >= b", mutated: "a > b", category: "comparison", lesson: "Boundary.", file: "cart.ts" };

describe("seal", () => {
  it("round-trips an answer", () => {
    expect(open(seal(answer))).toMatchObject(answer);
  });

  it("does not expose the answer in the token", () => {
    const token = seal(answer);
    for (const s of ["a >= b", "comparison", "Boundary", "cart.ts"]) {
      expect(token).not.toContain(s);
      expect(Buffer.from(token, "base64url").toString("latin1")).not.toContain(s);
    }
  });

  it("rejects a tampered token", () => {
    const token = seal(answer);
    const flipped = token.slice(0, 40) + (token[40] === "A" ? "B" : "A") + token.slice(41);
    expect(() => open(flipped)).toThrow(/expired/);
    expect(() => open("garbage")).toThrow(/expired/);
  });

  it("rejects a token older than an hour", () => {
    const issued = Date.now();
    const token = seal(answer, issued);
    expect(() => open(token, issued + 59 * 60 * 1000)).not.toThrow();
    expect(() => open(token, issued + 61 * 60 * 1000)).toThrow(/expired/);
  });
});
