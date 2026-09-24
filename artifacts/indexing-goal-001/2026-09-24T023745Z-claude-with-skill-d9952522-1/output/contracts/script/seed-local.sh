#!/usr/bin/env bash
# Seed a local anvil with months of Streak history.
#
# The whole point of this app is that it launches on top of a contract that
# already has a long past. A fresh anvil has none, so this script deploys Streak
# with a backdated clock and replays ~DAYS days of check-ins across several
# members, including deliberate gaps so streaks actually break.
#
# Usage:
#   anvil &
#   ./script/seed-local.sh            # 90 days, 6 members
#   DAYS=30 ./script/seed-local.sh
set -euo pipefail

RPC="${RPC_URL:-http://127.0.0.1:8545}"
DAYS="${DAYS:-90}"

# Default anvil mnemonic accounts 0-5: deployer + 5 members.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
)
NOTES=("gm" "shipped the docs" "" "deploy day" "reviewing PRs" "gm gm" "" "ran the numbers" "back at it")

# Backdate the chain clock so the seeded history lands in the real past. Anvil
# refuses to move its clock backwards, so the chain has to *start* in the past:
# if nothing is listening we start anvil with --timestamp, otherwise we check
# that the running node was started that way.
NOW=$(date +%s)
START=$(( NOW - DAYS * 86400 ))

if cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  CHAIN_TS=$(cast block latest --rpc-url "$RPC" --field timestamp)
  if (( CHAIN_TS > START )); then
    echo "The anvil at $RPC is at $(date -u -d "@$CHAIN_TS" +%F), after the $DAYS-day"
    echo "window this script seeds, and anvil cannot rewind its clock."
    echo
    echo "Restart it in the past:"
    echo "    anvil --timestamp $START"
    exit 1
  fi
  echo "==> using the anvil already running at $RPC"
else
  echo "==> starting anvil at $RPC, clock set to $(date -u -d "@$START" +%F)"
  anvil --silent --timestamp "$START" > /tmp/streak-anvil.log 2>&1 &
  ANVIL_PID=$!
  trap 'echo "(anvil left running as pid $ANVIL_PID)"' EXIT
  for _ in $(seq 30); do cast block-number --rpc-url "$RPC" >/dev/null 2>&1 && break; sleep 0.3; done
  cast block-number --rpc-url "$RPC" >/dev/null || { echo "anvil failed to start"; exit 1; }
fi

ADDRESS=$(forge create src/Streak.sol:Streak \
  --rpc-url "$RPC" --private-key "${KEYS[0]}" --broadcast --json \
  --constructor-args 0 | grep -o '"deployedTo": *"[^"]*"' | cut -d'"' -f4)
[[ -n "$ADDRESS" ]] || { echo "deploy failed"; exit 1; }
DEPLOY_BLOCK=$(cast block-number --rpc-url "$RPC")

echo "==> deployed Streak at $ADDRESS (block $DEPLOY_BLOCK), seeding $DAYS days"

total=0
for (( d=0; d<DAYS; d++ )); do
  # 09:00-ish on day d, jittered, so check-ins are spread through the day.
  ts=$(( START + d * 86400 + 32400 + (d * 971) % 20000 ))
  cast rpc --rpc-url "$RPC" evm_setNextBlockTimestamp "$ts" >/dev/null 2>&1 || true

  for (( m=1; m<${#KEYS[@]}; m++ )); do
    # Deterministic pseudo-random attendance: member 1 is near-perfect,
    # later members are patchier, so streaks and the leaderboard differ.
    roll=$(( (d * 7919 + m * 104729) % 100 ))
    threshold=$(( 95 - m * 12 ))
    (( roll < threshold )) || continue

    note="${NOTES[$(( (d + m) % ${#NOTES[@]} ))]}"
    cast send "$ADDRESS" "checkIn(string)" "$note" \
      --rpc-url "$RPC" --private-key "${KEYS[$m]}" >/dev/null
    total=$(( total + 1 ))
  done
  (( d % 10 == 0 )) && echo "    day $d/$DAYS ($total check-ins)"
done

END_BLOCK=$(cast block-number --rpc-url "$RPC")
echo
echo "==> seeded $total check-ins over $DAYS days, blocks $DEPLOY_BLOCK..$END_BLOCK"
echo
echo "Put these in indexer/.env.local:"
echo "  STREAK_ADDRESS=$ADDRESS"
echo "  STREAK_START_BLOCK=$DEPLOY_BLOCK"
