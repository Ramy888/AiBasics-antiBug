// Cloudflare entry point: OpenNext's generated Next.js handler plus the drill-limit Durable Object.
// `.open-next/worker.js` exists only after `opennextjs-cloudflare build`, so tsc skips this file.
import handler from "./.open-next/worker.js";

export { DrillLimiter } from "./lib/drill-limiter";

const worker = { fetch: handler.fetch };

export default worker;
