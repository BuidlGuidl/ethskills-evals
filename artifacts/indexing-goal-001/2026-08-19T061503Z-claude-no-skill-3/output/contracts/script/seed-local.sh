#!/usr/bin/env bash
#
# Fabricates months of check-in history on a local anvil node, so that running
# the indexer locally exercises a real backfill instead of an empty chain.
#
# It rewinds anvil's clock, deploys Streak, then walks forward one UTC day at a
# time (evm_setNextBlockTimestamp) with a handful of members checking in on
# different patterns: one never misses, one does weekdays, one is sporadic, one
# has a long streak that breaks, one shows up rarely.
#
# Usage:
#   anvil --timestamp $(( $(date +%s) - 130*86400 )) &
#   ./script/seed-local.sh            # 120 days of history
#   DAYS=30 ./script/seed-local.sh    # shorter, for a quick loop
#
# Prints the STREAK_ADDRESS / STREAK_START_BLOCK to put in indexer/.env.local.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=${RPC:-http://127.0.0.1:8545}
DAYS=${DAYS:-120}

# anvil's default mnemonic, accounts 0-4.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
)
NOTES=("gm" "shipped the docs" "reviewed 3 PRs" "" "deployed to base sepolia" "back at it")

# Whether member $1 checks in on day $2.
checks_in() {
  local m=$1 d=$2
  case "$m" in
    0) return 0 ;;                                  # never misses
    1) (( d % 7 < 5 )) ;;                           # weekdays only
    2) (( d % 3 != 0 )) ;;                          # sporadic
    3) (( d < DAYS / 3 || d > DAYS / 3 + 5 )) ;;    # long streak, one break
    *) (( d % 11 == 0 )) ;;                         # rare visitor
  esac
}

set_time() { cast rpc --rpc-url "$RPC" evm_setNextBlockTimestamp "$1" >/dev/null; }

# Day 0 of the history, at 09:00 UTC.
start_day=$(( $(date +%s) / 86400 - DAYS ))
set_time $(( start_day * 86400 ))

echo "Deploying Streak..."
deployed=$(forge create src/Streak.sol:Streak \
  --rpc-url "$RPC" --private-key "${KEYS[0]}" --broadcast --json)
ADDRESS=$(echo "$deployed" | jq -r .deployedTo)
START_BLOCK=$(cast block-number --rpc-url "$RPC")

echo "Seeding $DAYS days of check-ins..."
for (( d = 0; d < DAYS; d++ )); do
  set_time $(( (start_day + d) * 86400 + 9 * 3600 ))
  for (( m = 0; m < ${#KEYS[@]}; m++ )); do
    checks_in "$m" "$d" || continue
    note=${NOTES[$(( (d + m) % ${#NOTES[@]} ))]}
    cast send "$ADDRESS" "checkIn(string)" "$note" \
      --rpc-url "$RPC" --private-key "${KEYS[$m]}" >/dev/null
  done
  (( d % 20 == 0 )) && echo "  day $d/$DAYS"
done

echo
echo "Total check-ins: $(cast call "$ADDRESS" "totalCheckIns()(uint256)" --rpc-url "$RPC")"
echo "Total members:   $(cast call "$ADDRESS" "totalMembers()(uint256)" --rpc-url "$RPC")"
echo
echo "Put these in indexer/.env.local:"
echo "  CHAIN_ID=31337"
echo "  PONDER_RPC_URL_BASE=$RPC"
echo "  STREAK_ADDRESS=$ADDRESS"
echo "  STREAK_START_BLOCK=$START_BLOCK"
