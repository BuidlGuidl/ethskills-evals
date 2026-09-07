#!/usr/bin/env bash
# Hands real USDC to a local account on an `npm run chain:fork` chain.
#
# USDC is a FiatToken: its masterMinter can authorise a minter, and that minter can mint.
# Anvil lets us impersonate the masterMinter, so we borrow that authority locally.
# This only works against a fork — the impersonation is a local-node trick.
#
#   ./scripts/fund-usdc.sh [recipient] [amount-in-usdc]
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
USDC="${USDC_ADDRESS:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"
RECIPIENT="${1:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8}"
HUMAN_AMOUNT="${2:-10000}"
AMOUNT="$(cast from-fixed-point 6 "$HUMAN_AMOUNT")"

if [ "$(cast code "$USDC" --rpc-url "$RPC_URL")" = "0x" ]; then
  echo "No contract at $USDC on $RPC_URL." >&2
  echo "This script needs a forked chain: npm run chain:fork" >&2
  exit 1
fi

MASTER_MINTER="$(cast call "$USDC" 'masterMinter()(address)' --rpc-url "$RPC_URL")"
echo "Borrowing minting rights from masterMinter $MASTER_MINTER ..."

cast rpc anvil_impersonateAccount "$MASTER_MINTER" --rpc-url "$RPC_URL" > /dev/null
cast rpc anvil_setBalance "$MASTER_MINTER" 0xde0b6b3a7640000 --rpc-url "$RPC_URL" > /dev/null
cast send "$USDC" 'configureMinter(address,uint256)' "$RECIPIENT" "$AMOUNT" \
  --from "$MASTER_MINTER" --unlocked --rpc-url "$RPC_URL" > /dev/null
cast rpc anvil_stopImpersonatingAccount "$MASTER_MINTER" --rpc-url "$RPC_URL" > /dev/null

# The recipient is now an authorised minter, and anvil already has it unlocked.
cast send "$USDC" 'mint(address,uint256)' "$RECIPIENT" "$AMOUNT" \
  --from "$RECIPIENT" --unlocked --rpc-url "$RPC_URL" > /dev/null

BALANCE="$(cast call "$USDC" 'balanceOf(address)(uint256)' "$RECIPIENT" --rpc-url "$RPC_URL")"
echo "$RECIPIENT now holds $(cast to-fixed-point 6 "${BALANCE%% *}") USDC"
