import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  // No incremental cache: every page and API route is either static or rendered per request.
  ...defineCloudflareConfig({}),
  // Webpack, not Turbopack: Turbopack renames the external `typescript` import (lib/validate.ts
  // uses it at runtime) to a hashed alias that the Cloudflare bundler can't resolve.
  buildCommand: "npx next build --webpack",
};

export default config;
