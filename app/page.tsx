"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CodeView } from "@/components/CodeView";
import { HowItWorks } from "@/components/HowItWorks";
import { HuntPanel } from "@/components/HuntPanel";
import { PlantingProgress } from "@/components/PlantingProgress";
import { ResultCard, RevealDiff, type Reveal } from "@/components/RevealPanel";
import { SetupPanel, type Commit } from "@/components/SetupPanel";
import { Sidebar } from "@/components/Sidebar";
import { post } from "@/lib/api";
import type { DrillResponse, Temperature } from "@/lib/shared";
import { historySnapshot, recordDrill, serverHistory, subscribeHistory } from "@/lib/history";
import { recordFound, recordGiveUp, serverStreak, streakSnapshot, subscribeStreak } from "@/lib/streak";

type Phase = "setup" | "planting" | "hunt" | "reveal";
type Source = { repo: string; sha: string } | { code: string; filename?: string };

const WRONG_PENALTY = 10;
const HINT_PENALTY = 15;
const PLANT_TIMEOUT_MS = 60_000;

export default function Page() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ tab: "github" | "paste"; repo: string; code: string; commits: Commit[] | null; failedSha: string | null }>({
    tab: "github",
    repo: "",
    code: "",
    commits: null,
    failedSha: null,
  });
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
  const streak = useSyncExternalStore(subscribeStreak, streakSnapshot, serverStreak);
  const history = useSyncExternalStore(subscribeHistory, historySnapshot, serverHistory);
  const abort = useRef<AbortController | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);

  // The reveal renders above the code, often off-screen after clicking far down the file.
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
    setSetup((s) => ({ ...s, tab: "github", repo, failedSha: sha }));
    setUsedLines([]);
    plant({ repo, sha }, []);
  }

  function startPaste(code: string, filename: string) {
    setSetup((s) => ({ ...s, tab: "paste", code }));
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
    const rounded = Math.round(seconds * 10) / 10;
    if (found) recordFound(rounded);
    else recordGiveUp();
    recordDrill({ file: drill.file, seconds: found ? rounded : null, found, at: Date.now() });
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

  const status =
    phase === "setup" ? "Ready" : phase === "planting" ? "Planting" : phase === "hunt" ? "Hunting" : result?.found ? "Found" : "Missed";

  return (
    <div className="app">
      <Sidebar streak={streak} history={history} />
      <main className="main">
        <div className="topbar">
          <nav className="crumbs" aria-label="Where you are">
            <span className="muted">Drills</span>
            <span className="muted" aria-hidden="true">/</span>
            {drill && phase !== "setup" && phase !== "planting" ? (
              <span className="mono crumb-file">{drill.file}</span>
            ) : (
              <span>New drill</span>
            )}
          </nav>
          <span className={`status status-${status.toLowerCase()}`}>{status}</span>
        </div>

        {/* Scrolled to on reveal: the result sits at the top of the work area in both layouts. */}
        <div className="work scroll-target" ref={revealRef}>
          <div className="center">
            {phase === "setup" && (
              <>
                <header className="intro">
                  <h1 className="page-title">Your agent wrote it. Did you read it?</h1>
                  <p className="muted">antiBug plants one subtle logic bug in code you just shipped. Find the line before the clock runs away.</p>
                </header>
                <SetupPanel
                  initial={setup}
                  error={error}
                  onCommitsLoaded={(repo, commits) => setSetup((s) => ({ ...s, repo, commits }))}
                  onCommit={startCommit}
                  onPaste={startPaste}
                />
              </>
            )}
            {phase === "planting" && <PlantingProgress onCancel={() => abort.current?.abort()} />}
            {(phase === "hunt" || phase === "reveal") && drill && (
              <>
                {phase === "reveal" && reveal && <RevealDiff reveal={reveal} />}
                <section className="card code-card">
                  <div className="code-head">
                    <span className="mono code-path">{drill.file}</span>
                    {drill.commit && (
                      <span className="code-commit">
                        <span className="mono">{drill.commit.sha.slice(0, 7)}</span> {drill.commit.message}
                      </span>
                    )}
                  </div>
                  <CodeView
                    regions={drill.regions}
                    wrong={wrong}
                    lastWrong={lastWrong}
                    found={reveal?.bugLines ?? []}
                    disabled={phase !== "hunt" || busy}
                    onPick={guess}
                  />
                </section>
                {error && phase === "hunt" && <p className="error" role="alert">{error}</p>}
              </>
            )}
          </div>

          <div className={`rail ${phase === "hunt" ? "rail-live" : ""}`}>
            {(phase === "setup" || phase === "planting") && <HowItWorks active={phase === "setup" ? 0 : 1} />}
            {phase === "hunt" && (
              <HuntPanel
                startedAt={startedAt}
                penalty={penalty}
                temperature={temp}
                lastWrong={lastWrong}
                wrongGuesses={wrong.length}
                hint={hint}
                busy={busy}
                onHint={askHint}
                onGiveUp={giveUp}
              />
            )}
            {phase === "reveal" && result && (
              <ResultCard
                found={result.found}
                seconds={result.seconds}
                penalty={penalty}
                wrongGuesses={wrong.length}
                usedHint={hint !== null}
                error={error}
                onAgain={() => source && plant(source, usedLines)}
                onNew={newCode}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
