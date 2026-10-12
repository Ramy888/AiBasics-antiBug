#!/usr/bin/env bash
# Deploys antiBug to Cloudflare Workers from a copy of the repo that has no .env files.
# OpenNext bakes any .env it finds into the uploaded bundle; the real values belong in
# Workers secrets (`npx wrangler secret put ANTHROPIC_API_KEY`, and so on).
set -euo pipefail

root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Tracked and new files only; .gitignore keeps out .env, node_modules and build output.
git -C "$root" ls-files -z --cached --others --exclude-standard | rsync -a --from0 --files-from=- "$root/" "$tmp/"
cd "$tmp"
npm ci --no-audit --no-fund

# Next 16.4 loads .next/server/preview-props.json, which @opennextjs/cloudflare 1.20.10 doesn't
# inline, so every dynamic route 500s. Same one-line fix as the unmerged upstream PR
# https://github.com/opennextjs/opennextjs-cloudflare/pull/1356 ; drop this once a release has it.
patch="node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js"
grep -q "required-server-files,prefetch-hints}.json" "$patch" || {
  echo "The preview-props patch no longer applies: check whether @opennextjs/cloudflare fixed it, then remove this step." >&2
  exit 1
}
sed -i.orig 's/required-server-files,prefetch-hints}.json/required-server-files,prefetch-hints,preview-props}.json/' "$patch"
npx opennextjs-cloudflare build # webpack build, see open-next.config.ts

if grep -q "ANTHROPIC_API_KEY" .open-next/cloudflare/next-env.mjs; then
  echo "Refusing to deploy: an env file made it into the build." >&2
  exit 1
fi
npx opennextjs-cloudflare deploy "$@"
