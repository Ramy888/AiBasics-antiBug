import ts from "typescript";

export const CATEGORIES = [
  "off_by_one",
  "comparison",
  "boolean_logic",
  "argument_order",
  "missing_await",
  "wrong_default",
  "wrong_variable",
  "arithmetic",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** What the saboteur proposes: replace `original` (starting at 1-based `line`) with `mutated`. */
export type Mutation = {
  line: number;
  original: string;
  mutated: string;
  category: Category;
  lesson: string;
};

export type CheckInput = {
  filename: string;
  content: string;
  eligibleLines: Set<number>;
  avoidLines: Set<number>;
};

export type CheckResult =
  | { ok: true; sabotagedContent: string; bugLines: number[] }
  | { ok: false; reason: string };

const MAX_CHANGED_LINES = 3;

function splitLines(s: string): string[] {
  return s.replace(/\r\n/g, "\n").split("\n");
}

function transpile(filename: string, source: string) {
  return ts.transpileModule(source, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
  });
}

export function checkMutation(input: CheckInput, m: Mutation): CheckResult {
  const fileLines = splitLines(input.content);
  const original = splitLines(m.original);
  const mutated = splitLines(m.mutated);
  const start = m.line - 1;

  if (original.length < 1 || original.length > MAX_CHANGED_LINES) {
    return { ok: false, reason: `"original" must span 1 to ${MAX_CHANGED_LINES} lines.` };
  }
  if (mutated.length !== original.length) {
    return {
      ok: false,
      reason: `"mutated" must have exactly as many lines as "original" (${original.length}), so line numbers stay put.`,
    };
  }
  if (start < 0 || start + original.length > fileLines.length) {
    return { ok: false, reason: `Line ${m.line} is outside the file.` };
  }
  for (let i = 0; i < original.length; i++) {
    if (fileLines[start + i].trimEnd() !== original[i].trimEnd()) {
      return {
        ok: false,
        reason: `"original" does not match the file at line ${m.line + i}. Copy those lines exactly.`,
      };
    }
  }

  const bugLines: number[] = [];
  for (let i = 0; i < original.length; i++) {
    if (original[i].trimEnd() !== mutated[i].trimEnd()) bugLines.push(m.line + i);
  }
  if (bugLines.length === 0) return { ok: false, reason: "The mutation changes nothing." };

  for (const n of bugLines) {
    if (!input.eligibleLines.has(n)) {
      return { ok: false, reason: `Line ${n} is not one of the eligible lines.` };
    }
    if (input.avoidLines.has(n)) {
      return { ok: false, reason: `Line ${n} was already used in this session. Pick a different line.` };
    }
  }

  const sabotaged = [...fileLines];
  sabotaged.splice(start, original.length, ...mutated);
  const sabotagedContent = sabotaged.join("\n");

  const before = transpile(input.filename, input.content);
  const after = transpile(input.filename, sabotagedContent);
  if ((after.diagnostics?.length ?? 0) > (before.diagnostics?.length ?? 0)) {
    return { ok: false, reason: "The sabotaged file no longer parses. The bug must keep the code syntactically valid." };
  }
  // Transpiled output drops comments, whitespace and type annotations, so identical output
  // means the change cannot affect runtime behaviour.
  if (before.outputText === after.outputText) {
    return { ok: false, reason: "The change only touches whitespace, comments or types. It must change runtime behaviour." };
  }

  return { ok: true, sabotagedContent, bugLines };
}
