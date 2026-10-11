// Types and helpers shared by the browser and the server. Keep this file free of server-only imports.

export const MAX_PASTE_LINES = 300;
export const JS_TS = /\.(m|c)?(j|t)sx?$/;

/** A run of consecutive lines shown in the hunt, with real 1-based line numbers. */
export type Region = { start: number; lines: string[] };

export type DrillResponse = {
  token: string;
  file: string;
  commit?: { sha: string; message: string };
  regions: Region[];
};

export type Temperature = "hot" | "warm" | "cold";

export function temperature(line: number, bugLines: number[]): Temperature | null {
  const distance = Math.min(...bugLines.map((b) => Math.abs(b - line)));
  if (distance === 0) return null;
  if (distance <= 3) return "hot";
  if (distance <= 10) return "warm";
  return "cold";
}
