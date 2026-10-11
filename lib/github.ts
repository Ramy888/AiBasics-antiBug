import { AppError } from "./errors";
import type { CommitFile } from "./target";

const API = "https://api.github.com";

export type Repo = { owner: string; repo: string };
export type CommitSummary = { sha: string; message: string; date: string };

/** Accepts `owner/repo` or any github.com URL into the repo. */
export function parseRepo(input: string): Repo {
  const raw = input.trim();
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(raw);
  const bare = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(raw);
  const m = url ?? bare;
  if (!m) throw new AppError("bad_request", "Enter a repo as owner/repo or a github.com link.");
  return { owner: m[1], repo: m[2] };
}

async function gh(url: string, accept = "application/vnd.github+json"): Promise<Response> {
  const headers: Record<string, string> = { accept, "user-agent": "antiBug", "x-github-api-version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch {
    throw new AppError("upstream", "Couldn't reach GitHub. Check your connection and try again.");
  }
  if (res.ok) return res;
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new AppError("github_rate_limited", "GitHub's hourly limit is used up. Try again later, or paste code instead.");
  }
  if (res.status === 404 || res.status === 422 || res.status === 403) {
    throw new AppError("not_found", "Can't see that repo or commit. Is it public?");
  }
  throw new AppError("upstream", `GitHub answered ${res.status}. Try again in a minute.`);
}

export async function listCommits({ owner, repo }: Repo): Promise<CommitSummary[]> {
  const res = await gh(`${API}/repos/${owner}/${repo}/commits?per_page=10`);
  const data = (await res.json()) as { sha: string; commit: { message: string; author: { date: string } | null } }[];
  return data.map((c) => ({ sha: c.sha, message: c.commit.message.split("\n")[0], date: c.commit.author?.date ?? "" }));
}

export async function getCommit({ owner, repo }: Repo, sha: string): Promise<{ sha: string; message: string; files: CommitFile[] }> {
  const res = await gh(`${API}/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`);
  const data = (await res.json()) as { sha: string; commit: { message: string }; files?: CommitFile[] };
  return { sha: data.sha, message: data.commit.message.split("\n")[0], files: data.files ?? [] };
}

export async function getFileAt({ owner, repo }: Repo, sha: string, path: string): Promise<string> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await gh(`https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${encoded}`, "text/plain");
  return res.text();
}
