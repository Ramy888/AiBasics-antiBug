---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (Ramy asked to "proceed building auto"; pauses only at the hands-on checkpoints below)

## Slices

- [x] **1. Paste code, get one planted bug, click the broken line, see the reveal**
  Becomes usable: A running app where you paste JS/TS, press Sabotage it, see the sabotaged code with line numbers, click a line, and get right/wrong plus the original-vs-sabotaged reveal and lesson. No GitHub, timer, or streak yet.
  Why now: This is the unique kernel and the biggest risk (Claude must reliably plant a subtle bug that passes the checker, and the structured-output + fallback call shape must work). Bootstrapping the Next.js app lives here so everything later has somewhere to land.
  PRD ref: `prd.md > Pasting code`, `prd.md > Planting the bug`, `prd.md > The reveal`, `prd.md > The Core Journey` (steps 3, 5, 6)
  Spec ref: `spec.md > Stack`, `spec.md > Saboteur`, `spec.md > Checker`, `spec.md > Answer Seal`, `spec.md > API Routes`, `spec.md > File Structure`, `spec.md > Look and Feel`
  Build: Scaffold Next.js (App Router, TypeScript) and merge it into the existing repo without losing `.gitignore` rules; add `lib/validate.ts`, `lib/seal.ts`, `lib/saboteur.ts`, `lib/errors.ts`; add `drill` (paste mode), `guess`, `reveal` routes; a bare page with paste box, `CodeView`, and `RevealPanel` using the spec's colours and fonts; Vitest unit tests for the checker and seal.
  Verify (mechanical): `npm test` passes (checker accepts a valid mutation and rejects whitespace-only, comment-only, unparseable, wrong-line, and >3-line changes; seal round-trips and rejects tampered/expired tokens); `npm run build` succeeds; one real Claude call via a script plants a bug in a sample file that passes the checker; `curl` against the dev server returns a token whose body contains no answer text, and `guess`/`reveal` respond correctly for the right line.
  Learner check: Run `npm run dev`, open http://localhost:3000, paste a 30–80 line function you wrote recently, press Sabotage it, hunt for the bug, and say whether it felt subtle enough to be worth finding.
  Commit: `Plant and reveal one bug in pasted code`

- [x] **2. Drill a recent commit from a public GitHub repo**
  Becomes usable: Enter `owner/repo` or a GitHub URL, see the 10 latest commits, pick one, and drill the JS/TS file with the most added lines, shown as changed regions with 3 lines of context and real line numbers.
  Why now: This is the "your own fresh commit" half of the kernel and depends on slice 1's plant/check/seal pipeline. GitHub's API shape and the patch parsing are the next risk.
  PRD ref: `prd.md > Loading code from GitHub`, `prd.md > States and Boundaries`, `prd.md > The Core Journey` (steps 2, 4)
  Spec ref: `spec.md > GitHub Reader`, `spec.md > Target Picker`, `spec.md > API Routes`, `spec.md > External Services and Dependencies`
  Build: Add `lib/github.ts`, `lib/target.ts`, the `commits` route, GitHub mode in `drill`; add `SetupPanel` tabs (From GitHub / Paste code) and the commit list; render display regions in `CodeView`; map 404, rate-limit, and no-eligible-file errors to the PRD's messages; Vitest tests for `parsePatch`, `isEligible`, `pickTarget`, `displayRegions`.
  Verify (mechanical): `npm test` passes including target-picker tests on a real captured patch; `curl /api/commits` with a known public repo returns 10 commits; `curl /api/drill` on a known JS/TS commit returns regions whose line numbers match the file at that SHA and whose bug line is an added line; a nonexistent repo returns the "not found or private" error.
  Learner check: Paste one of your public repos (or `vercel/next.js`), pick a recent commit, and confirm the code shown is really from that commit and the planted bug sits in lines that commit added.
  Commit: `Drill a recent commit from a public GitHub repo`

