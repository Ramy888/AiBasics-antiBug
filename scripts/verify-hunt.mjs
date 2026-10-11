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
  await b.click("Paste code");
  await q(`(() => { const t = document.querySelector('textarea'); t.focus(); })()`);
  await b.type(code);
  await b.click("Sabotage it");
  await waitFor(`!!document.querySelector('.timer')`);
  const huntStart = Date.now();

  const t1 = toSec(await timerText()); await sleep(1500); const t2 = toSec(await timerText());
  check(t2 > t1 + 1, `timer ticks (${t1}s → ${t2}s)`);

  // Find a wrong line: click from the top until we get temperature feedback rather than the reveal.
  let penalty = 0, n = 1;
  for (; n <= (await lineCount()); n++) {
    await clickLine(n); await sleep(600);
    if (await q(`!!document.querySelector('.reveal')`)) break;
    penalty += 10;
    const fb = await q(`document.querySelector('.feedback').textContent`);
    const pen = await q(`document.querySelector('.penalty')?.textContent`);
    check(/^Not line \d+\. (Hot|Warm|Cold)/.test(fb) && pen === `+${penalty}s`, `wrong click on line ${n}: "${fb}" ${pen}`);
    if (penalty === 10) {
      await b.click("Hint", { gone: true }); await sleep(600);
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
  const firstBug = await q(`document.querySelector('.reveal .hint-text').textContent`);
  console.log("first bug:", firstBug);
  await b.shot(new URL("./reveal.png", import.meta.url).pathname);

  await b.click("Drill again");
  await waitFor(`!!document.querySelector('.timer')`);
  check((await q(`document.querySelector('.penalty')`)) === null, "drill again resets penalties");
  await b.click("Give up");
  await waitFor(`!!document.querySelector('.reveal')`);
  const secondBug = await q(`document.querySelector('.reveal .hint-text').textContent`);
  check(secondBug !== firstBug, `drill again plants elsewhere (${firstBug} → ${secondBug})`);
  check((await q(`document.querySelector('.reveal h2').textContent`)).startsWith("Here's what"), "give up shows the missed reveal");
} finally {
  b.close();
}
