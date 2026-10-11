import type { Streak } from "@/lib/streak";
import { formatTime } from "./Timer";

export function Header({ streak }: { streak: Streak }) {
  return (
    <header className="header">
      <div className="wordmark">
        anti<b>Bug</b>
      </div>
      <div className="stats" aria-label="Your record in this browser">
        <span title="Bugs found in a row">
          🔥 <strong>{streak.streak}</strong> streak
        </span>
        <span title="Fastest find, including penalties">
          best <strong>{streak.best === null ? "—" : formatTime(streak.best)}</strong>
        </span>
      </div>
    </header>
  );
}
