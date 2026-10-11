"use client";

import { useEffect, useState } from "react";

// The plant is a single request, so these steps are paced client-side, not streamed.
const STEPS = ["Reading your change…", "Planting one bug…", "Checking it still compiles…"];
const AT_MS = [0, 2500, 9000];

export function PlantingProgress({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = AT_MS.slice(1).map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="panel planting" aria-live="polite">
      {STEPS.map((label, i) => (
        <div key={label} className={`step ${i < step ? "done" : i === step ? "active" : ""}`}>
          <span className="dot" /> {label}
        </div>
      ))}
      <div>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
