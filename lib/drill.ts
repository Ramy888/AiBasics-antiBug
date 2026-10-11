import { AppError } from "./errors";
import { getCommit, getFileAt, parseRepo } from "./github";
import { askClaude, plantBug, type AskFn } from "./saboteur";
import { seal } from "./seal";
import { JS_TS, MAX_PASTE_LINES, type DrillResponse } from "./shared";
import { displayRegions, parsePatch, rankTargets } from "./target";
import type { Mutation } from "./validate";

const MAX_FILE_LINES = 2000;

function sealAnswer(m: Mutation, bugLines: number[], file: string): string {
  return seal({ bugLines, original: m.original, mutated: m.mutated, category: m.category, lesson: m.lesson, file });
}

const toLines = (s: string) => s.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");

export async function drillPasted(
  code: string,
  filename: string | undefined,
  avoidLines: number[],
  ask: AskFn = askClaude,
): Promise<DrillResponse> {
  const lines = toLines(code);
  if (lines.length > MAX_PASTE_LINES) {
    throw new AppError("too_long", `That's ${lines.length} lines. Paste ${MAX_PASTE_LINES} or fewer.`);
  }
  if (lines.filter((l) => l.trim()).length < 3) {
    throw new AppError("bad_request", "Paste at least a few lines of real code.");
  }
  const file = filename && JS_TS.test(filename) && !filename.endsWith(".d.ts") ? filename : "snippet.ts";
  const { mutation, bugLines, sabotagedContent } = await plantBug(
    { filename: file, content: lines.join("\n"), eligibleLines: new Set(lines.map((_, i) => i + 1)), avoidLines: new Set(avoidLines) },
    ask,
  );
  return { token: sealAnswer(mutation, bugLines, file), file, regions: [{ start: 1, lines: sabotagedContent.split("\n") }] };
}

export async function drillCommit(repoInput: string, sha: string, avoidLines: number[], ask: AskFn = askClaude): Promise<DrillResponse> {
  const repo = parseRepo(repoInput);
  const commit = await getCommit(repo, sha);
  const candidates = rankTargets(commit.files);
  if (candidates.length === 0) {
    throw new AppError("no_eligible_file", "No JavaScript/TypeScript changes here. Pick another commit.");
  }
  for (const target of candidates) {
    const lines = toLines(await getFileAt(repo, commit.sha, target.filename));
    if (lines.length > MAX_FILE_LINES) continue;
    const { hunks, added } = parsePatch(target.patch!);
    const eligible = new Set(added.filter((n) => lines[n - 1]?.trim()));
    if (eligible.size < 1) continue;
    const { mutation, bugLines, sabotagedContent } = await plantBug(
      { filename: target.filename, content: lines.join("\n"), eligibleLines: eligible, avoidLines: new Set(avoidLines) },
      ask,
    );
    return {
      token: sealAnswer(mutation, bugLines, target.filename),
      file: target.filename,
      commit: { sha: commit.sha, message: commit.message },
      regions: displayRegions(sabotagedContent.split("\n"), hunks),
    };
  }
  throw new AppError("no_eligible_file", "This commit's JavaScript/TypeScript files are too large to drill. Pick another commit.");
}
