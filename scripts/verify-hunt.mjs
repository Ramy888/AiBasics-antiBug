// Headless check of the hunt loop against a running dev server (real Claude: ~2 drills).
// Usage: node scripts/verify-hunt.mjs [baseUrl]
import { readFileSync } from "node:fs";
import { launch, sleep } from "./demo/cdp.mjs";

const base = process.argv[2] ?? "http://localhost:3001";
const code = readFileSync(new URL("../tests/fixtures/cart.ts", import.meta.url), "utf8");
const b = await launch({ width: 1280, height: 900, port: 9351 });
const q = (js) => b.evaluate(js);
const waitFor = async (js, ms = 90_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) if (await q(js)) return;
  throw new Error("timed out waiting for: " + js);
};
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); if (!ok) process.exitCode = 1; };
const timerText = () => q(`document.querySelector('.timer')?.childNodes[0]?.textContent`);
const toSec = (t) => { const [m, s] = t.split(":"); return Number(m) * 60 + Number(s); };
const lineCount = () => q(`document.querySelectorAll('.line').length`);
const clickLine = (n) => q(`document.querySelector('[aria-label="Line ${n}"]').click()`);

try {
  await b.goto(base, 3000);
  // A first-time visitor with no code to hand: one click to a drill on the built-in sample.
  await b.click("Try a sample");
  await waitFor(`!!document.querySelector('.timer')`);
  const shown = await q(`[...document.querySelectorAll('.line .txt')].map((e) => e.textContent).join("\\n")`);
  check(shown.split("\n").length === code.trimEnd().split("\n").length && (await q(`document.querySelector('.code-card').textContent.includes('cart.ts')`)), "Try a sample drills cart.ts in one click");
  const huntStart = Date.now();

  const t1 = toSec(await timerText()); await sleep(1500); const t2 = toSec(await timerText());
  check(t2 > t1 + 1, `timer ticks (${t1}s → ${t2}s)`);

  // Find a wrong line: click from the top until we get temperature feedback rather than the reveal.
  let penalty = 0, n = 1;
  for (; n <= (await lineCount()); n++) {
    await clickLine(n);
    // Wait for the server's answer (slower against a deployed URL than on localhost).
    await waitFor(`!!document.querySelector('.reveal') || document.querySelector('.feedback')?.textContent.startsWith('Not line ${n}.')`, 15_000);
    if (await q(`!!document.querySelector('.reveal')`)) break;
    penalty += 10;
    const fb = await q(`document.querySelector('.feedback').textContent`);
    const pen = await q(`document.querySelector('.penalty')?.textContent`);
    check(/^Not line \d+\. (Hot|Warm|Cold)/.test(fb) && pen === `+${penalty}s`, `wrong click on line ${n}: "${fb}" ${pen}`);
    if (penalty === 10) {
      await b.click("Hint", { gone: true });
      await waitFor(`!!document.querySelector('.hunt .chip')`, 15_000);
      penalty += 15;
      const chip = await q(`document.querySelector('.hunt .chip')?.textContent`);
      check(!!chip && (await q(`document.querySelector('.penalty').textContent`)) === `+${penalty}s`, `hint shows "${chip}" and adds 15s`);
    }
  }
  const clock = (Date.now() - huntStart) / 1000;
  await waitFor(`!!document.querySelector('.reveal')`);
  const final = toSec(await q(`document.querySelector('.stat b').textContent`));
  const shownPen = await q(`document.querySelectorAll('.stat b')[1].textContent`);
  check(Math.abs(final - (clock + penalty)) < 2, `final time ${final}s ≈ clock ${clock.toFixed(1)}s + penalties ${penalty}s; shown ${shownPen}`);
  // The sidebar's record, as "N streak, best M:SS.S" (or "best —").
  const header = () => q(`(() => { const s = document.querySelector('.sidebar .stats').dataset; const b = s.best === "" ? "—" : (() => { const v = Number(s.best); return Math.floor(v / 60) + ":" + (v % 60).toFixed(1).padStart(4, "0"); })(); return s.streak + " streak, best " + b; })()`);
  check((await header()).includes("1 streak"), `found drill bumps the streak: "${await header()}"`);
  const firstBug = await q(`document.querySelector('.reveal .hint-text').textContent`);
  console.log("first bug:", firstBug);
  await b.shot(new URL("./reveal.png", import.meta.url).pathname);

  await b.click("Drill again");
  await waitFor(`!!document.querySelector('.timer')`);
  check((await q(`document.querySelector('.penalty')`)) === null, "drill again resets penalties");
  // Line 1 is a type declaration, so it's never the planted (runtime) bug: a guaranteed wrong click.
  await clickLine(1);
  await waitFor(`document.querySelector('.feedback')?.textContent.startsWith('Not line 1.')`, 15_000);
  await b.click("Give up");
  await waitFor(`!!document.querySelector('.reveal')`);
  const tags = await q(`[...document.querySelectorAll('.diff-row .tag')].map((e) => e.textContent).join(",")`);
  check(tags.startsWith("original,planted"), `reveal labels the original and planted lines: ${tags}`);
  const wrongTag = await q(`document.querySelector('.line.wrong .line-tag')?.textContent`);
  const bugTag = await q(`document.querySelector('.line.found .line-tag')?.textContent`);
  check(wrongTag === "your click" && bugTag === "planted bug", `code marks your click and the bug: "${wrongTag}", "${bugTag}"`);
  const missedStats = await q(`[...document.querySelectorAll('.stat span')].map((e) => e.textContent).join(",")`);
  check(!missedStats.includes("penalties") && !missedStats.includes("final time"), `missed result skips time and penalties: ${missedStats}`);
  const secondBug = await q(`document.querySelector('.reveal .hint-text').textContent`);
  check(secondBug !== firstBug, `drill again plants elsewhere (${firstBug} → ${secondBug})`);
  check((await q(`document.querySelector('.reveal h2').textContent`)).startsWith("Here's what"), "give up shows the missed reveal");
  check((await header()).includes("0 streak"), `give up resets the streak: "${await header()}"`);

  await b.goto(base, 3000);
  const after = await header();
  check(after.includes("0 streak") && after.includes(`best ${final < 60 ? "0:" : ""}`) && !after.includes("—"), `streak and best survive a reload: "${after}"`);
  await b.shot(new URL("./setup.png", import.meta.url).pathname);
} finally {
  b.close();
}
