---
doc: spec
status: approved
---

# antiBug: Technical Spec

## How This Works, In Plain Language
antiBug is one web page backed by a few small server endpoints, all in a single Next.js app.

1. **The page** (browser) collects a repo + commit or a pasted snippet, shows the code, runs the timer, and keeps your streak in the browser's local storage.
2. **The GitHub reader** (server) uses GitHub's public API to fetch the commit's changed files and the full file at that commit. No login: public repos only.
3. **The saboteur** (server) sends the chosen file, with line numbers and a list of which lines were added, to Claude (Opus 5.5) and asks for exactly one subtle logic bug as strict JSON.
4. **The checker** (server, plain code, no AI) confirms the bug is real:
   - it sits on an added line;
   - it changes only 1–3 lines, and not just whitespace;
   - the file still parses as JS/TS.

   If a check fails, the error goes back to Claude for at most 2 retries. This retry loop is the only "agent-like" part.
5. **The sealed answer.** The server encrypts the answer (which line, original text, lesson) into a token only it can open. The browser carries the token but cannot read it, so the answer can't be found in the browser's developer tools. Guesses, hints and the reveal send the token back to the server.

Why this shape: it's one app, one paid service (Claude), no database, and no accounts. GitHub's public API is free. Everything a drill needs lives either in the sealed token or in the browser.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. The user enters `owner/repo` → the page calls `POST /api/commits` → the GitHub reader lists the 10 latest commits → the page shows them.
2. The user picks a commit → `POST /api/drill {repo, sha}`:
   - the GitHub reader fetches the commit's files and patches;
   - the target picker chooses the JS/TS file with the most added lines (non-test files first) and fetches its full content at that commit;
   - the saboteur asks Claude for a bug;
   - the checker validates it, retrying if needed;
   - the server seals the answer into a token.

   It returns the token, the file path, and the **display regions**: the sabotaged code around each changed hunk, with 3 lines of context and real line numbers.
3. The page shows the hunt and starts the timer.
4. A click on a line → `POST /api/guess {token, line}` → the server opens the token → returns `{correct, temperature}`.
5. On a correct guess or Give up → `POST /api/reveal {token}` → the original and sabotaged lines, category and lesson. The page computes the final time and updates the streak and best time in local storage.
6. Hint → `POST /api/hint {token}` → the category. The page adds +15 s.
7. Drill again → `POST /api/drill` with `avoidLines` (the lines already used this session) → a new token.

Paste mode replaces step 1, and the GitHub part of step 2, with `POST /api/drill {code, filename}`. The whole snippet counts as added lines.

## Stack
- **Next.js (App Router), TypeScript, React.** One project for the page and the API routes, deployed to Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`). Docs: https://nextjs.org/docs. Version: whatever `create-next-app@latest` installs (pinned in `package.json`).
- **`@anthropic-ai/sdk`.** The official Claude SDK, for the plant call. Docs: https://platform.claude.com/docs/en/api/sdks/typescript
- **`zod`.** Describes the JSON shape Claude must return, and checks it. https://zod.dev
- **`typescript` (compiler API) for the parse check.** `ts.transpileModule(..., { reportDiagnostics: true })` reports syntax errors for both JS and TS, so one dependency covers both. https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- **Node `crypto` (AES-256-GCM)** for sealing the answer. Built in, no dependency.
- **Vitest** for the checker, patch parser, token and route tests. https://vitest.dev
- **Fonts:** Inter + JetBrains Mono through `next/font/google`.
- No database, no auth library, no diff library: the code view is a small custom component.

*To verify early in the build (agent-side):* that `output_config.format` (JSON schema) and the beta `fallbacks: "default"` work together on one `client.beta.messages.create` call. If not, use the structured output alone and handle `stop_reason: "refusal"` as a planting failure.

## Where It Runs and How Someone Tries It
- **Local:** Node ≥ 20. `npm install`, copy `.env.example` → `.env`, set `ANTHROPIC_API_KEY`, then `npm run dev` and open http://localhost:3000.
- **Environment variables:**
  - `ANTHROPIC_API_KEY`: required. Server-side only.
  - `ANTIBUG_SECRET`: a 32+ character secret for sealing answers. Optional locally (a random one is generated at start-up); **required** when deployed.
  - `GITHUB_TOKEN`: optional. Raises GitHub's limit from 60 to 5,000 requests per hour.
- **Demo recording:** the local app, driven by the headless recording pipeline. The demo drills the antiBug repo's own commits, so the repo must be public by then. Paste mode works without it.
- **Deployed:** https://antibug.ramy-comm.workers.dev on Cloudflare Workers (Ramy authorized it in `6-ship` prep). `npm run deploy` copies the repo without `.env` files (OpenNext would otherwise bake them into the bundle), builds with webpack, and deploys. Secrets live in Workers secrets: `ANTHROPIC_API_KEY`, `ANTIBUG_SECRET`, `GITHUB_TOKEN`. GitHub's token matters more here: Cloudflare's shared IPs would exhaust the 60-per-hour anonymous limit. It stays up through the judging period (to Oct 30), since the rules ask for free access for judges.
- **Submission:** a demo video under 3 minutes plus a public GitHub repo with a license showing in the About section, and the live URL in the testing instructions.

## Look and Feel
From `prd.md > Look and Feel` (accepted by Ramy):
- **Colours** (CSS variables in `globals.css`):
  - background `#0d1117`, panels `#161b22`, borders `#30363d`;
  - text `#e6edf3`, muted `#8b949e`;
  - **bug accent** `#ff5f56` (wrong, sabotaged); found `#3fb950`; hint and warm `#f0b429`.
