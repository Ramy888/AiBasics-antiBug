import { AppError } from "./errors";
import { askClaude, plantBug, type AskFn } from "./saboteur";
import { seal } from "./seal";

export const MAX_PASTE_LINES = 300;
export const JS_TS = /\.(m|c)?(j|t)sx?$/;

/** A run of consecutive lines shown in the hunt, with real 1-based line numbers. */
export type Region = { start: number; lines: string[] };

export type DrillResponse = { token: string; file: string; commit?: string; regions: Region[] };

export type Temperature = "hot" | "warm" | "cold";

export function temperature(line: number, bugLines: number[]): Temperature | null {
  const distance = Math.min(...bugLines.map((b) => Math.abs(b - line)));
  if (distance === 0) return null;
  if (distance <= 3) return "hot";
  if (distance <= 10) return "warm";
  return "cold";
}

export async function drillPasted(
  code: string,
  filename: string | undefined,
  avoidLines: number[],
  ask: AskFn = askClaude,
): Promise<DrillResponse> {
  const content = code.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const lines = content.split("\n");
  if (lines.length > MAX_PASTE_LINES) {
    throw new AppError("too_long", `That's ${lines.length} lines. Paste ${MAX_PASTE_LINES} or fewer.`);
  }
  if (lines.filter((l) => l.trim()).length < 3) {
    throw new AppError("bad_request", "Paste at least a few lines of real code.");
  }
  const file = filename && JS_TS.test(filename) && !filename.endsWith(".d.ts") ? filename : "snippet.ts";
  const planted = await plantBug(
    { filename: file, content, eligibleLines: new Set(lines.map((_, i) => i + 1)), avoidLines: new Set(avoidLines) },
    ask,
  );
  const { mutation, bugLines, sabotagedContent } = planted;
  return {
    token: seal({ bugLines, original: mutation.original, mutated: mutation.mutated, category: mutation.category, lesson: mutation.lesson, file }),
    file,
    regions: [{ start: 1, lines: sabotagedContent.split("\n") }],
  };
}
