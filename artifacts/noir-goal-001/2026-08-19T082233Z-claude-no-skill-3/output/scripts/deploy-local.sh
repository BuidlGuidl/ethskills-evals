#!/usr/bin/env bash
# Deploys the whole system to a local chain and wires it together.
#   1. anvil                         (in another terminal)
#   2. ./scripts/deploy-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL=${RPC_URL:-http://127.0.0.1:8545}
# anvil account #0
DEPLOYER_KEY=${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "no chain at $RPC_URL - start one with:  anvil" >&2
  exit 1
fi

mkdir -p deployments
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast \
  -vv

echo
echo "addresses written to deployments/$(cast chain-id --rpc-url "$RPC_URL").json"
