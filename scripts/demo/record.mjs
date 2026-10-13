// Records the demo video in headless Chrome (drawn pointer, no overlays): the core journey on the built-in sample.
// Needs a production server with this repo's .env (`npx next build && npx next start -p 3002`). One real drill per run.
// Run: node scripts/demo/record.mjs [baseUrl], then inside scripts/demo/out/:
// ffmpeg -f concat -safe 0 -i list.txt -vf "scale=1920:1200,format=yuv420p" -r 30 -c:v libx264 -crf 18 antibug-demo-silent.mp4
import { createDecipheriv, createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const base = process.argv[2] ?? "http://localhost:3002";
const DIR = new URL("./out/", import.meta.url).pathname;
rmSync(DIR, { recursive: true, force: true }); mkdirSync(DIR + "frames", { recursive: true });

// The recorder has to know where the bug is, so it opens the sealed token with the server's own secret (lib/seal.ts).
const secret = readFileSync(new URL("../../.env", import.meta.url), "utf8").match(/^ANTIBUG_SECRET=(.+)$/m)?.[1].trim();
if (!secret) throw new Error("ANTIBUG_SECRET missing from .env");
const unseal = (token) => {
  const buf = Buffer.from(token, "base64url");
  const d = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"));
};

const b = await launch({ scale: 4 / 3, port: 9352 });
const q = (js) => b.evaluate(js);
const waitFor = async (js, ms = 90_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) if (await q(js)) return;
  await b.shot(DIR + "fail.png");
  throw new Error("timed out waiting for: " + js);
};
const cues = [];
const cue = (text) => { cues.push({ at: b.mark(), text }); console.log(b.mark().toFixed(1), text); };
const rect = async (sel) => {
  const r = await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+Math.min(b.width/2,260),y:b.y+b.height/2}})()`);
  if (!r) { await b.shot(DIR + "fail.png"); throw new Error("missing " + sel); }
  return r;
};
const hover = async (sel) => b.moveTo(await rect(sel));
const into = async (sel) => { await q(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({behavior:'smooth',block:'center'})`); await sleep(900); };
const clickLine = async (n) => { const sel = `[aria-label="Line ${n}"]`; await into(sel); await b.clickAt(await rect(sel)); };

try {
  await b.goto(base, 4000);
  // Keep the drill's token for the recorder (the page itself never sees the answer).
  await q(`(()=>{const f=window.fetch;window.fetch=async(...a)=>{const r=await f(...a);if(String(a[0]).includes('/api/drill'))r.clone().json().then(j=>{window.__token=j.token});return r}})()`);
  await b.startRec();

  cue("Arrive: what antiBug is, two ways in, empty record");
  await sleep(2000); await hover(".wordmark"); await sleep(1500);
  await hover("main h1, main h2"); await sleep(2500);
  await b.moveTo(await b.find("From GitHub")); await sleep(2000);
  await b.click("Paste code"); await sleep(2500);

  cue("Try a sample: one click, no code needed");
  await b.click("Try a sample");
  await waitFor(`!!document.querySelector('.planting') || !!document.querySelector('.timer')`, 10_000);
  cue("Planting: Claude plants one bug and checks it still compiles");
  await sleep(5000);
  // Off camera while planting takes longer than a few seconds.
  if (!(await q(`!!document.querySelector('.timer')`))) { b.pause(); await waitFor(`!!document.querySelector('.timer')`); await sleep(300); await b.ensureCursor(); await b.resume(); }

  const token = await q(`window.__token`);
  const answer = unseal(token);
  const bug = answer.bugLines[0];
  const lines = await q(`document.querySelectorAll('.line').length`);
  console.log("bug on line", bug, "of", lines, "-", answer.category);

  cue("Hunt: one line is broken, the clock is running");
  await hover(".timer"); await sleep(2500);
  await hover(".code-card"); await sleep(3500);

  // A wrong guess near the bug, so the temperature reads hot.
  const wrong = bug - 2 >= 2 ? bug - 2 : bug + 2;
  cue("Wrong guess: +10 s and a temperature hint");
  await clickLine(wrong);
  await waitFor(`document.querySelector('.feedback')?.textContent.startsWith('Not line ${wrong}.')`, 15_000);
  await sleep(1000); await hover(".feedback"); await sleep(3500);

  cue("Hint: the bug's category for +15 s");
  await b.click("Hint", { gone: true });
  await waitFor(`!!document.querySelector('.hunt .chip')`, 15_000);
  await hover(".hunt .chip"); await sleep(4000);

  cue("Found it: click the broken line");
  await clickLine(bug);
  await waitFor(`!!document.querySelector('.reveal')`, 15_000);
  await sleep(1800);

  cue("Reveal: original and planted side by side, with the lesson");
  await hover(".reveal-diff"); await sleep(3500);
  await hover(".reveal .hint-text"); await sleep(4500);

  cue("Result: clock plus penalties, streak and best time");
  await into(".stat"); await hover(".stat"); await sleep(4000);
  await hover(".sidebar .stats"); await sleep(3000);

  cue("In the code: your click and the planted bug, labelled");
  await into(".line.found"); await hover(".line.found .line-tag"); await sleep(3500);
  await hover(".line.wrong .line-tag"); await sleep(3000);

  cue("Drill again plants a new bug; or bring your own commit");
  await into(".reveal"); await b.moveTo(await b.find("Drill again")); await sleep(4000);

  const { frames, end } = await b.stopRec();
  // frames -> constant 30 fps: each output slot shows the newest frame captured by then
  const FPS = 30, start = frames[0].t, slots = Math.ceil((end - start) * FPS);
  const list = []; let j = 0; const written = new Map();
  for (let s = 0; s < slots; s++) {
    const t = start + s / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
    if (!written.has(j)) { const name = `frames/${String(j).padStart(5, "0")}.jpg`; writeFileSync(DIR + name, Buffer.from(frames[j].data, "base64")); written.set(j, name); }
    list.push(`file '${written.get(j)}'`, `duration ${(1 / FPS).toFixed(6)}`);
  }
  list.push(list[list.length - 2]);
  writeFileSync(DIR + "list.txt", list.join("\n") + "\n");
  writeFileSync(DIR + "cues.json", JSON.stringify(cues.map((c) => ({ at: Math.max(0, c.at - start), text: c.text })), null, 1));
  console.log(`frames ${frames.length}, length ${(end - start).toFixed(1)} s`);
} finally {
  b.close();
}
