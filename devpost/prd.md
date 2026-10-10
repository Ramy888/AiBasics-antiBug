---
doc: prd
status: draft
---

# antiBug: Product Requirements

A timed debugging drill for developers who build with AI agents: antiBug plants one realistic bug in code from your latest commit (or a pasted snippet), and you find it.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey
1. **Arrive.** The page explains the idea in one sentence and shows two ways in: *From GitHub* (default) and *Paste code*. The streak and best time are shown in the header (empty on first visit).
2. **Choose code.**
   - *From GitHub:* paste a public repo URL (`https://github.com/owner/repo` or `owner/repo`) and press **Load commits**. The 10 most recent commits on the default branch appear (message, short hash, age). Pick one.
   - *Paste code:* paste up to 300 lines of JS/TS and press **Sabotage it**.
3. **Plant.** A progress state shows "Reading your change…" → "Planting one bug…" → "Checking it still compiles…". antiBug picks the JS/TS file in that commit with the most added lines, and plants one logic bug inside the added lines. Typically takes 5–20 s.
4. **Hunt.** The changed code is shown with line numbers: the commit's changed regions with 3 lines of context, or the whole pasted snippet. One line is now broken. A timer runs. The header says which file and commit this is.
5. **Guess.** Click the line you think is broken.
   - Wrong: the line shakes red, +10 s penalty, and a temperature hint appears (*hot* within 3 lines, *warm* within 10, otherwise *cold*).
   - Right: go to reveal.
   - **Hint** shows the bug's category (e.g. "comparison operator") for +15 s. **Give up** reveals the answer and resets the streak.
6. **Reveal.** The broken line is highlighted with the original and sabotaged versions side by side, followed by a two-line lesson (what changed, why it would bite), the final time (clock + penalties), the number of wrong guesses, and the updated streak and best time.
7. **Again.** **Drill again** plants a *different* bug in the same commit. **New code** goes back to step 2.

Success: the user found the bug, and saw exactly what they would have shipped.

## Screens and Layout
One page with three states that replace each other in the main panel; the header stays put.
- **Header:** the antiBug wordmark, streak 🔥 N, and best time.
- **Setup state:** tabs for *From GitHub* / *Paste code*, the input, then the commit list or textarea.
- **Hunt state:** the file path and commit, a large timer, Hint and Give up buttons, and the code panel (full width, line numbers, clickable lines).
- **Reveal state:** a before/after line pair, the lesson, a stats row, and the Drill again / New code buttons.

Works on desktop first (the demo surface). On a phone it must not break, but phone layout isn't polished.

## Look and Feel
*Assumption, pending Ramy's confirmation:*
- A dark code-editor aesthetic: near-black background, slightly lighter panels.
- Monospace code (JetBrains Mono) and a clean sans-serif UI font (Inter).
- One alarm accent (red/amber) for "bug" and "wrong"; green only for "found".
- Dense, calm, no gradients or glassmorphism, no stock AI-app purple.
- Copy is terse and slightly playful: "Sabotage planted. Find it." / "Colder." / "Got it, 38 s."
- References: GitHub's diff view (readable code), plus the tension of a countdown game.

## Features and Behavior

### Loading code from GitHub
- As an AI-assisted developer, I want to pick a recent commit from my public repo so that the drill uses code I just shipped.
  - [ ] Pasting `owner/repo` or a full GitHub URL lists up to 10 recent commits, newest first.
  - [ ] Picking a commit starts planting. Only JS/TS files (`.js .jsx .ts .tsx .mjs .cjs`, not `.d.ts`, minified, or lock files) with at least 3 added lines are eligible.
  - [ ] The drilled file is the eligible file with the most added lines, and its path is shown during the hunt.

### Pasting code
- As a developer without a public repo, I want to paste a snippet so that I can still drill.
  - [ ] Up to 300 lines are accepted; more shows a clear limit message.
  - [ ] The whole snippet counts as "changed lines".