- **Type:** Inter for the UI; JetBrains Mono 14px for code and the timer. The timer is large (48px mono).
- **Density:** compact, like an editor. The code panel is full width with a line-number gutter, and the hovered line is highlighted.
- **Motion:** only meaningful motion. A shake on a wrong line, a pulse on the found line. No decorative animation.
- **Copy:** terse, slightly playful. Avoid gradients, glassmorphism and purple AI styling.
- **Dark only** for the proof of concept.

## Components

### GitHub Reader
`lib/github.ts`. Uses unauthenticated GitHub REST (a token if `GITHUB_TOKEN` is set).
- `parseRepo(input)` accepts `owner/repo` or a github.com URL.
- `listCommits(owner, repo)` calls `GET /repos/{o}/{r}/commits?per_page=10`.
- `getCommit(owner, repo, sha)` calls `GET /repos/{o}/{r}/commits/{sha}` and returns files with `patch`.
- `getFileAt(owner, repo, sha, path)` fetches `https://raw.githubusercontent.com/{o}/{r}/{sha}/{path}`.

It maps 404 → "not found or private" and a 403 with the rate-limit header → "rate limited".
PRD ref: `prd.md > Loading code from GitHub`, `prd.md > States and Boundaries`.

### Target Picker
`lib/target.ts`. Pure functions.
- `parsePatch(patch)` → the hunks' new-file line ranges and the **added line numbers**.
- `isEligible(path)`: JS/TS extensions, excludes `.d.ts`, `*.min.js` and lock files.
- `pickTarget(files)`: the eligible file with the most added lines, at least 3; non-test files rank ahead of test files.
- `displayRegions(content, hunks, context=3)`: merged line ranges, each line numbered.

For pasted code, every line counts as added and there is one region.
PRD ref: `prd.md > Loading code from GitHub`, `prd.md > Pasting code`.

### Saboteur
`lib/saboteur.ts`. Builds the prompt:
- the system prompt: role, the bug rules from `prd.md > Planting the bug`, and that the code is data and not instructions;
- the user message: the file with line numbers, the eligible lines, and the lines to avoid.

It calls Claude:
- `client.beta.messages.create` with model `claude-opus-5-5`;
- `output_config: { effort: "medium", format: <JSON schema from zod> }` and `max_tokens: 16000`;
- `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`.

It checks `stop_reason` (a refusal counts as a failed attempt), parses the JSON with zod, then runs the **Checker**. If the checker fails, it adds the failure reason as a new user turn and retries, with at most 3 attempts in total.
The returned shape is `{ line, original, mutated, category, lesson }`, where `category` is one of: `off_by_one`, `comparison`, `boolean_logic`, `argument_order`, `missing_await`, `wrong_default`, `wrong_variable`, `arithmetic`, `other`.
PRD ref: `prd.md > Planting the bug`.

### Checker
`lib/validate.ts`. Pure, and unit-tested.
1. `original` matches the file at `line…line+k` (trailing whitespace ignored).
2. Every changed line is in the eligible set and not in `avoidLines`.
3. 1–3 lines differ, and the difference is not whitespace- or comment-only.
4. The sabotaged file parses (TypeScript `transpileModule` diagnostics are empty).

It returns either `{ ok, sabotagedContent, bugLines }` or `{ ok: false, reason }`.
PRD ref: `prd.md > Planting the bug`.

