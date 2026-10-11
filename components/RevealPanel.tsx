"use client";

import { CATEGORY_LABEL } from "@/lib/labels";

export type Reveal = { bugLines: number[]; original: string; mutated: string; category: string; lesson: string };

/** Split a line into [same prefix, changed middle, same suffix] against the other version. */
function highlight(line: string, other: string) {
  let p = 0;
  while (p < line.length && p < other.length && line[p] === other[p]) p++;
  let s = 0;
  while (s < line.length - p && s < other.length - p && line[line.length - 1 - s] === other[other.length - 1 - s]) s++;
  return (
    <>
      {line.slice(0, p)}
      <mark>{line.slice(p, line.length - s)}</mark>
      {line.slice(line.length - s)}
    </>
  );
}

type Props = { reveal: Reveal; found: boolean; wrongGuesses: number; onNew: () => void };

export function RevealPanel({ reveal, found, wrongGuesses, onNew }: Props) {
  const before = reveal.original.split("\n");
  const after = reveal.mutated.split("\n");
  const rows = before
    .map((b, i) => ({ b, a: after[i] ?? "" }))
    .filter(({ b, a }) => b.trimEnd() !== a.trimEnd());

  return (
    <section className="panel reveal">
      <h2 className={found ? "found" : "missed"}>{found ? "Got it." : "Here's what slipped through."}</h2>
      <div className="row">
        <span className="chip">{CATEGORY_LABEL[reveal.category] ?? reveal.category}</span>
        <span className="hint-text">
          line {reveal.bugLines.join(", ")} · {wrongGuesses} wrong {wrongGuesses === 1 ? "guess" : "guesses"}
        </span>
      </div>
      <div className="diff">
        {rows.map(({ b, a }, i) => (
          <div key={i}>
            <div className="diff-row before"><span className="tag">yours</span><span>{highlight(b, a)}</span></div>
            <div className="diff-row after"><span className="tag">planted</span><span>{highlight(a, b)}</span></div>
          </div>
        ))}
      </div>
      <p className="lesson">{reveal.lesson}</p>
      <div className="row">
        <button className="btn btn-primary" onClick={onNew}>New code</button>
      </div>
    </section>
  );
}
