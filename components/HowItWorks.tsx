const STEPS = [
  { title: "Pick code", text: "A commit your agent just wrote, or a pasted snippet." },
  { title: "We plant one bug", text: "A realistic logic slip in the changed lines. It still compiles." },
  { title: "Find the line", text: "Against the clock. A wrong click costs 10s, a hint 15s." },
];

/** The rail's explainer on setup and while planting; `active` highlights the current step. */
export function HowItWorks({ active }: { active: number }) {
  return (
    <section className="card how" aria-label="How it works">
      <h2 className="card-title">How it works</h2>
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.title} className={i === active ? "on" : i < active ? "done" : ""}>
            <span className="how-n mono">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
