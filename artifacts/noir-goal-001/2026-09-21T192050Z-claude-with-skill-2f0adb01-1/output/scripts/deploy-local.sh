#!/usr/bin/env bash
# Deploy verifier + AnonVoting (+ a demo membership NFT) to a local chain.
#   anvil                       # in another terminal
#   bash scripts/deploy-local.sh
# Override RPC_URL / DEPLOYER_KEY / MEMBERSHIP_NFT / MIN_ANONYMITY_SET as needed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
# anvil account 0 — local only
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

mkdir -p "$ROOT/deployments"
cd "$ROOT/contracts"
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" --broadcast
