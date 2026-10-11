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
  hint: string | null;
  busy: boolean;
  onHint: () => void;
  onGiveUp: () => void;
};

export function HuntPanel({ startedAt, penalty, temperature, lastWrong, hint, busy, onHint, onGiveUp }: Props) {
  return (
    <div className="hunt">
      <Timer startedAt={startedAt} stoppedAt={null} penalty={penalty} />
      <div className="hunt-mid">
        <div className="callout">Sabotage planted. Find it.</div>
        <div className={`feedback ${temperature ?? ""}`} aria-live="polite">
          {temperature && lastWrong !== null ? `Not line ${lastWrong}. ${FEEDBACK[temperature]}` : "Click the line you think is broken. Wrong clicks cost 10s."}
        </div>
      </div>
      <div className="row">
        {hint ? (
          <span className="chip">{CATEGORY_LABEL[hint] ?? hint}</span>
        ) : (
          <button className="btn" onClick={onHint} disabled={busy}>
            Hint <span className="hint-text">+15s</span>
          </button>
        )}
        <button className="btn" onClick={onGiveUp} disabled={busy}>
          Give up
        </button>
      </div>
    </div>
  );
}
