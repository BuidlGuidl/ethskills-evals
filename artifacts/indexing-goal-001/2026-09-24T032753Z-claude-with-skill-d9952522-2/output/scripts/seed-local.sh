#!/usr/bin/env bash
# Seeds a local Anvil node with a deployed Streak contract and DAYS days of
# backdated check-ins, so the indexer has real history to backfill locally.
#
# Usage:  anvil &   then   ./scripts/seed-local.sh
# Writes indexer/.env.local with the address and start block it produced.
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"
DAYS="${DAYS:-62}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Anvil's first four deterministic accounts.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
)
NAMES=(alice bob carol dave)
# Each member checks in every Nth day: alice daily, bob every 2nd, and so on. This
# gives the leaderboard a clear ranking and gives profiles differing streaks.
STRIDES=(1 2 3 5)
NOTES=("gm" "shipped the docs" "reviewing PRs" "" "back at it" "deployed to base" "wen mainnet" "coffee first")

# Send a tx and fail loudly if it reverted. `cast send` exits 0 even when the
# transaction reverts onchain, so the receipt status has to be checked explicitly.
send() {
  local status
  status=$(cast send "$@" --rpc-url "$RPC" --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')
  if [[ "$status" != "0x1" ]]; then
    echo "ERROR: transaction reverted (status=$status): $*" >&2
    exit 1
  fi
}

# Day 0 of the simulation, chosen so the final day is today: history therefore ends
# at the current UTC day, exactly as it would for a contract that has been live for
# months. Anchored to 01:00 UTC so the several blocks mined within one simulated day
# can never spill over a day boundary.
TODAY_INDEX=$(( $(date -u +%s) / 86400 ))
START_DAY_INDEX=$(( TODAY_INDEX - DAYS + 1 ))

day_ts() { echo $(( ($START_DAY_INDEX + $1) * 86400 + 3600 )); }

echo "==> Backdating Anvil to $(date -u -d "@$(day_ts 0)" +%Y-%m-%d) ($DAYS days of history)"
cast rpc anvil_setTime "$(day_ts 0)" --rpc-url "$RPC" >/dev/null
cast rpc evm_mine --rpc-url "$RPC" >/dev/null

echo "==> Deploying Streak to $RPC"
DEPLOY_OUT=$(cd "$ROOT/contracts" && forge create src/Streak.sol:Streak \
  --rpc-url "$RPC" --private-key "${KEYS[0]}" --broadcast --json)
ADDRESS=$(echo "$DEPLOY_OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["deployedTo"])')
START_BLOCK=$(cast block-number --rpc-url "$RPC")
echo "    address=$ADDRESS start_block=$START_BLOCK"

echo "==> Simulating $DAYS days of check-ins"
EXPECTED=0
for ((d = 0; d < DAYS; d++)); do
  # Pin the day explicitly rather than nudging the clock forward: evm_increaseTime
  # drifts against the blocks each check-in mines, which silently collapses two
  # simulated days into one and makes the second check-in revert.
  cast rpc evm_setNextBlockTimestamp "$(day_ts "$d")" --rpc-url "$RPC" >/dev/null
  cast rpc evm_mine --rpc-url "$RPC" >/dev/null

  for i in "${!KEYS[@]}"; do
    if ((d % ${STRIDES[$i]} == 0)); then
      note="${NOTES[$(((d + i) % ${#NOTES[@]}))]}"
      send "$ADDRESS" "checkIn(string)" "$note" --private-key "${KEYS[$i]}"
      EXPECTED=$((EXPECTED + 1))
    fi
  done
done

ONCHAIN=$(cast call "$ADDRESS" "totalCheckIns()(uint64)" --rpc-url "$RPC" | awk '{print $1}')
echo "==> Recorded $ONCHAIN check-ins onchain (expected $EXPECTED)"
if [[ "$ONCHAIN" != "$EXPECTED" ]]; then
  echo "ERROR: check-in count mismatch; the simulated clock lost a day" >&2
  exit 1
fi

cat > "$ROOT/indexer/.env.local" <<EOF
CHAIN_ID=31337
PONDER_RPC_URL_8453=$RPC
STREAK_ADDRESS=$ADDRESS
STREAK_START_BLOCK=$START_BLOCK
DATABASE_SCHEMA=public
EOF

echo "==> Wrote indexer/.env.local"
for i in "${!NAMES[@]}"; do
  echo "    ${NAMES[$i]}  $(cast wallet address --private-key "${KEYS[$i]}")  every ${STRIDES[$i]} day(s)"
done
echo "    Next:  cd indexer && npm install && npm run dev"
