import { z } from "zod";
import { errorResponse, readBody } from "@/lib/errors";
import { open } from "@/lib/seal";

const Body = z.object({ token: z.string().max(10_000) });

export async function POST(req: Request) {
  try {
    const { token } = await readBody(req, Body);
    const { bugLines, original, mutated, category, lesson } = open(token);
    return Response.json({ bugLines, original, mutated, category, lesson });
  } catch (err) {
    return errorResponse(err);
  }
}
