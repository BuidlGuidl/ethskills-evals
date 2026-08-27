#!/usr/bin/env bash
# Deploy the whole system to a local chain and record the addresses.
#
#   anvil                     # in another terminal
#   ./scripts/deploy.sh
#
# Env:
#   RPC_URL         default http://127.0.0.1:8545
#   PRIVATE_KEY     default anvil account #0 (the DAO admin)
#   MEMBERSHIP_NFT  optional: address of an existing ERC-721 to reuse instead
#                   of deploying the stand-in MembershipNFT
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
# Well-known anvil account #0. Fine for a local chain, obviously not anywhere else.
PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

if [ ! -f "$ROOT/contracts/src/verifier/HonkVerifier.sol" ]; then
  echo "No verifier contract. Run ./scripts/build-circuit.sh first." >&2
  exit 1
fi

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "No chain at $RPC_URL. Start one with:  anvil" >&2
  exit 1
fi

cd "$ROOT/contracts"
mkdir -p deployments
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  -vv
