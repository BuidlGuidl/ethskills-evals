#!/usr/bin/env bash
# Seed a local anvil node with a backdated history of check-ins, so you can see
# the feed / streaks / leaderboard with real data before touching Base.
#
#   anvil &                       # terminal 1
#   ./scripts/seed-anvil.sh       # terminal 2
#
# Prints the contract address and deployment block to paste into indexer/.env.local.
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"
DAYS="${DAYS:-75}"            # how many days of history to fabricate
MEMBERS="${MEMBERS:-6}"       # how many of anvil's default accounts participate
DAY=86400

# anvil's deterministic dev keys (mnemonic "test test ... junk").
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
  0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
  0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
  0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97
  0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
)
(( MEMBERS <= ${#KEYS[@]} )) || { echo "MEMBERS must be <= ${#KEYS[@]}"; exit 1; }

NOTES=("gm" "gm gm" "shipped the docs" "onchain summer" "wagmi" "pushed a fix"
       "reviewing PRs" "deployed to testnet" "" "back at it" "streak alive"
       "coffee then code")

cd "$(dirname "$0")/../contracts"

# Rewind the chain clock so the seeded history lands in the past.
START_TS=$(( $(date +%s) - DAYS * DAY ))
cast rpc --rpc-url "$RPC" anvil_setTime "$START_TS" >/dev/null
cast rpc --rpc-url "$RPC" evm_mine >/dev/null

echo "deploying Streak..."
ADDR=$(forge create src/Streak.sol:Streak \
  --rpc-url "$RPC" --private-key "${KEYS[0]}" --broadcast --json \
  | tr -d '\n ' | grep -oE '"deployedTo":"0x[0-9a-fA-F]{40}"' | cut -d'"' -f4)
BLOCK=$(cast block-number --rpc-url "$RPC")
echo "Streak at $ADDR (block $BLOCK)"

for (( d=0; d<DAYS; d++ )); do
  TS=$(( START_TS + d * DAY + 3600 ))
  cast rpc --rpc-url "$RPC" anvil_setTime "$TS" >/dev/null
  for (( m=0; m<MEMBERS; m++ )); do
    # Deterministic-but-uneven participation: everyone has gaps, so streaks and
    # the monthly leaderboard actually differ between members. Lower-indexed
    # accounts are the more dedicated ones (account 0 skips ~5% of days,
    # each subsequent account ~8% more).
    hash=$(( (d * 7919 + m * 104729) % 100 ))
    if (( hash >= 5 + m * 8 )); then
      NOTE="${NOTES[$(( (d + m) % ${#NOTES[@]} ))]}"
      cast send --rpc-url "$RPC" --private-key "${KEYS[$m]}" "$ADDR" \
        "checkIn(string)" "$NOTE" >/dev/null
    fi
  done
  printf "\rday %d/%d" "$((d + 1))" "$DAYS"
done
echo

echo
echo "total check-ins: $(cast call --rpc-url "$RPC" "$ADDR" "totalCheckIns()(uint256)")"
echo "members:         $(cast call --rpc-url "$RPC" "$ADDR" "totalMembers()(uint256)")"
echo
echo "Put this in indexer/.env.local:"
echo "  STREAK_CHAIN=anvil"
echo "  PONDER_RPC_URL=$RPC"
echo "  STREAK_ADDRESS=$ADDR"
echo "  STREAK_START_BLOCK=$BLOCK"
