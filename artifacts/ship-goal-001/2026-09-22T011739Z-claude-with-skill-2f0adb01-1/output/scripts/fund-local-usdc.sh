#!/usr/bin/env bash
# Give an address USDC on a local anvil fork, so you can try a loan without buying anything.
#
#   yarn fund:local 0xYourAddress [amount-in-usdc] [rpc-url]
#
# It writes the balance straight into USDC's storage via anvil_setStorageAt (finding the
# balances slot by probing, so it doesn't depend on Circle's storage layout staying put).
# Local forks only — this obviously does nothing on a real network.
set -euo pipefail

ADDRESS="${1:-}"
AMOUNT_USDC="${2:-1000}"
RPC_URL="${3:-${LOCAL_RPC_URL:-http://127.0.0.1:8545}}"
USDC="${USDC_ADDRESS:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}" # Base USDC

if [ -z "$ADDRESS" ]; then
  echo "usage: yarn fund:local <address> [amount-in-usdc] [rpc-url]" >&2
  exit 1
fi

CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
if [ "$CHAIN_ID" != "31337" ]; then
  echo "Refusing to run: $RPC_URL is chain $CHAIN_ID, not a local fork (31337)." >&2
  exit 1
fi

# 6 decimals, integer USDC amounts only — enough for local poking about.
RAW=$(cast to-uint256 "$((AMOUNT_USDC * 1000000))")

EXPECTED=$((AMOUNT_USDC * 1000000))

for slot in $(seq 0 20); do
  KEY=$(cast index address "$ADDRESS" "$slot")
  cast rpc anvil_setStorageAt "$USDC" "$KEY" "$RAW" --rpc-url "$RPC_URL" > /dev/null
  BALANCE=$(cast call "$USDC" "balanceOf(address)(uint256)" "$ADDRESS" --rpc-url "$RPC_URL" | awk '{print $1}')
  if [ "$BALANCE" = "$EXPECTED" ]; then
    echo "$ADDRESS now holds $(cast to-unit "$BALANCE" mwei) USDC (balances live in storage slot $slot)"
    exit 0
  fi
done

echo "Could not find USDC's balance slot — has the token's storage layout changed?" >&2
exit 1