### Planting the bug
- As a user, I want one realistic, subtle logic bug so that finding it takes reading, not luck.
  - [ ] The bug sits on a line that was added in the commit (or anywhere in a pasted snippet).
  - [ ] The sabotaged code still parses as valid JS/TS.
  - [ ] It changes behaviour, not formatting or comments. Examples: an off-by-one, a flipped comparison, a wrong boolean, swapped arguments, a missing `await`, a wrong default.
  - [ ] Only 1–3 lines differ from the original.
  - [ ] *Drill again* never repeats the previous bug's line in the same session.

### The hunt
- As a user, I want to find the bug against the clock so that review feels like a skill I can improve.
  - [ ] The timer starts when the code appears.
  - [ ] A wrong click adds 10 s and shows hot/warm/cold.
  - [ ] Hint adds 15 s and shows the category.
  - [ ] Inspecting the page or its network traffic before the reveal does not expose the answer.

### The reveal
- As a user, I want to see what I'd have shipped and why it matters so that the lesson sticks.
  - [ ] The original and sabotaged lines are shown together, with the changed part emphasised.
  - [ ] A lesson of at most two sentences explains the effect.
  - [ ] The final time = clock + penalties.

### Streak and best time
- [ ] The streak counts consecutive found drills. Giving up resets it to 0.
- [ ] The best time is the fastest found drill.
- [ ] Both survive a page reload in the same browser.

## States and Boundaries
- **First visit:** streak 0, best time "—", and a one-line explainer.
- **Repo not found or private:** "Can't see that repo. Is it public?" Stay on setup.
- **No eligible JS/TS change in the commit:** "No JavaScript/TypeScript changes here. Pick another commit."
- **GitHub rate limit hit:** explain it, and suggest *Paste code*.
- **Planting fails** (no convincing bug after retries): "Couldn't plant a convincing bug in this change. Try another commit." Nothing is charged to the streak.
- **Large files:** only the changed regions are shown and drilled. Files over 2,000 lines are skipped.
- **Too many drills too fast:** "Easy, tiger. Try again in a few minutes." (This protects the public demo's API budget.)
- **Persistence:** only the streak and best time (in the browser). Nothing about the code is stored.

## Product Decisions
- **Name: antiBug.** Ramy's choice.
- **Kernel: drill on your own fresh commit.** Ramy chose this idea after the two-model debate. It's the novelty that survived the competitor search.
- **Input: public GitHub commit or pasted code; JS/TS only.** From the architecture sketch Ramy accepted ("ok").
- **The answer stays on the server until reveal.** From the same sketch.
- *Assumptions to confirm:* look and feel (above), the penalty values (+10 s wrong, +15 s hint), showing the changed regions rather than the whole file, and the hot/warm/cold thresholds.

## What We're Building
The full core journey above: GitHub commit and paste inputs, the plant-and-verify step, a timed hunt with hints, the reveal with lesson, and the streak and best time in the browser. A basic per-visitor rate limit.

## Deferred From the POC
- **Private repos:** needs GitHub OAuth. Out because public repos prove the kernel.
- **Accounts and leaderboards:** need auth and a database. The streak lives in the browser.
- **Other languages:** each needs its own syntax check. JS/TS covers the demo.
- **Drilling a whole PR or several files:** one file keeps the drill short and fair.

## Possible Later Enhancements
A CLI or git hook that drills you after each commit. Difficulty levels. An AI "judge" pass that rejects bugs that are too easy. Sharing a drill link with a teammate. Stats over time.

## Non-Goals
- **Running the user's code or tests:** no sandbox. The syntax check and the AI's explanation are enough.
- **Fixing bugs or reviewing code for real issues:** antiBug trains the human; it isn't a linter.
- **Storing anyone's code:** fetched code is used for one drill and not kept.

## Open Questions
- Look and feel confirmation: needed before `4-spec` is approved (affects Design).
- The penalty values and display choices above can be changed later without affecting the spec.
