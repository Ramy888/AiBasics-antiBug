---
doc: scope
status: approved
---

# antiBug

A debugging drill on code your AI wrote today: antiBug plants one realistic bug in your latest commit, and you race to find it.

## The Unique Kernel
The drill runs on **your own code, from today's commit**, not on strangers' practice snippets. AI plants a subtle *logic* bug, meaning the code still compiles but now behaves wrongly, in the lines your agent just wrote. You must find it by reading, the way a real review should catch it. Quiz sites and bug-hunt games (e.g. Planet of the Bugs) use generic code. Mutation-testing tools (e.g. Stryker) plant bugs to grade test suites, not humans. antiBug turns every commit into a 90-second review drill.

## Who It's For
A developer who builds with an AI coding agent (Claude Code, Codex, Cursor) and merges code they skimmed. Example: a hackathon builder at hour 3, who has just committed a "scoring" feature the agent wrote, and who could not say what line 42 does. Today they review AI output by rerunning the app and hoping, or not at all.

## The Core Loop
Open antiBug → paste a public GitHub repo and pick a recent commit (or paste a snippet) → a bug is planted in the changed lines → hunt with a timer running and click the line you think is broken → see the original vs. the sabotaged line, a two-line lesson, and your time. They come back because every new commit is a fresh drill, and a streak tracks how sharp their reviews are.

## Inspiration & Identity
A code-review tool with the tension of a timed game: dark, editor-like, monospace code, one alarm-colour accent for "bug". Terse, slightly playful copy ("Sabotage planted. Find it."). *(Agent-proposed; Ramy accepted it without changes.)*
Research context: Anthropic's Jan 2026 study of AI assistance and coding skills (https://www.anthropic.com/research/AI-assistance-coding-skills). It measured comprehension of a new library, not real-world debugging, so cite it with care.

## Why This Matters to the Learner
Ramy builds most of his code with AI agents. The risk he lives with is shipping AI code he never fully read. antiBug is the habit the Devpost Learn pack teaches (plan, then *review* what the AI builds), turned into a tool he would use himself.

## What "Working" Looks Like
In the local app: paste the antiBug repo's own URL and pick the commit from earlier today. A bug is planted in seconds, the timer runs, one wrong click shows "colder", the next click is right. The reveal highlights the flipped `>=`, with the lesson and a time of about 40 s.
**The "oh, that's cool" beat:** the app sabotages the code that was used to build it, and the builder has to catch it on camera.

## The POC Boundary
- One drill flow: a GitHub public repo + commit picker, **or** pasted code.
- JS/TS only. The planted bug must still parse, so a syntax check can verify it.
- One bug per drill, planted in the commit's changed lines.
- Timer, click-to-guess with a warmer/colder hint, reveal with lesson, streak and best time kept in the browser.
- The answer is kept away from the browser until reveal.

## Later
Python and other languages; drilling a whole pull request; a CLI or git hook ("drill me on every commit"); team leaderboards; difficulty levels; a second AI "judge" pass that rates bug quality.

## Explicitly Cut
- **Accounts and login:** not needed to prove the kernel. The streak lives in the browser.
- **Private repos / GitHub OAuth:** adds auth complexity. Public repos and pasted code cover the demo.
- **Multiple bugs per drill:** dilutes the lesson and makes the timer unfair.
- **Running the user's code or tests:** a sandbox is a project of its own. The syntax check plus the AI's explanation are enough for a proof of concept.
