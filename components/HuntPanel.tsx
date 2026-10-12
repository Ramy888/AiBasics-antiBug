"use client";

import { CATEGORY_LABEL } from "@/lib/labels";
import type { Temperature } from "@/lib/shared";
import { Timer } from "./Timer";

const FEEDBACK: Record<Temperature, string> = {
  hot: "Hot. It's within 3 lines.",
  warm: "Warm. Within 10 lines.",
  cold: "Cold.",
};

type Props = {
  startedAt: number;
  penalty: number;
  temperature: Temperature | null;
  lastWrong: number | null;
  wrongGuesses: number;
  hint: string | null;
  busy: boolean;
  onHint: () => void;
  onGiveUp: () => void;
};

export function HuntPanel({ startedAt, penalty, temperature, lastWrong, wrongGuesses, hint, busy, onHint, onGiveUp }: Props) {
  return (
    <section className="card hunt" aria-label="Drill in progress">
      <div className="hunt-clock">
        <span className="card-title">Time</span>
        <Timer startedAt={startedAt} stoppedAt={null} penalty={penalty} />
      </div>
      <div className={`feedback ${temperature ?? ""}`} aria-live="polite">
        {temperature && lastWrong !== null ? (
          <>
            <strong>Not line {lastWrong}.</strong> {FEEDBACK[temperature]}
          </>
        ) : (
          <>
            <strong>Sabotage planted. Find it.</strong> Click the line you think is broken.
          </>
        )}
      </div>
      <dl className="hunt-meta">
        <div>
          <dt>Wrong clicks</dt>
          <dd className="mono">{wrongGuesses}</dd>
        </div>
        <div>
          <dt>Hint</dt>
          <dd>{hint ? <span className="chip">{CATEGORY_LABEL[hint] ?? hint}</span> : <span className="muted">not used</span>}</dd>
        </div>
      </dl>
      <div className="hunt-actions">
        {!hint && (
          <button className="btn" onClick={onHint} disabled={busy}>
            Hint <span className="btn-cost">+15s</span>
          </button>
        )}
        <button className="btn btn-quiet" onClick={onGiveUp} disabled={busy}>
          Give up
        </button>
      </div>
    </section>
  );
}
