#!/usr/bin/env bash
# Seeds a local anvil with months of back-dated check-ins, so the feed, the
# streaks and the leaderboard all have real history to show locally — the same
# situation the app launches into on Base.
#
#   anvil &                       # in another terminal
#   ./scripts/seed-local.sh 0xYourDeployedStreakAddress [days] [members]
#
# It rewinds anvil's clock by `days`, then walks forward one day at a time,
# having a random subset of members check in each day. Streaks therefore have
# genuine gaps in them.
set -euo pipefail

STREAK=${1:?usage: seed-local.sh <streak-address> [days] [members]}
DAYS=${2:-90}
MEMBERS=${3:-8}
RPC=${RPC_URL:-http://localhost:8545}

# anvil's well-known dev accounts.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
  0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
  0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
)
(( MEMBERS <= ${#KEYS[@]} )) || { echo "max ${#KEYS[@]} members"; exit 1; }

NOTES=("gm" "shipped the docs" "" "reviewed 3 PRs" "" "back from a break" "deployed to prod" "gm gm")

# The chain has to *start* in the past, because block timestamps can only move
# forward. Start anvil with:
#
#   anvil --timestamp $(( $(date -u +%s) - 90 * 86400 ))
#
# then deploy, then run this. The seeder walks from the chain's current time
# forward, one day per iteration, landing on roughly today.
START=$(( $(cast block latest --rpc-url "$RPC" --field timestamp) + 60 ))
NOW=$(date -u +%s)
END=$(( START + DAYS * 86400 ))
if (( END > NOW + 86400 )); then
  echo "warning: this seeds up to $(date -u -d "@$END" +%Y-%m-%d), in the future."
  echo "         restart anvil with --timestamp $(( NOW - DAYS * 86400 )) for history ending today."
fi

echo "seeding $DAYS days from $(date -u -d "@$START" +%Y-%m-%d)..."

for (( d = 0; d < DAYS; d++ )); do
  cast rpc --rpc-url "$RPC" evm_setNextBlockTimestamp $(( START + d * 86400 )) >/dev/null
  cast rpc --rpc-url "$RPC" evm_mine >/dev/null

  for (( m = 0; m < MEMBERS; m++ )); do
    # Deterministic attendance with real gaps: member m checks in every day
    # except every (m+3)th, so each member holds a different streak length and
    # the leaderboard has a genuine spread.
    if (( (d + m * 3) % (m + 3) == 0 )); then continue; fi
    note=${NOTES[$(( (d + m) % ${#NOTES[@]} ))]}
    cast send --rpc-url "$RPC" --private-key "${KEYS[$m]}" \
      "$STREAK" "checkIn(string)" "$note" >/dev/null
  done
  (( d % 10 == 0 )) && echo "  seeded day $d/$DAYS"
done

echo "done — $DAYS days of history across $MEMBERS members"
