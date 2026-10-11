import { z } from "zod";
import { temperature } from "@/lib/shared";
import { errorResponse, readBody } from "@/lib/errors";
import { open } from "@/lib/seal";

const Body = z.object({ token: z.string().max(10_000), line: z.number().int().positive() });

export async function POST(req: Request) {
  try {
    const { token, line } = await readBody(req, Body);
    const { bugLines } = open(token);
    const correct = bugLines.includes(line);
    return Response.json({ correct, temperature: correct ? null : temperature(line, bugLines) });
  } catch (err) {
    return errorResponse(err);
  }
}
