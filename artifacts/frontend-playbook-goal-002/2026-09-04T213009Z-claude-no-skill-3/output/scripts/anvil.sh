#!/usr/bin/env bash
# Starts a local Anvil chain forked from Base, so the real USDC contract
# (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) exists locally.
#
# Usage: ./scripts/anvil.sh
set -euo pipefail

BASE_RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
PORT="${PORT:-8545}"
# Keep the fork on 31337 so wallets treat it as a separate local network
# instead of clashing with the real Base network entry.
CHAIN_ID="${CHAIN_ID:-31337}"

echo "Forking Base from $BASE_RPC_URL on http://127.0.0.1:$PORT (chainId $CHAIN_ID)"
exec anvil \
  --fork-url "$BASE_RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --port "$PORT" \
  --block-time "${BLOCK_TIME:-2}"