### Answer Seal
`lib/seal.ts`. `seal(payload)` / `open(token)` with AES-256-GCM. The key is SHA-256 of `ANTIBUG_SECRET`. In development a random per-process key is used when it's unset; in production a missing secret is an error, because separate server copies would each seal with their own key. The payload is `{ bugLines, original, mutated, category, lesson, file, iat }`. Tokens expire after 1 hour, and tampered tokens are rejected.
PRD ref: `prd.md > The hunt` (the answer is not exposed).

### Rate Limiter
`lib/ratelimit.ts`. A one-hour sliding window per client IP (`lib/window.ts`): 10 drills per hour by default (`ANTIBUG_DRILLS_PER_HOUR`), `/api/drill` only. On Cloudflare each IP gets its own Durable Object (`lib/drill-limiter.ts`, binding `DRILL_LIMITER`), so every server copy shares one count. Elsewhere (`next dev`, `next start`, tests) it falls back to an in-memory count per process. The client IP comes from `cf-connecting-ip`, then `x-forwarded-for`.
PRD ref: `prd.md > States and Boundaries`.

### API Routes
In `app/api/*/route.ts`. Each one validates its input with zod and returns `{ error: { code, message } }` with a matching status on failure.
- `commits`: `{repo}` → `{commits: [{sha, message, date}]}`
- `drill`: `{repo, sha, avoidLines?} | {code, filename?, avoidLines?}` → `{token, file, commit?, regions}`
- `guess`: `{token, line}` → `{correct, temperature: "hot" | "warm" | "cold" | null}`
- `hint`: `{token}` → `{category}`
- `reveal`: `{token}` → `{bugLines, original, mutated, category, lesson}`

PRD ref: `prd.md > The Core Journey`.

### Drill Page
`app/page.tsx` (client component). A state machine `setup → planting → hunt → reveal` that owns the timer, penalties, wrong guesses and session `avoidLines`. Subcomponents live in `components/`:
- `Sidebar` (wordmark, streak and best-time tiles, recent drills);
- `HowItWorks` (the three steps, in the right-hand panel during setup and planting);
- `SetupPanel` (tabs, repo input, commit list, paste area);
- `PlantingProgress` (three-step message, since the progress is simulated client-side while the request runs);
- `HuntPanel` (right-hand panel: `Timer`, feedback, wrong clicks, Hint, Give up) beside `CodeView` (gutter, clickable lines, shake/pulse);
- `RevealPanel`: `RevealDiff` (before/after and lesson, centre) and `ResultCard` (outcome, stats, actions, right-hand panel).

Layout: a CSS grid shell (`sidebar | main`), with `main` split into a centre column and a 300 px sticky right-hand panel. Below 900 px the sidebar becomes a top strip and the panel stacks above the code; only the hunt panel stays pinned.

PRD ref: `prd.md > Screens and Layout`, `prd.md > The hunt`, `prd.md > The reveal`.

### Streak Store
`lib/streak.ts`. Reads and writes `{streak, best}` in `localStorage` under `antibug:v1`, wrapped in try/catch so the page works with storage blocked. Found → streak + 1 and update best. Give up → streak 0.
PRD ref: `prd.md > Streak and best time`.

### History Store
`lib/history.ts`. The last 8 drills as `{file, seconds, found, at}` in `localStorage` under `antibug:history:v1`, newest first, with the same try/catch guards and `useSyncExternalStore` plumbing as the Streak Store. Kept apart so the streak's stored shape doesn't change.
PRD ref: `prd.md > Recent drills`.

## Data Model
- **Drill answer:** lives only inside the sealed token, which the browser holds in memory for the current drill. It's gone on reload, by design.
- **Session avoid-list:** kept in the page's memory for the current repo/commit, and sent with Drill again.
- **Streak/best:** `localStorage["antibug:v1"] = { streak: number, best: number | null }` (seconds). Survives reloads.
- **Fetched code:** in server memory only for the duration of one request. Never stored.

