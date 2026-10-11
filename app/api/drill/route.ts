import { z } from "zod";
import { drillPasted } from "@/lib/drill";
import { errorResponse, readBody } from "@/lib/errors";

export const maxDuration = 60;

const Body = z.object({
  code: z.string().max(60_000),
  filename: z.string().max(200).optional(),
  avoidLines: z.array(z.number().int().positive()).max(500).default([]),
});

export async function POST(req: Request) {
  try {
    const body = await readBody(req, Body);
    return Response.json(await drillPasted(body.code, body.filename, body.avoidLines));
  } catch (err) {
    return errorResponse(err);
  }
}
