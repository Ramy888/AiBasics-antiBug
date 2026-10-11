"use client";

import { useEffect, useState } from "react";

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

/** Clock time since `startedAt` plus penalty seconds; frozen at `stoppedAt` once the drill ends. */
export function Timer({ startedAt, stoppedAt, penalty }: { startedAt: number; stoppedAt: number | null; penalty: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stoppedAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [stoppedAt]);
  const seconds = ((stoppedAt ?? now) - startedAt) / 1000 + penalty;
  return (
    <div className="timer mono" role="timer" aria-label="Time including penalties">
      {formatTime(Math.max(0, seconds))}
      {penalty > 0 && <span className="penalty">+{penalty}s</span>}
    </div>
  );
}
