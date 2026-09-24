#!/usr/bin/env bash
# Deploy Streak to a local anvil node and seed it with several days of check-ins
# across a few members, so the feed, streaks and leaderboard have real history to
# index locally. Prints the env vars the indexer needs.
#
#   anvil &                       # in another terminal
#   ./scripts/seed-local.sh
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# anvil's default accounts.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
)
NOTES=("gm" "shipped the docs" "reviewed 3 PRs" "" "streaking")

MULTICALL3=0xcA11bde05977b3631167028862bE2a173976CA11
if [ "$(cast code "$MULTICALL3" --rpc-url "$RPC")" = "0x" ]; then
  # Base has the real Multicall3 here; a bare anvil has nothing, and viem's
  # batched contract reads would fail. Install an aggregate3-compatible
  # stand-in so local dev behaves like Base.
  echo "Installing a local Multicall3 at $MULTICALL3 ..."
  MC_OUT=$(cd "$ROOT/contracts" && forge create test/helpers/Multicall3Local.sol:Multicall3Local \
    --rpc-url "$RPC" --private-key "${KEYS[0]}" --broadcast --json)
  MC_ADDR=$(echo "$MC_OUT" | grep -o '"deployedTo": *"[^"]*"' | cut -d'"' -f4)
  cast rpc anvil_setCode "$MULTICALL3" "$(cast code "$MC_ADDR" --rpc-url "$RPC")" --rpc-url "$RPC" >/dev/null
fi

echo "Deploying Streak to $RPC ..."
OUT=$(cd "$ROOT/contracts" && forge create src/Streak.sol:Streak \
  --rpc-url "$RPC" --private-key "${KEYS[0]}" --broadcast --json)
ADDRESS=$(echo "$OUT" | grep -o '"deployedTo": *"[^"]*"' | cut -d'"' -f4)
START_BLOCK=$(cast block-number --rpc-url "$RPC")
echo "Streak at $ADDRESS (block $START_BLOCK)"

for day in 0 1 2 3 4 5; do
  i=0
  for key in "${KEYS[@]}"; do
    # member 0 checks in every day, member 1 skips day 2 (breaking a streak),
    # member 2 only checks in on even days.
    skip=0
    if [ "$i" = 1 ] && [ "$day" = 2 ]; then skip=1; fi
    if [ "$i" = 2 ] && [ $((day % 2)) = 1 ]; then skip=1; fi
    if [ "$skip" = 0 ]; then
      note="${NOTES[$(( (day + i) % ${#NOTES[@]} ))]}"
      cast send "$ADDRESS" "checkIn(string)" "$note" \
        --rpc-url "$RPC" --private-key "$key" >/dev/null
    fi
    i=$((i + 1))
  done
  cast rpc evm_increaseTime 86400 --rpc-url "$RPC" >/dev/null
  cast rpc evm_mine --rpc-url "$RPC" >/dev/null
done

echo
echo "Seeded 6 days. Put these in indexer/.env.local:"
echo "STREAK_CHAIN=anvil"
echo "PONDER_RPC_URL_31337=$RPC"
echo "STREAK_ADDRESS=$ADDRESS"
echo "STREAK_START_BLOCK=$START_BLOCK"
echo
# On a fresh anvil every block is unfinalized, so Ponder waits for a new block
# before syncing. Mine one after the indexer starts to kick it off.
echo "Then start the indexer and mine one block: cast rpc evm_mine --rpc-url $RPC"