- [ ] **3. The hunt becomes a game: timer, penalties, hints, give up, drill again**
  Becomes usable: A running timer from the moment code appears; a wrong click shakes red, adds 10 s and shows hot/warm/cold; Hint shows the category for +15 s; Give up reveals; the reveal shows final time and wrong guesses; Drill again plants a different bug in the same code.
  Why now: The kernel works end to end; this turns it into the timed drill the PRD describes. It's pure client state plus the `hint` route and `avoidLines`, so it's low risk once slices 1–2 hold.
  PRD ref: `prd.md > The hunt`, `prd.md > The reveal`, `prd.md > The Core Journey` (steps 5–7), `prd.md > Planting the bug` (no repeat line)
  Spec ref: `spec.md > Drill Page`, `spec.md > API Routes`, `spec.md > Checker` (avoidLines), `spec.md > Look and Feel` (motion)
  Build: Add `Timer`, `HuntPanel`, `PlantingProgress` (three-step message, cancel, 60 s timeout); the `hint` route; temperature in `guess`; penalties and wrong-guess count in the page state machine; Drill again / New code actions passing the session `avoidLines`.
  Verify (mechanical): `npm test` passes, including route tests (Claude mocked) for `guess` temperatures at distances 0/2/7/20, `hint`, and `drill` rejecting a bug on an avoided line; `npm run build` succeeds; a headless browser run of the paste flow shows the timer ticking, a wrong click adding 10 s, and the reveal's final time equal to clock + penalties.
  Learner check: Do two drills on the same code: make one deliberate wrong click and use Hint once, then press Drill again and confirm the second bug is on a different line.
  Commit: `Add timer, penalties, hints, give up, and drill again`

- [ ] **4. Streak, best time, rate limit, and the finished look**
  Becomes usable: The header shows a streak and best time that survive a reload; Give up resets the streak; too many drills shows "Easy, tiger."; the page has the full dark editor look, first-visit explainer, and a README and `.env.example` someone else can run from.
  Why now: These are the polish and protection layers around a working game; none of them changes the core loop, so they come last before the final review.
  PRD ref: `prd.md > Streak and best time`, `prd.md > States and Boundaries`, `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Streak Store`, `spec.md > Rate Limiter`, `spec.md > Look and Feel`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Add `lib/streak.ts` and `Header`; `lib/ratelimit.ts` wired into `drill`; first-visit explainer and empty states; a look-and-feel pass over every state against the spec; README (what it is, setup, run) and `.env.example`.
  Verify (mechanical): `npm test` passes, including streak (found/give-up/blocked storage) and rate-limit (11th drill in an hour rejected) tests; `npm run build` and `npm run lint` succeed; a headless browser run confirms streak and best persist across reload and screenshots of setup, hunt, and reveal match the spec's colours and fonts.
  Learner check: Win two drills, give up on a third, reload the page, and confirm the header shows streak 0 and your best time; then look over every screen and say what you'd change about how it looks.
  Commit: `Add streak, best time, rate limit, and final styling`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1: Ramy pastes his own code and judges whether the planted bugs are subtle enough (this can still reshape the prompt before GitHub mode is built)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- Early checkpoint feedback (Ramy, invoiceForm.mjs): the bug (`<` → `<=`, line 37) was too hard to find in 58 lines without a hint; the reveal rendered above the code and went unseen; ligatures drew `>=` as `≥`; long lines were cut off. Fixed now: ligatures off, long lines wrap, page scrolls to the reveal, clearer line hover, and the prompt anchors each bug to something visible nearby. Difficulty is addressed further by slice 3's hot/warm/cold and Hint, and slice 2's changed-regions-only view.
- Second checkpoint drill was also too hard (off-by-one inside a milestone-split arithmetic expression, 6 wrong guesses). The saboteur prompt now targets a ~1-minute find: single-token changes readable from the line and its neighbours, no multi-line arithmetic tracing. PRD `Planting the bug` gained a matching difficulty criterion.
- Live runs showed Claude plants the same "best" bug every time for a given file. Each drill now gets a random category hint plus a random third of the eligible lines as a hard limit for the first two attempts (the checker enforces it; the last attempt uses the full set). Three live plants on invoiceForm.mjs then gave three different bugs.
- The checker also requires `mutated` to keep the same number of lines as `original`, and compares comment-free transpiled output to reject type-only edits — the spec didn't fix line counts, but stable line numbers are what make click-to-guess work.
- Live Claude verification lives in `npm run test:live` (tests/live, real API spend) and stays out of `npm test` — the spec's tests are mocked; a deliberate opt-in keeps routine runs free.
