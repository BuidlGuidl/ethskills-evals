#!/usr/bin/env bash
# Deploy the full system to a local anvil and write deployments/31337.json.
#
#   anvil                    # in another terminal
#   ./scripts/deploy-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "no chain at $RPC_URL — start one with: anvil" >&2
  exit 1
fi

forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast -vv
