"use client";

import { useEffect, useRef, useState } from "react";
import { CodeView } from "@/components/CodeView";
import { Header } from "@/components/Header";
import { PlantingProgress } from "@/components/PlantingProgress";
import { RevealPanel, type Reveal } from "@/components/RevealPanel";
import { SetupPanel } from "@/components/SetupPanel";
import { post } from "@/lib/api";
import type { DrillResponse } from "@/lib/shared";

type Phase = "setup" | "planting" | "hunt" | "reveal";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ tab: "github" | "paste"; repo: string; code: string }>({ tab: "github", repo: "", code: "" });
  const [drill, setDrill] = useState<DrillResponse | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [found, setFound] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);

  // The reveal renders above the code, often off-screen when the bug is far down the file.
  useEffect(() => {
    if (phase === "reveal") revealRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  async function startDrill(body: object) {
    setError(null);
    setPhase("planting");
    abort.current = new AbortController();
    const timeout = setTimeout(() => abort.current?.abort("timeout"), 60_000);
    try {
      const d = await post<DrillResponse>("/api/drill", body, abort.current.signal);
      setDrill(d);
      setWrong([]);
      setLastWrong(null);
      setReveal(null);
      setPhase("hunt");
    } catch (e) {
      const timedOut = abort.current?.signal.reason === "timeout";
      const cancelled = abort.current?.signal.aborted && !timedOut;
      setError(cancelled ? null : timedOut ? "Planting took too long. Try again, or pick a smaller change." : (e as Error).message);
      setPhase("setup");
    } finally {
      clearTimeout(timeout);
    }
  }

  function startCommit(repo: string, sha: string) {
    setSetup({ tab: "github", repo, code: "" });
    startDrill({ repo, sha });
  }

  function startPaste(code: string, filename: string) {
    setSetup({ tab: "paste", repo: "", code });
    startDrill({ code, filename: filename || undefined });
  }

  async function guess(line: number) {
    if (!drill || checking || wrong.includes(line)) return;
    setChecking(true);
    try {
      const r = await post<{ correct: boolean }>("/api/guess", { token: drill.token, line });
      if (r.correct) {
        setFound(true);
        setReveal(await post<Reveal>("/api/reveal", { token: drill.token }));
        setPhase("reveal");
      } else {
        setWrong((w) => [...w, line]);
        setLastWrong(line);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function newCode() {
    setDrill(null);
    setFound(false);
    setError(null);
    setPhase("setup");
  }

  return (
    <main className="shell">
      <Header />
      {phase === "setup" && <SetupPanel initial={setup} error={error} onCommit={startCommit} onPaste={startPaste} />}
      {phase === "planting" && <PlantingProgress onCancel={() => abort.current?.abort()} />}
      {(phase === "hunt" || phase === "reveal") && drill && (
        <>
          {phase === "reveal" && reveal && (
            <div ref={revealRef} style={{ marginBottom: 16, scrollMarginTop: 16 }}>
              <RevealPanel reveal={reveal} found={found} wrongGuesses={wrong.length} onNew={newCode} />
            </div>
          )}
          <div className="huntbar">
            <span className="filepath">
              <strong>{drill.file}</strong>
              {drill.commit && ` @ ${drill.commit.sha.slice(0, 7)} · ${drill.commit.message}`}
            </span>
            {phase === "hunt" && <span className="callout">Sabotage planted. Find it.</span>}
            <span className="feedback">{phase === "hunt" && lastWrong !== null ? `Not line ${lastWrong}.` : ""}</span>
          </div>
          <CodeView
            regions={drill.regions}
            wrong={wrong}
            lastWrong={lastWrong}
            found={reveal?.bugLines ?? []}
            disabled={phase !== "hunt" || checking}
            onPick={guess}
          />
          {error && phase === "hunt" && <p className="error" role="alert">{error}</p>}
        </>
      )}
    </main>
  );
}