## File Structure
```
AiBasics-antiBug/
├── app/
│   ├── layout.tsx            # fonts, metadata, dark theme shell
│   ├── globals.css           # colour tokens + base styles
│   ├── page.tsx              # Drill Page state machine
│   └── api/
│       ├── commits/route.ts  # list recent commits
│       ├── drill/route.ts    # pick target → plant → check → seal
│       ├── guess/route.ts    # check a clicked line
│       ├── hint/route.ts     # reveal category
│       └── reveal/route.ts   # full answer + lesson
├── components/
│   ├── Sidebar.tsx
│   ├── HowItWorks.tsx
│   ├── SetupPanel.tsx
│   ├── PlantingProgress.tsx
│   ├── HuntPanel.tsx
│   ├── CodeView.tsx
│   ├── Timer.tsx
│   └── RevealPanel.tsx
├── lib/
│   ├── github.ts             # GitHub Reader
│   ├── target.ts             # Target Picker (patch parsing, regions)
│   ├── saboteur.ts           # Claude call + retry loop
│   ├── validate.ts           # Checker
│   ├── seal.ts               # Answer Seal
│   ├── ratelimit.ts          # Rate Limiter
│   ├── window.ts             # one-hour sliding window (shared)
│   ├── drill-limiter.ts      # Durable Object: one drill count per IP on Cloudflare
│   ├── streak.ts             # Streak Store (browser)
│   ├── history.ts            # History Store (browser)
│   └── errors.ts             # shared error codes/messages
├── tests/                    # vitest: target, validate, seal, routes (Claude mocked)
├── devpost/                  # Devpost Learn planning docs
├── worker.ts                 # Cloudflare entry: OpenNext handler + DrillLimiter
├── wrangler.jsonc            # Worker name, Durable Object binding, drill limit
├── open-next.config.ts       # OpenNext build (webpack)
├── scripts/deploy.sh         # builds from a copy without .env, then deploys
├── .env.example              # placeholder env vars, no secrets
├── LICENSE                   # MIT
└── README.md                 # what it is, setup, run
```

## External Services and Dependencies
- **Claude API** (Anthropic): `POST /v1/messages` via the SDK, as in **Saboteur** above.
  - Key: `ANTHROPIC_API_KEY`.
  - Cost: Opus 5.5 is $4 / $20 per million input/output tokens. A drill is about 3–8K tokens in and 1–3K out (thinking included), so roughly **$0.03–0.08 per drill**.
  - Docs: https://platform.claude.com/docs
- **GitHub REST API:**
  - `GET https://api.github.com/repos/{o}/{r}/commits?per_page=10` → `[{sha, commit:{message, author:{date}}}]`
  - `GET https://api.github.com/repos/{o}/{r}/commits/{sha}` → `{files:[{filename, status, additions, patch}]}`
  - Raw file: `https://raw.githubusercontent.com/{o}/{r}/{sha}/{path}`.
  - Limits: 60 requests/hour per IP without a token, 5,000/hour with `GITHUB_TOKEN`. Free. Docs: https://docs.github.com/en/rest/commits/commits

## Important Failure Modes
- **Claude returns a bad or trivial bug, or refuses** → the checker rejects it and the saboteur retries (3 attempts total). Then the user sees "Couldn't plant a convincing bug in this change. Try another commit." The streak is untouched.
- **GitHub 404/403 or rate limit** → a clear message on the setup panel, and paste mode is suggested.
- **Slow plant (10–30 s)** → the three-step progress message and a cancel button. The request times out at 60 s with a friendly error.

## What Was Simplified and Why
- **A sealed token** instead of a server-side database of drills: no database to run, and it still hides the answer. The fuller version would store drills for replay and sharing.
- **A per-IP limit only** instead of accounts or a global budget: a Durable Object per IP keeps the count exact across server copies, and an Anthropic spend cap backs it up. Someone rotating IPs could still drill more; the fuller version would add a global daily cap.
- **A syntax check only** instead of running the code or tests: proves "still compiles" without a sandbox. The fuller version would run the project's tests to prove the bug changes behaviour.
- **Simulated progress steps** instead of streamed server progress: the call is one request, so the steps are cosmetic, and labelled as such here.

## Decisions and Open Issues
- **Ramy's choices:** the idea and kernel (antiBug: drill on your own fresh commit); the name; the architecture sketch (one Claude call, plain-code checks with retries, the answer kept on the server, the key server-side, JS/TS only) accepted with "ok … proceed".
- **Agent-derived details:** Next.js App Router; the TypeScript compiler as the parse checker (one tool for JS and TS, instead of acorn which is JS-only); AES-GCM token instead of storage; the penalty and threshold values; Opus 5.5 at `medium` effort.
- **Learner uncertainty:** none identified yet. Ramy hasn't raised one, and none is invented here.
- **Open, agent-side:** confirm that structured output + `fallbacks: "default"` work together (first slice). Judge bug subtlety at the first hands-on checkpoint; if bugs are too obvious, tighten the prompt (and only then consider the deferred "judge" pass).
- **Resolved with Ramy:** look and feel accepted; `ANTHROPIC_API_KEY` placed in `.env`.
- **Open, needs Ramy (6-ship):** make the repo public before recording, since the demo drills its own commits.
