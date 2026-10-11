export type ErrorCode =
  | "bad_request"
  | "too_long"
  | "not_found"
  | "github_rate_limited"
  | "no_eligible_file"
  | "plant_failed"
  | "token_invalid"
  | "rate_limited"
  | "upstream";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  too_long: 413,
  not_found: 404,
  github_rate_limited: 429,
  no_eligible_file: 422,
  plant_failed: 502,
  token_invalid: 400,
  rate_limited: 429,
  upstream: 502,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: STATUS[err.code] },
    );
  }
  console.error(err);
  return Response.json(
    { error: { code: "upstream", message: "Something went wrong. Try again." } },
    { status: 500 },
  );
}

/** Parse a JSON body with a zod-like schema, throwing a 400 AppError on failure. */
export async function readBody<T>(
  req: Request,
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("bad_request", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AppError("bad_request", "Request body is invalid.");
  return parsed.data;
}
