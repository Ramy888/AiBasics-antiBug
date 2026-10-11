"use client";

import { useEffect, useRef, useState } from "react";
import { CodeView } from "@/components/CodeView";
import { Header } from "@/components/Header";
import { HuntPanel } from "@/components/HuntPanel";
import { PlantingProgress } from "@/components/PlantingProgress";
import { RevealPanel, type Reveal } from "@/components/RevealPanel";
import { SetupPanel } from "@/components/SetupPanel";
import { post } from "@/lib/api";
import type { DrillResponse, Temperature } from "@/lib/shared";

type Phase = "setup" | "planting" | "hunt" | "reveal";
type Source = { repo: string; sha: string } | { code: string; filename?: string };

const WRONG_PENALTY = 10;
const HINT_PENALTY = 15;
const PLANT_TIMEOUT_MS = 60_000;

export default function Page() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ tab: "github" | "paste"; repo: string; code: string }>({ tab: "github", repo: "", code: "" });
  const [source, setSource] = useState<Source | null>(null);
  // Bug lines already drilled on this source, so "Drill again" plants somewhere new.
  const [usedLines, setUsedLines] = useState<number[]>([]);
  const [drill, setDrill] = useState<DrillResponse | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  const [temp, setTemp] = useState<Temperature | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [result, setResult] = useState<{ found: boolean; seconds: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);

  // The reveal renders above the code, often off-screen when the bug is far down the file.
  useEffect(() => {
    if (phase === "reveal") revealRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  async function plant(src: Source, avoidLines: number[]) {
    setSource(src);
    setError(null);
    setPhase("planting");
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), PLANT_TIMEOUT_MS);
    try {
      const d = await post<DrillResponse>("/api/drill", { ...src, avoidLines }, controller.signal);
      setDrill(d);
      setWrong([]);
      setLastWrong(null);
      setTemp(null);
      setHint(null);
      setPenalty(0);
      setReveal(null);
      setResult(null);
      setStartedAt(Date.now());
      setPhase("hunt");
    } catch (e) {
      const timedOut = controller.signal.reason === "timeout";
      const cancelled = controller.signal.aborted && !timedOut;
      setError(cancelled ? null : timedOut ? "Planting took too long. Try again, or pick a smaller change." : (e as Error).message);
      setPhase(drill && avoidLines.length ? "reveal" : "setup");
    } finally {
      clearTimeout(timeout);
    }
  }

  function startCommit(repo: string, sha: string) {
    setSetup({ tab: "github", repo, code: "" });
    setUsedLines([]);
    plant({ repo, sha }, []);
  }

  function startPaste(code: string, filename: string) {
    setSetup({ tab: "paste", repo: "", code });
    setUsedLines([]);
    plant({ code, filename: filename || undefined }, []);
  }

  async function finish(found: boolean, penaltyNow: number) {
    if (!drill) return;
    const seconds = (Date.now() - startedAt) / 1000 + penaltyNow;
    const r = await post<Reveal>("/api/reveal", { token: drill.token });
    setReveal(r);
    setUsedLines((u) => [...new Set([...u, ...r.bugLines])]);
    setResult({ found, seconds });
    setPhase("reveal");
  }

  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const guess = (line: number) =>
    act(async () => {
      if (!drill || wrong.includes(line)) return;
      const r = await post<{ correct: boolean; temperature: Temperature | null }>("/api/guess", { token: drill.token, line });
      if (r.correct) return finish(true, penalty);
      setWrong((w) => [...w, line]);
      setLastWrong(line);
      setTemp(r.temperature);
      setPenalty((p) => p + WRONG_PENALTY);
    });

  const askHint = () =>
    act(async () => {
      if (!drill) return;
      const r = await post<{ category: string }>("/api/hint", { token: drill.token });
      setHint(r.category);
      setPenalty((p) => p + HINT_PENALTY);
    });

  const giveUp = () => act(() => finish(false, penalty));

  function newCode() {
    setDrill(null);
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
          {phase === "reveal" && reveal && result && (
            <div ref={revealRef} style={{ marginBottom: 16, scrollMarginTop: 16 }}>
              <RevealPanel
                reveal={reveal}
                found={result.found}
                seconds={result.seconds}
                penalty={penalty}
                wrongGuesses={wrong.length}
                usedHint={hint !== null}
                error={error}
                onAgain={() => source && plant(source, usedLines)}
                onNew={newCode}
              />
            </div>
          )}
          {phase === "hunt" && (
            <HuntPanel
              startedAt={startedAt}
              penalty={penalty}
              temperature={temp}
              lastWrong={lastWrong}
              hint={hint}
              busy={busy}
              onHint={askHint}
              onGiveUp={giveUp}
            />
          )}
          <div className="huntbar">
            <span className="filepath">
              <strong>{drill.file}</strong>
              {drill.commit && ` @ ${drill.commit.sha.slice(0, 7)} · ${drill.commit.message}`}
            </span>
          </div>
          <CodeView
            regions={drill.regions}
            wrong={wrong}
            lastWrong={lastWrong}
            found={reveal?.bugLines ?? []}
            disabled={phase !== "hunt" || busy}
            onPick={guess}
          />
          {error && phase === "hunt" && <p className="error" role="alert">{error}</p>}
        </>
      )}
    </main>
  );
}
