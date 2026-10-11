import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { plantBug } from "@/lib/saboteur";

// Spends real API budget (~$0.05-0.15). Proves the structured-output + fallback call shape
// works and that Claude's bug passes the checker on a realistic file.
it("plants a checker-approved bug in a real file", async () => {
  // ANTIBUG_LIVE_FILE=/path/to/file.ts drills any file; defaults to the cart fixture.
  const file = process.env.ANTIBUG_LIVE_FILE ?? path.join(import.meta.dirname, "../fixtures/cart.ts");
  const content = readFileSync(file, "utf8").replace(/\n+$/, "");
  const input = { filename: path.basename(file), content, eligibleLines: new Set(content.split("\n").map((_, i) => i + 1)), avoidLines: new Set([15]) };

  const r = await plantBug(input);
  console.log("planted:", JSON.stringify({ ...r.mutation, bugLines: r.bugLines }, null, 2));
  expect(r.bugLines.length).toBeGreaterThan(0);
  expect(r.bugLines).not.toContain(15);
});
