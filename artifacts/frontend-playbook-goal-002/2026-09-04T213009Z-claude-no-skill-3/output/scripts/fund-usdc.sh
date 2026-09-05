#!/usr/bin/env bash
# Gives a local account a USDC balance on the forked chain.
#
# Anvil's fork has the real USDC contract but nobody hands out test USDC, so we
# write the balance directly into the token's storage (anvil_setStorageAt). The
# balances mapping slot is discovered by trial: write to a candidate slot, then
# read balanceOf back and see whether it changed.
#
# Usage: ./scripts/fund-usdc.sh <address> [amount-in-usdc]   # default 10000
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
USDC_ADDRESS="${USDC_ADDRESS:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"

ACCOUNT="${1:-}"
HUMAN_AMOUNT="${2:-10000}"

if [[ -z "$ACCOUNT" ]]; then
  echo "usage: $0 <address> [amount-in-usdc]" >&2
  exit 1
fi

ACCOUNT="$(cast to-check-sum-address "$ACCOUNT")"
# USDC has 6 decimals, so "mwei" (1e6) is the right unit here.
AMOUNT="$(cast to-wei "$HUMAN_AMOUNT" mwei)"
VALUE="$(cast to-uint256 "$AMOUNT")"

# Probe with a value the account is very unlikely to already hold, so a slot
# only "matches" when our write is what moved balanceOf.
PROBE_AMOUNT=987654321987654321
PROBE="$(cast to-uint256 "$PROBE_AMOUNT")"

for SLOT in $(seq 0 20); do
  KEY="$(cast index address "$ACCOUNT" "$SLOT")"
  PREVIOUS="$(cast storage "$USDC_ADDRESS" "$KEY" --rpc-url "$RPC_URL")"

  cast rpc anvil_setStorageAt "$USDC_ADDRESS" "$KEY" "$PROBE" --rpc-url "$RPC_URL" > /dev/null
  BALANCE="$(cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$ACCOUNT" --rpc-url "$RPC_URL")"

  if [[ "${BALANCE%% *}" == "$PROBE_AMOUNT" ]]; then
    cast rpc anvil_setStorageAt "$USDC_ADDRESS" "$KEY" "$VALUE" --rpc-url "$RPC_URL" > /dev/null
    echo "Funded $ACCOUNT with $HUMAN_AMOUNT USDC (balances mapping at slot $SLOT)"
    exit 0
  fi

  # Wrong slot: put back whatever was there before moving on.
  cast rpc anvil_setStorageAt "$USDC_ADDRESS" "$KEY" "$PREVIOUS" --rpc-url "$RPC_URL" > /dev/null
done

echo "Could not locate the USDC balances slot; is $RPC_URL a Base fork?" >&2
exit 1
