import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRepo } from "@/lib/github";
import { displayRegions, isEligible, parsePatch, rankTargets, type CommitFile } from "@/lib/target";

// A real commit from github.com/lukeed/dequal, captured with the file as it was at that commit.
const commit = JSON.parse(readFileSync(path.join(__dirname, "fixtures/commit-dequal.json"), "utf8")) as { files: CommitFile[] };
const file = readFileSync(path.join(__dirname, "fixtures/dequal-bench-index.js"), "utf8").replace(/\n$/, "").split("\n");
const bench = commit.files.find((f) => f.filename === "bench/index.js")!;

describe("parsePatch", () => {
  it("finds the added lines' numbers in the new file", () => {
    const { hunks, added } = parsePatch(bench.patch!);
    expect(hunks).toEqual([
      { start: 12, length: 17 },
      { start: 90, length: 7 },
      { start: 102, length: 7 },
    ]);
    expect(added).toEqual([15, 16, 17, 18, 23, 24, 25, 93, 105]);
    expect(added.length).toBe(bench.additions);
  });

  it("points at the real added text in the file at that commit", () => {
    const { added } = parsePatch(bench.patch!);
    expect(file[15 - 1]).toBe("console.time('deep-equal');");
    expect(file[24 - 1]).toBe("const lodash = require('lodash/isEqual');");
    expect(file[93 - 1]).toBe("\t'deep-equal': deepEqual,");
    const addedText = bench.patch!.split("\n").filter((l) => l.startsWith("+")).map((l) => l.slice(1));
    expect(added.map((n) => file[n - 1])).toEqual(addedText);
  });
});

describe("isEligible / rankTargets", () => {
  it("accepts JS/TS source and rejects types, minified, vendored and non-JS files", () => {
    for (const p of ["a.js", "b.jsx", "src/c.ts", "d.tsx", "e.mjs", "f.cjs"]) expect(isEligible(p)).toBe(true);
    for (const p of ["a.d.ts", "lib/x.min.js", "node_modules/y/index.js", "dist/z.js", "package.json", "README.md"]) expect(isEligible(p)).toBe(false);
  });

  it("picks the eligible file with the most added lines, at least 3", () => {
    const files: CommitFile[] = [
      ...commit.files,
      { filename: "src/big.ts", status: "added", additions: 40, patch: "@@ -0,0 +1,40 @@" },
      { filename: "src/gone.ts", status: "removed", additions: 0, patch: "@@" },
      { filename: "src/tiny.ts", status: "modified", additions: 2, patch: "@@" },
    ];
    expect(rankTargets(files).map((f) => f.filename)).toEqual(["src/big.ts", "bench/index.js"]);
    expect(rankTargets([commit.files[1]])).toEqual([]); // package.json only
  });

  it("ranks source files ahead of tests, falling back to tests when nothing else changed", () => {
    const f = (filename: string, additions: number): CommitFile => ({ filename, status: "modified", additions, patch: "@@" });
    const tests = [f("tests/canonical_test.ts", 400), f("src/a.test.tsx", 300), f("lib/b.spec.js", 200), f("__tests__/c.js", 100)];
    expect(rankTargets([...tests, f("src/routes/settlements.js", 164)]).map((x) => x.filename)).toEqual([
      "src/routes/settlements.js",
      ...tests.map((x) => x.filename),
    ]);
    expect(rankTargets(tests)[0].filename).toBe("tests/canonical_test.ts");
  });
});

describe("displayRegions", () => {
  it("shows each hunk with 3 lines of context and real line numbers", () => {
    const regions = displayRegions(file, parsePatch(bench.patch!).hunks);
    expect(regions.map((r) => [r.start, r.start + r.lines.length - 1])).toEqual([
      [9, 31],
      [87, 108],
    ]);
    expect(regions[0].lines[15 - 9]).toBe("console.time('deep-equal');");
  });

  it("merges touching hunks and clamps to the file", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `l${i + 1}`);
    const r = displayRegions(lines, [{ start: 2, length: 1 }, { start: 8, length: 2 }, { start: 19, length: 2 }]);
    expect(r.map((x) => [x.start, x.start + x.lines.length - 1])).toEqual([[1, 12], [16, 20]]);
  });
});

describe("parseRepo", () => {
  it("accepts owner/repo and github URLs", () => {
    expect(parseRepo("lukeed/dequal")).toEqual({ owner: "lukeed", repo: "dequal" });
    expect(parseRepo("https://github.com/lukeed/dequal")).toEqual({ owner: "lukeed", repo: "dequal" });
    expect(parseRepo("github.com/Ramy888/AiBasics-antiBug.git")).toEqual({ owner: "Ramy888", repo: "AiBasics-antiBug" });
    expect(parseRepo("https://github.com/vercel/next.js/tree/canary/packages")).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("rejects things that aren't repos", () => {
    expect(() => parseRepo("not a repo")).toThrow(/owner\/repo/);
    expect(() => parseRepo("https://gitlab.com/a/b")).toThrow();
  });
});
