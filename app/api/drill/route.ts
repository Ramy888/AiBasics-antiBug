import { z } from "zod";
import { drillCommit, drillPasted } from "@/lib/drill";
import { errorResponse, readBody } from "@/lib/errors";
import { clientIp, takeDrill } from "@/lib/ratelimit";

export const maxDuration = 60;

const avoidLines = z.array(z.number().int().positive()).max(500).default([]);
const Body = z.union([
  z.object({ repo: z.string().min(3).max(300), sha: z.string().regex(/^[0-9a-f]{7,40}$/i), avoidLines }),
  z.object({ code: z.string().max(60_000), filename: z.string().max(200).optional(), avoidLines }),
]);

export async function POST(req: Request) {
  try {
    const body = await readBody(req, Body);
    takeDrill(clientIp(req));
    const drill = "code" in body ? drillPasted(body.code, body.filename, body.avoidLines) : drillCommit(body.repo, body.sha, body.avoidLines);
    return Response.json(await drill);
  } catch (err) {
    return errorResponse(err);
  }
}
