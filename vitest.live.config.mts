import { defineConfig } from "vitest/config";

// Real Claude calls. Spends API budget; run deliberately with `npm run test:live`.
export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { include: ["tests/live/**/*.live.ts"], environment: "node", testTimeout: 180_000 },
});
