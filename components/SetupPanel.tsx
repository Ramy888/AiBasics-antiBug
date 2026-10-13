"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { MAX_PASTE_LINES } from "@/lib/shared";

export type Commit = { sha: string; message: string; date: string };

type Props = {
  // `commits` lives in the page so the list survives this panel unmounting while a drill plants.
  // `failedSha` is the commit whose drill just failed; its error shows on that row.
  initial: { tab: "github" | "paste"; repo: string; code: string; commits: Commit[] | null; failedSha: string | null };
  onCommitsLoaded: (repo: string, commits: Commit[] | null) => void;
  error: string | null;
  onCommit: (repo: string, sha: string) => void;
  onPaste: (code: string, filename: string) => void;
  onSample: () => void;
};

function age(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!iso || Number.isNaN(s)) return "";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function SetupPanel({ initial, error, onCommitsLoaded, onCommit, onPaste, onSample }: Props) {
  const [tab, setTab] = useState(initial.tab);
  const [repo, setRepo] = useState(initial.repo);
  const [commits, setCommits] = useState<Commit[] | null>(initial.commits);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [code, setCode] = useState(initial.code);
  const [filename, setFilename] = useState("");
  const lines = code ? code.split("\n").length : 0;
  const failedSha = error && commits?.some((c) => c.sha === initial.failedSha) ? initial.failedSha : null;
  const failedRef = useRef<HTMLParagraphElement | null>(null);

  // The panel remounts at the top of the page after planting; bring the failed row back into view.
  useEffect(() => {
    failedRef.current?.scrollIntoView({ block: "center" });
  }, [failedSha]);

  async function loadCommits(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setListError(null);
    setCommits(null);
    onCommitsLoaded(repo, null);
    try {
      const { commits } = await post<{ commits: Commit[] }>("/api/commits", { repo });
      setCommits(commits);
      onCommitsLoaded(repo, commits);
    } catch (err) {
      setListError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card setup">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "github"} className={`tab ${tab === "github" ? "on" : ""}`} onClick={() => setTab("github")}>
          From GitHub
        </button>
        <button role="tab" aria-selected={tab === "paste"} className={`tab ${tab === "paste" ? "on" : ""}`} onClick={() => setTab("paste")}>
          Paste code
        </button>
        <span className="spacer" />
        <button className="btn tabs-sample" onClick={onSample} title="Drill a small shopping-cart file">
          Try a sample
        </button>
      </div>

      {tab === "github" ? (
        <>
          <form className="row" onSubmit={loadCommits}>
            <input
              className="input mono"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="owner/repo or https://github.com/owner/repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              aria-label="Public GitHub repo"
            />
            <button className="btn btn-primary" disabled={repo.trim().length < 3 || loading}>
              {loading ? "Loading…" : "Load commits"}
            </button>
          </form>
          <p className="hint-text" style={{ marginTop: 8 }}>Public repos only. We drill the JS/TS file with the most added lines in the commit you pick, skipping tests when there&apos;s other code.</p>
          {commits && commits.length === 0 && <p className="hint-text" style={{ marginTop: 12 }}>No commits found.</p>}
          {commits && commits.length > 0 && (
            <ul className="commits">
              {commits.map((c) => (
                <li key={c.sha}>
                  <button className="commit" onClick={() => onCommit(repo, c.sha)}>
                    <span className="commit-msg">{c.message}</span>
                    <span className="commit-meta mono">
                      {c.sha.slice(0, 7)} · {age(c.date)}
                    </span>
                  </button>
                  {c.sha === failedSha && (
                    <p ref={failedRef} className="error commit-error" role="alert">
                      {error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(listError ?? (failedSha ? null : error)) && <p className="error" role="alert">{listError ?? error}</p>}
        </>
      ) : (
        <>
          <textarea
            className="textarea"
            placeholder={`// paste up to ${MAX_PASTE_LINES} lines of JavaScript or TypeScript`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            aria-label="Code to sabotage"
          />
          <div className="row" style={{ marginTop: 12 }}>
            <input
              className="input mono"
              style={{ maxWidth: 260 }}
              placeholder="filename (optional), e.g. cart.ts"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              aria-label="Filename"
            />
            <span className="hint-text">
              {lines} / {MAX_PASTE_LINES} lines
            </span>
            <span className="spacer" />
            <button className="btn btn-primary" disabled={!code.trim() || lines > MAX_PASTE_LINES} onClick={() => onPaste(code, filename.trim())}>
              Sabotage it
            </button>
          </div>
          {lines > MAX_PASTE_LINES && <p className="error">That&apos;s more than {MAX_PASTE_LINES} lines. Trim it down to the part you want to drill.</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
