#!/usr/bin/env bash
# Deploy the whole system to a local chain and wire it together.
#
#   anvil                       # in another terminal
#   ./scripts/deploy-local.sh
#
# Addresses land in deployments/<chainid>.json, which the Node scripts read.
#
# Against a real network, set MEMBERSHIP_NFT to the DAO's existing NFT so no dev
# token is deployed, and point RPC_URL / DEPLOYER_KEY at the real deployer.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
# anvil's first account, funded by default. Override for anything real.
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "no chain at $RPC_URL - start one with \`anvil\`" >&2
  exit 1
fi

mkdir -p "$root/deployments"
cd "$root/contracts"

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast \
  --skip-simulation \
  "$@"

echo
echo "deployment written to deployments/$(cast chain-id --rpc-url "$RPC_URL").json"
