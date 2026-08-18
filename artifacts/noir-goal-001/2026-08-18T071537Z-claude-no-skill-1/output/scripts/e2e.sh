#!/usr/bin/env bash
# Everything, from nothing, in one command:
#   starts a local chain -> deploys -> 150 members join -> a proposal ->
#   real proofs -> relayed ballots -> the tally.
#
#   ./scripts/e2e.sh
#
# Env: PORT (default 8545), MEMBER_COUNT (default 150), BALLOTS (default 5)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8545}"
export RPC_URL="http://127.0.0.1:${PORT}"

if [ ! -f "$ROOT/circuits/private_vote/target/private_vote.json" ]; then
  echo "==> circuit not compiled yet"
  "$ROOT/scripts/build-circuit.sh"
fi

# Compile before the chain starts, so the chain's uptime is spent on the demo.
(cd "$ROOT/contracts" && forge build >/dev/null)

echo "==> starting anvil on port $PORT"
anvil --port "$PORT" --silent &
ANVIL_PID=$!
# shellcheck disable=SC2064
trap "kill $ANVIL_PID 2>/dev/null || true" EXIT

for _ in $(seq 1 40); do
  if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then break; fi
  sleep 0.25
done
cast chain-id --rpc-url "$RPC_URL" >/dev/null

"$ROOT/scripts/deploy.sh"

# The harness this repo may be run under injects a Yarn PnP loader through
# NODE_OPTIONS, which hides this project's own node_modules. Drop it.
env -u NODE_OPTIONS node "$ROOT/scripts/demo.js"
