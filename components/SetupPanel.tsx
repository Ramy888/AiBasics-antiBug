"use client";

import { useState } from "react";

type Props = {
  initialCode: string;
  error: string | null;
  onPaste: (code: string, filename: string) => void;
};

export function SetupPanel({ initialCode, error, onPaste }: Props) {
  const [code, setCode] = useState(initialCode);
  const [filename, setFilename] = useState("");
  const lines = code ? code.split("\n").length : 0;

  return (
    <section className="panel">
      <p className="lede">
        <strong>Paste code your AI wrote.</strong> antiBug plants one subtle logic bug in it. Find the line before the clock beats you.
      </p>
      <textarea
        className="textarea"
        placeholder="// paste up to 300 lines of JavaScript or TypeScript"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        aria-label="Code to sabotage"
      />
      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="input mono"
          style={{ maxWidth: 260 }}
          placeholder="filename (optional), e.g. cart.ts"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          aria-label="Filename"
        />
        <span className="hint-text">{lines} / 300 lines</span>
        <span className="spacer" />
        <button className="btn btn-primary" disabled={!code.trim() || lines > 300} onClick={() => onPaste(code, filename.trim())}>
          Sabotage it
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
