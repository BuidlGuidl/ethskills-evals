#!/usr/bin/env bash
# One-shot local setup: fund the dev accounts, deploy the jar, seed a few tips.
# Expects a local chain already running (npm run chain).

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_chain
require_forked_usdc

"$ROOT_DIR/scripts/fund.sh"
"$ROOT_DIR/scripts/deploy.sh"

if [ "${SEED:-1}" = "1" ]; then
  "$ROOT_DIR/scripts/seed.sh"
fi

log "Local setup complete. Start the frontend with: npm run web"
