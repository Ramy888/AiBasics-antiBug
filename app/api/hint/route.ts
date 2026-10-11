import { z } from "zod";
import { errorResponse, readBody } from "@/lib/errors";
import { open } from "@/lib/seal";

const Body = z.object({ token: z.string().max(10_000) });

export async function POST(req: Request) {
  try {
    const { token } = await readBody(req, Body);
    return Response.json({ category: open(token).category });
  } catch (err) {
    return errorResponse(err);
  }
}
