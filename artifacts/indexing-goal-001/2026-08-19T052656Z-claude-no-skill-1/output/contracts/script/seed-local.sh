#!/usr/bin/env bash
#
# Seeds a local anvil node with months of Streak history, so the indexer has a real
# backfill to chew on and the three screens have something to show.
#
# Start anvil with a genesis timestamp in the past, e.g. 60 days back:
#
#   anvil --timestamp $(( $(date +%s) - 60 * 86400 ))
#
# then run this script. It deploys Streak, then walks the chain forward one UTC day
# at a time up to the present, checking in a handful of members with different habits
# (perfect attendance, weekdays only, someone who quit halfway) so streaks and the
# monthly leaderboard have some shape to them.
#
# Usage: ./script/seed-local.sh [rpc-url]

set -euo pipefail

RPC_URL="${1:-http://127.0.0.1:8545}"
MNEMONIC="test test test test test test test test test test test junk"
DEPLOYER_KEY="$(cast wallet private-key --mnemonic "$MNEMONIC" --mnemonic-index 0)"
MAX_DAYS=180

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

command -v cast >/dev/null || { echo "foundry's 'cast' is not on PATH"; exit 1; }
cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1 || {
  echo "No node at $RPC_URL. Start one with:"
  echo "  anvil --timestamp \$(( \$(date +%s) - 60 * 86400 ))"
  exit 1
}

now="$(date +%s)"
chain_time="$(cast block latest --rpc-url "$RPC_URL" --field timestamp)"
days=$(( (now - chain_time) / 86400 ))

if (( days < 1 )); then
  echo "The node's clock ($chain_time) is not in the past, so there is no history to seed."
  echo "Restart anvil with: anvil --timestamp \$(( \$(date +%s) - 60 * 86400 ))"
  exit 1
fi
if (( days > MAX_DAYS )); then days=$MAX_DAYS; fi

echo "Seeding $days days of check-ins on $RPC_URL"

start_block="$(cast block-number --rpc-url "$RPC_URL")"
address="$(forge create src/Streak.sol:Streak \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" --broadcast --json \
  | grep -o '"deployedTo": *"[^"]*"' | grep -o '0x[0-9a-fA-F]*')"
[[ -n "$address" ]] || { echo "deploy failed"; exit 1; }
echo "Streak deployed to $address (block $((start_block + 1)))"

# Six members, six habits. Index into the anvil mnemonic.
MEMBERS=(1 2 3 4 5 6)
declare -A KEYS
for i in "${MEMBERS[@]}"; do
  KEYS[$i]="$(cast wallet private-key --mnemonic "$MNEMONIC" --mnemonic-index "$i")"
done

NOTES=("gm" "shipped the docs" "gm gm" "reviewed 3 PRs" "" "deployed to Base"
       "wrote tests" "still here" "back at it" "" "fixed the indexer" "ship it")

# Does member $1 check in on day $2 (0-based)?
should_check_in() {
  local member="$1" day="$2" dow
  dow=$(( ( (chain_time + day * 86400) / 86400 + 4 ) % 7 ))  # 0 = Sunday
  case "$member" in
    1) return 0 ;;                                        # never misses
    2) (( day % 17 != 5 )) && return 0 || return 1 ;;      # rare slip
    3) (( dow != 0 && dow != 6 )) && return 0 || return 1 ;; # weekdays only
    4) (( day % 2 == 0 )) && return 0 || return 1 ;;       # every other day
    5) (( day < days * 2 / 3 )) && return 0 || return 1 ;; # quit two thirds in
    6) (( day % 3 == 0 || day % 7 == 1 )) && return 0 || return 1 ;; # sporadic
  esac
  return 1
}

for (( day = 0; day < days; day++ )); do
  for i in "${MEMBERS[@]}"; do
    if should_check_in "$i" "$day"; then
      note="${NOTES[$(( (day * 7 + i) % ${#NOTES[@]} ))]}"
      if [[ -z "$note" ]]; then
        cast send "$address" "checkIn()" \
          --rpc-url "$RPC_URL" --private-key "${KEYS[$i]}" >/dev/null
      else
        cast send "$address" "checkIn(string)" "$note" \
          --rpc-url "$RPC_URL" --private-key "${KEYS[$i]}" >/dev/null
      fi
    fi
  done
  # Advance one UTC day.
  cast rpc evm_increaseTime 86400 --rpc-url "$RPC_URL" >/dev/null
  cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
  printf "\rday %d/%d" "$((day + 1))" "$days"
done
echo

env_file="$here/../indexer/.env.local"
cat > "$env_file" <<ENV
# Written by contracts/script/seed-local.sh — local anvil, not a real deployment.
CHAIN_ID=31337
PONDER_RPC_URL=$RPC_URL
STREAK_ADDRESS=$address
STREAK_START_BLOCK=$((start_block + 1))
ENV

echo
echo "Done. Wrote $(cd "$(dirname "$env_file")" && pwd)/.env.local:"
cat "$env_file"
echo
echo "Now run the indexer:  cd indexer && npm run dev"
