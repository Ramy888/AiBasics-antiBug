import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare build output (opennextjs-cloudflare).
    ".open-next/**",
    ".wrangler/**",
    // Captured third-party code used as test data.
    "tests/fixtures/**",
    // Demo-recording driver copied from another project.
    "scripts/demo/cdp.mjs",
    // Devpost Learn skill pack files.
    ".agents/**",
    "agent/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
