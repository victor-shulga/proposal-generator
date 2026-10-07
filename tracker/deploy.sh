#!/bin/sh
# Deploy the tracker: copy the page snippet next to the dashboard (served as /t.js), then wrangler deploy.
set -e
cd "$(dirname "$0")"
cp ../skills/proposal-generator/scripts/track.js public/t.js
npm_config_cache="$HOME/.npm-claude" npx --yes wrangler@latest deploy
