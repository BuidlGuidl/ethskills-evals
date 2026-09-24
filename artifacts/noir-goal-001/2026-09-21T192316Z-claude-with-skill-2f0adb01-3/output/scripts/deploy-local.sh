#!/usr/bin/env bash
# Deploy HonkVerifier + MembershipNFT + AnonymousVoting (with PoseidonT3/LeanIMT
# linked) to RPC_URL and write deployments/<chainId>.json.
#   PRIVATE_KEY      deployer (default: anvil account 0)
#   MIN_ANONYMITY_SET (default 100; the demo uses a smaller value)
#   MEMBERSHIP_NFT   use an existing NFT instead of deploying MembershipNFT
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
export PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

[ -f "$ROOT/circuits/vote/target/vote.json" ] || bash "$ROOT/scripts/build-circuit.sh"
mkdir -p "$ROOT/deployments"
cd "$ROOT/contracts"
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast -q
cat "$ROOT/deployments/$(cast chain-id --rpc-url "$RPC_URL").json"; echo
