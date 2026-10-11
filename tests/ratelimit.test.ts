import { describe, expect, it } from "vitest";
import { clientIp, takeDrill } from "@/lib/ratelimit";

describe("rate limit", () => {
  it("allows 10 drills an hour per visitor, then refuses the 11th until the window passes", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) takeDrill("1.2.3.4", t0 + i, 10);
    expect(() => takeDrill("1.2.3.4", t0 + 10, 10)).toThrow(/Easy, tiger/);
    expect(() => takeDrill("5.6.7.8", t0 + 10, 10)).not.toThrow();
    expect(() => takeDrill("1.2.3.4", t0 + 60 * 60 * 1000 + 1, 10)).not.toThrow();
  });

  it("reads the visitor's IP from proxy headers", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
