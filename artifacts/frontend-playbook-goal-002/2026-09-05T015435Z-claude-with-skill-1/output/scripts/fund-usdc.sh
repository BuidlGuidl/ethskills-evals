#!/usr/bin/env bash
#
# Top up a local address with USDC (and a little ETH for gas) on the Base fork.
#
#   yarn fund                       # 1000 USDC to Anvil account #0
#   yarn fund 0xYourAddress         # 1000 USDC to that address
#   yarn fund 0xYourAddress 25      # 25 USDC to that address
#
# Nothing here touches Base itself: the fork is a local copy, so impersonating a
# real USDC holder and moving its balance around only affects this Anvil node.

set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
USDC="${USDC_ADDRESS:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"
# Aave v3 Base aUSDC reserve, one of the largest USDC holders on Base.
WHALE="${USDC_WHALE:-0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB}"
# Anvil account #0.
RECIPIENT="${1:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
AMOUNT_USDC="${2:-1000}"

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "No chain at $RPC_URL. Start the fork first with 'yarn fork'." >&2
  exit 1
fi

CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
if [ "$CHAIN_ID" != "31337" ]; then
  echo "Refusing to run against chain $CHAIN_ID; this script is only for the local fork (31337)." >&2
  exit 1
fi

if [ "$(cast code "$USDC" --rpc-url "$RPC_URL")" = "0x" ]; then
  echo "No USDC contract at $USDC. Is the node forking Base? Use 'yarn fork'." >&2
  exit 1
fi

# USDC has 6 decimals, so "mwei" is the right unit multiplier here.
AMOUNT=$(cast to-wei "$AMOUNT_USDC" mwei)

# Gas money for the recipient, so a fresh burner wallet can send transactions.
if [ "$(cast balance "$RECIPIENT" --rpc-url "$RPC_URL")" = "0" ]; then
  cast rpc anvil_setBalance "$RECIPIENT" "$(cast to-hex "$(cast to-wei 10 ether)")" --rpc-url "$RPC_URL" >/dev/null
  echo "Funded $RECIPIENT with 10 ETH for gas"
fi

WHALE_BALANCE=$(cast call "$USDC" "balanceOf(address)(uint256)" "$WHALE" --rpc-url "$RPC_URL" | awk '{print $1}')

if ((WHALE_BALANCE >= AMOUNT)); then
  # Move real USDC from a real holder instead of minting a fake token.
  cast rpc anvil_impersonateAccount "$WHALE" --rpc-url "$RPC_URL" >/dev/null
  cast rpc anvil_setBalance "$WHALE" "$(cast to-hex "$(cast to-wei 1 ether)")" --rpc-url "$RPC_URL" >/dev/null
  cast send "$USDC" "transfer(address,uint256)" "$RECIPIENT" "$AMOUNT" \
    --from "$WHALE" --unlocked --rpc-url "$RPC_URL" >/dev/null
  cast rpc anvil_stopImpersonatingAccount "$WHALE" --rpc-url "$RPC_URL" >/dev/null
  SOURCE="transferred from $WHALE"
else
  # No holder big enough at this block: write the balance slot directly instead.
  # USDC (FiatTokenV2_2) keeps `balanceAndBlacklistStates` in storage slot 9.
  SLOT=$(cast index address "$RECIPIENT" 9)
  CURRENT=$(cast to-dec "$(cast storage "$USDC" "$SLOT" --rpc-url "$RPC_URL")")
  cast rpc anvil_setStorageAt "$USDC" "$SLOT" \
    "$(cast to-uint256 "$((CURRENT + AMOUNT))")" --rpc-url "$RPC_URL" >/dev/null
  SOURCE="written directly into USDC storage (whale balance too low)"
fi

NEW_BALANCE=$(cast call "$USDC" "balanceOf(address)(uint256)" "$RECIPIENT" --rpc-url "$RPC_URL" | awk '{print $1}')
echo "Sent $AMOUNT_USDC USDC to $RECIPIENT ($SOURCE)"
echo "New USDC balance: $(cast to-unit "$NEW_BALANCE" mwei)"
