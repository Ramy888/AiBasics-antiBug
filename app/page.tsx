"use client";

import { useEffect, useRef, useState } from "react";
import { CodeView } from "@/components/CodeView";
import { Header } from "@/components/Header";
import { PlantingProgress } from "@/components/PlantingProgress";
import { RevealPanel, type Reveal } from "@/components/RevealPanel";
import { SetupPanel } from "@/components/SetupPanel";
import { post } from "@/lib/api";
import type { DrillResponse } from "@/lib/drill";

type Phase = "setup" | "planting" | "hunt" | "reveal";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
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

  async function startPaste(code: string, filename: string) {
    setPasted(code);
    setError(null);
    setPhase("planting");
    abort.current = new AbortController();
    const timeout = setTimeout(() => abort.current?.abort("timeout"), 60_000);
    try {
      const d = await post<DrillResponse>("/api/drill", { code, filename: filename || undefined }, abort.current.signal);
      setDrill(d);
      setWrong([]);
      setLastWrong(null);
      setReveal(null);
      setPhase("hunt");
    } catch (e) {
      const timedOut = abort.current?.signal.reason === "timeout";
      const cancelled = abort.current?.signal.aborted && !timedOut;
      setError(cancelled ? null : timedOut ? "Planting took too long. Try again or paste less code." : (e as Error).message);
      setPhase("setup");
    } finally {
      clearTimeout(timeout);
    }
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
      {phase === "setup" && <SetupPanel initialCode={pasted} error={error} onPaste={startPaste} />}
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
