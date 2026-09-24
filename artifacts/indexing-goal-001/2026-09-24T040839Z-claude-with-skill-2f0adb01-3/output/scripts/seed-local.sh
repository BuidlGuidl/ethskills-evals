#!/usr/bin/env bash
# Seed a local anvil with a couple of months of back-dated check-ins, so the feed,
# streaks and leaderboard have real history to index — that is the case the app
# has to get right, and an empty chain never exercises it.
#
# Start anvil back-dated first:
#   anvil --timestamp $(( $(date +%s) - 60*86400 ))
# then:  STREAK=0x... ./scripts/seed-local.sh
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
STREAK=${STREAK:?set STREAK to the deployed contract address}
DAYS=${DAYS:-60}

# anvil's default accounts 0..2, with different check-in habits.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # daily
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d  # most days
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a  # sporadic
)
CHANCE=(100 80 25)
NOTES=("gm" "shipped the docs" "" "reviewed 3 PRs" "deployed to testnet" "gm gm")

for ((day = 0; day < DAYS; day++)); do
  for i in "${!KEYS[@]}"; do
    (( RANDOM % 100 < CHANCE[i] )) || continue
    note=${NOTES[$((RANDOM % ${#NOTES[@]}))]}
    cast send "$STREAK" "checkIn(string)" "$note" \
      --private-key "${KEYS[$i]}" --rpc-url "$RPC" >/dev/null
  done
  cast rpc evm_increaseTime 86400 --rpc-url "$RPC" >/dev/null
  cast rpc evm_mine --rpc-url "$RPC" >/dev/null
  printf '\rseeded day %d/%d' "$((day + 1))" "$DAYS"
done
echo " — done"
