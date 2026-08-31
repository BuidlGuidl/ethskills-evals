#!/usr/bin/env bash
# Stand the whole system up on a local anvil.
#
#   anvil            # in another terminal
#   ./scripts/deploy-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
# anvil account 0 — the DAO deployer. Override for a real chain.
DAO_PRIVATE_KEY="${DAO_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

if [ ! -d circuits/vote/target ] || [ ! -f circuits/vote/target/vk ]; then
  echo "==> building circuits first"
  ./scripts/build-circuits.sh
fi

echo "==> forge build"
forge build -q || { forge build; exit 1; }

echo "==> deploying to $RPC_URL"
DAO_PRIVATE_KEY="$DAO_PRIVATE_KEY" forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" --broadcast --skip-simulation -vv

echo
echo "==> deployment written to deployments/"
cat deployments/*.json
