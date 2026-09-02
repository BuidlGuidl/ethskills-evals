#!/usr/bin/env bash
# One command, whole system: start anvil, deploy, walk one proposal end to end.
#
#   ./scripts/e2e-local.sh
#
# Leaves nothing running behind it.
set -euo pipefail
cd "$(dirname "$0")/.."

# A parent yarn Plug'n'Play install exports NODE_OPTIONS=--require .../.pnp.cjs,
# which hijacks module resolution and hides this project's node_modules.
case "${NODE_OPTIONS:-}" in *pnp*) unset NODE_OPTIONS ;; esac

PORT="${PORT:-8545}"
export RPC_URL="http://127.0.0.1:${PORT}"

if [ ! -f circuits/vote/target/vk ] || [ ! -f circuits/register/target/vk ]; then
  ./scripts/build-circuits.sh
fi
[ -d node_modules ] || npm install

echo "==> starting anvil on :${PORT}"
anvil --port "$PORT" --silent &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break
  sleep 0.25
done

# Fresh chain means the old member secrets are meaningless.
rm -rf .secrets

./scripts/deploy-local.sh >/dev/null
echo "==> deployed:"
sed 's/^/    /' deployments/31337.json

node js/demo.js
