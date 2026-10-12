// Headless check: after a commit can't be drilled, the commit list is still there to pick another.
// No Claude call (the commit has no JS/TS changes). Usage: node scripts/verify-commit-list.mjs [baseUrl]
import { launch, sleep } from "./demo/cdp.mjs";

const base = process.argv[2] ?? "http://localhost:3001";
const b = await launch({ width: 1280, height: 500, port: 9352 });
const q = (js) => b.evaluate(js);
const waitFor = async (js, ms = 30_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) if (await q(js)) return;
  throw new Error("timed out waiting for: " + js);
};
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); if (!ok) process.exitCode = 1; };

try {
  await b.goto(base, 3000);
  await q(`(() => { const i = document.querySelector('input[aria-label="Public GitHub repo"]'); i.focus(); })()`);
  await b.type("Ramy888/wesamAiAgent");
  await b.click("Load commits");
  await waitFor(`document.querySelectorAll('.commit').length > 0`);
  const before = await q(`document.querySelectorAll('.commit').length`);
  await q(`[...document.querySelectorAll('.commit')].find((c) => c.textContent.includes('623c0db')).click()`);
  await waitFor(`!!document.querySelector('.error')`);
  const err = await q(`document.querySelector('.error').textContent`);
  const after = await q(`document.querySelectorAll('.commit').length`);
  check(/No JavaScript\/TypeScript changes/.test(err), `error shown: "${err}"`);
  check(after === before, `commit list still shown (${before} → ${after})`);
  const onRow = await q(`!!document.querySelector('.commit-error')?.closest('li')?.textContent.includes('623c0db')`);
  check(onRow, "error sits on the commit that failed");
  const top = await q(`document.querySelector('.commit-error').getBoundingClientRect().top`);
  check(top > 0 && top < 500, `error is on screen (top ${Math.round(top)}px of 500)`);
} finally {
  await b.close();
}
