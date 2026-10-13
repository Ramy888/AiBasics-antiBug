# antiBug

**Your agent wrote it. Did you read it?**

antiBug is a debugging drill on code you just shipped. Point it at a commit in a public GitHub repo (or paste a snippet), and it plants one realistic logic bug in the lines that commit added. The code still compiles. You race the clock to click the broken line, then see exactly what would have shipped and why it would bite.

Built for developers who work with AI coding agents and merge code they only skimmed. Every new commit is a fresh 90-second review drill.

**Demo video:** https://youtu.be/BZV3YR1HF_M · **Live:** https://antibug.ramy-comm.workers.dev

## How it works

1. **Pick code.** A recent commit from a public repo, up to 300 pasted lines of JS/TS, or **Try a sample** for a one-click drill on a built-in file.
2. **Plant.** Claude (Opus 5.5) proposes one subtle bug in the changed lines as strict JSON. A plain-code checker rejects anything that isn't a real bug: it must sit on an added line, change 1–3 lines, change runtime behaviour (not whitespace, comments or types), and the file must still parse. Rejected bugs go back to Claude with the reason, up to 3 attempts.
3. **Hunt.** The answer is sealed in an AES-256-GCM token that only the server can open, so it isn't visible in the browser's dev tools. Wrong clicks cost 10 s and tell you hot / warm / cold; a hint names the bug's category for 15 s.
4. **Reveal.** Your line next to the planted one, a two-sentence lesson, your time, and a streak kept in your browser.

No database and no accounts. The code you drill is used for one request and never stored.

## Run it locally

Requires Node 20+ and an Anthropic API key.

```bash
npm install
cp .env.example .env      # then set ANTHROPIC_API_KEY
npm run dev               # http://localhost:3000
```

## Deploy (Cloudflare Workers)

Live at **https://antibug.ramy-comm.workers.dev**. It runs on Workers through [OpenNext](https://opennext.js.org/cloudflare); the per-visitor drill limit is a Durable Object, so it holds across every server copy.

```bash
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ANTIBUG_SECRET    # any long random string: openssl rand -hex 32
npx wrangler secret put GITHUB_TOKEN      # recommended: Cloudflare's shared IPs hit GitHub's anonymous limit
npm run deploy
```

If your Cloudflare login can see several accounts, set `CLOUDFLARE_ACCOUNT_ID` first. `npm run deploy` builds from a copy of the repo without `.env` files, so local secrets never end up in the uploaded bundle. The drill limit is `ANTIBUG_DRILLS_PER_HOUR` in `wrangler.jsonc` (10).

## Tests

```bash
npm test                  # unit + route tests; Claude is mocked, no API spend
npm run test:live         # one real planting call (a few cents)
node scripts/verify-hunt.mjs http://localhost:3000   # headless browser run of the full hunt (real API)
```

## Stack

Next.js (App Router) + TypeScript on Cloudflare Workers (OpenNext, one Durable Object for the drill limit), `@anthropic-ai/sdk` with structured outputs, zod, the TypeScript compiler API as the parse check, Node `crypto`, Vitest.

## How it was planned

Built with the Devpost Learn skill pack: the scope, PRD, technical spec and build checklist are in [`devpost/`](devpost/).

## License

MIT — see [LICENSE](LICENSE).
