import { z } from "zod";
import { errorResponse, readBody } from "@/lib/errors";
import { listCommits, parseRepo } from "@/lib/github";

const Body = z.object({ repo: z.string().min(3).max(300) });

export async function POST(req: Request) {
  try {
    const { repo } = await readBody(req, Body);
    return Response.json({ commits: await listCommits(parseRepo(repo)) });
  } catch (err) {
    return errorResponse(err);
  }
}
