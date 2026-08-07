#!/usr/bin/env bash
#
# Fund an address with test USDC on the local Base fork.
#
# On a fork there are no USDC balances for fresh wallets, so this uses Anvil's
# `anvil_setStorageAt` to write directly into USDC's `balances` mapping (storage
# slot 9 of the FiatToken implementation). It does NOT change total supply — it's
# only meant for local testing against the fork.
#
# Usage:
#   ./scripts-js/fund-usdc.sh <address> [amount_in_usdc]
#
# Examples:
#   ./scripts-js/fund-usdc.sh 0xYourWalletAddress            # gives 1000 USDC
#   ./scripts-js/fund-usdc.sh 0xYourWalletAddress 50         # gives 50 USDC
#
set -euo pipefail

ADDRESS="${1:-}"
AMOUNT_USDC="${2:-1000}"
RPC="${RPC_URL:-http://127.0.0.1:8545}"
USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
BALANCES_SLOT=9

if [ -z "$ADDRESS" ]; then
  echo "Usage: $0 <address> [amount_in_usdc]" >&2
  exit 1
fi

# USDC has 6 decimals. Convert to smallest units and to a 32-byte hex value.
AMOUNT_UNITS=$(cast to-wei "$AMOUNT_USDC" mwei) # mwei = 1e6, matches USDC decimals
VALUE_HEX=$(cast to-uint256 "$AMOUNT_UNITS")
KEY=$(cast index address "$ADDRESS" "$BALANCES_SLOT")

cast rpc anvil_setStorageAt "$USDC" "$KEY" "$VALUE_HEX" --rpc-url "$RPC" >/dev/null

NEW_BAL=$(cast call "$USDC" "balanceOf(address)(uint256)" "$ADDRESS" --rpc-url "$RPC")
echo "Funded $ADDRESS with $AMOUNT_USDC USDC (raw balanceOf = $NEW_BAL)"
