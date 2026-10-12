import type { Drill } from "@/lib/history";
import type { Streak } from "@/lib/streak";
import { Logo } from "./Logo";
import { formatTime } from "./Timer";

const basename = (path: string) => path.split("/").pop() || path;

export function Sidebar({ streak, history }: { streak: Streak; history: Drill[] }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="wordmark">
          <Logo />
          <span>
            anti<b>Bug</b>
          </span>
        </div>
        <p className="brand-sub">Review drills for AI-written code</p>
      </div>

      <div className="stats" aria-label="Your record in this browser" data-streak={streak.streak} data-best={streak.best ?? ""}>
        <div className="tile" title="Bugs found in a row">
          <span className="tile-label">Streak</span>
          <strong className="tile-value">{streak.streak}</strong>
        </div>
        <div className="tile" title="Fastest find, including penalties">
          <span className="tile-label">Best</span>
          <strong className="tile-value">{streak.best === null ? "—" : formatTime(streak.best)}</strong>
        </div>
      </div>

      <nav className="history" aria-label="Recent drills">
        <h2 className="side-title">Recent drills</h2>
        {history.length === 0 ? (
          <p className="side-empty">Your drills show up here, with your time.</p>
        ) : (
          <ul>
            {history.map((d) => (
              <li key={d.at} className={d.found ? "found" : "missed"} title={d.file}>
                <span className="dot" aria-hidden="true" />
                <span className="history-file mono">{basename(d.file)}</span>
                <span className="history-time mono">{d.found && d.seconds !== null ? formatTime(d.seconds) : "missed"}</span>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <p className="side-foot">Kept in this browser only. No account.</p>
    </aside>
  );
}
