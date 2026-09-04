#!/usr/bin/env bash
set -euo pipefail

: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"

forge create src/EscrowFactory.sol:EscrowFactory \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
