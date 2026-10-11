// Client-safe display text for bug categories (kept apart from validate.ts, which pulls in the TS compiler).
export const CATEGORY_LABEL: Record<string, string> = {
  off_by_one: "off-by-one",
  comparison: "comparison operator",
  boolean_logic: "boolean logic",
  argument_order: "argument order",
  missing_await: "missing await",
  wrong_default: "wrong default value",
  wrong_variable: "wrong variable",
  arithmetic: "arithmetic",
  other: "logic slip",
};
