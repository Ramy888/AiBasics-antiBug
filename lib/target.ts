import { JS_TS, type Region } from "./shared";

export type Hunk = { start: number; length: number };
export type CommitFile = { filename: string; status: string; additions: number; patch?: string };

const MIN_ADDED = 3;

/** Read a unified-diff patch: each hunk's range in the new file, and which new-file lines were added. */
export function parsePatch(patch: string): { hunks: Hunk[]; added: number[] } {
  const hunks: Hunk[] = [];
  const added: number[] = [];
  let line = 0;
  for (const row of patch.split("\n")) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(row);
    if (header) {
      line = Number(header[1]);
      hunks.push({ start: line, length: header[2] === undefined ? 1 : Number(header[2]) });
    } else if (row.startsWith("+")) {
      added.push(line++);
    } else if (row.startsWith(" ") || row === "") {
      line++;
    }
    // "-" rows and "\ No newline at end of file" don't exist in the new file.
  }
  return { hunks, added };
}

export function isEligible(path: string): boolean {
  return JS_TS.test(path) && !path.endsWith(".d.ts") && !/\.min\.[cm]?js$/.test(path) && !/(^|\/)(node_modules|dist|vendor)\//.test(path);
}

/** Test files: a planted bug there skips or weakens a check rather than breaking shipped logic. */
export function isTestFile(path: string): boolean {
  return /(^|\/)(tests?|__tests__|specs?)\//.test(path) || /[._](test|spec)\.[cm]?[jt]sx?$/.test(path);
}

/** Eligible files with at least 3 added lines: source before tests, then most added lines first. */
export function rankTargets(files: CommitFile[]): CommitFile[] {
  return files
    .filter((f) => f.status !== "removed" && f.patch && isEligible(f.filename) && f.additions >= MIN_ADDED)
    .sort((a, b) => Number(isTestFile(a.filename)) - Number(isTestFile(b.filename)) || b.additions - a.additions);
}

/** The changed hunks plus `context` lines either side, merged where they touch, with real line numbers. */
export function displayRegions(lines: string[], hunks: Hunk[], context = 3): Region[] {
  const ranges = hunks
    .map((h) => [Math.max(1, h.start - context), Math.min(lines.length, h.start + Math.max(h.length, 1) - 1 + context)] as const)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of ranges) {
    const last = merged.at(-1);
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged.map(([from, to]) => ({ start: from, lines: lines.slice(from - 1, to) }));
}
