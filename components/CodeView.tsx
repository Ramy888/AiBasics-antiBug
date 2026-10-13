"use client";

import type { Region } from "@/lib/shared";

type Props = {
  regions: Region[];
  wrong: number[];
  found: number[];
  lastWrong: number | null;
  disabled: boolean;
  /** After the reveal: name the marked lines, since red and green alone don't say whose they are. */
  labelled?: boolean;
  onPick: (line: number) => void;
};

export function CodeView({ regions, wrong, found, lastWrong, disabled, labelled = false, onPick }: Props) {
  return (
    <div className="code" role="list" aria-label="Sabotaged code. Click the broken line.">
      {regions.map((region, r) => (
        <div className="region" key={region.start}>
          {r > 0 && <div className="gap">⋯</div>}
          {region.lines.map((text, i) => {
            const n = region.start + i;
            const state = found.includes(n) ? "found" : n === lastWrong || wrong.includes(n) ? "wrong" : "";
            return (
              <button
                // Re-mount on each new wrong click so the shake replays.
                key={n === lastWrong ? `${n}-${wrong.length}` : n}
                className={`line ${state}`}
                disabled={disabled}
                onClick={() => onPick(n)}
                role="listitem"
                aria-label={`Line ${n}`}
              >
                <span className="num">{n}</span>
                <span className="txt">{text || " "}</span>
                {labelled && state && <span className="line-tag">{state === "found" ? "planted bug" : "your click"}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
