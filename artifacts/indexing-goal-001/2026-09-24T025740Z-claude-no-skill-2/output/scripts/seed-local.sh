#!/usr/bin/env bash
# Seeds a local anvil node with ~two months of back-dated check-ins, so you can
# run the indexer against a chain that already has history behind it — which is
# the situation the real deployment is in.
#
#   1. anvil --timestamp $(( $(date +%s) - 60*86400 ))
#   2. ./scripts/seed-local.sh
#
# Prints the contract address and deployment block for indexer/.env.local.
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
DAYS="${DAYS:-60}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# anvil's first five default accounts.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
)
NOTES=("gm" "shipped the docs" "back at it" "day done" "onchain" "still here" "ship ship ship")

cast_send() { cast send --rpc-url "$RPC_URL" --private-key "$1" "${@:2}" >/dev/null; }

echo "==> deploying Streak to $RPC_URL"
DEPLOY_JSON="$(forge create "src/Streak.sol:Streak" \
  --root "$ROOT/contracts" \
  --rpc-url "$RPC_URL" --private-key "${KEYS[0]}" --broadcast --json)"
ADDRESS="$(echo "$DEPLOY_JSON" | grep -o '"deployedTo": *"0x[0-9a-fA-F]\{40\}"' | grep -o '0x[0-9a-fA-F]\{40\}')"
START_BLOCK="$(cast block-number --rpc-url "$RPC_URL")"
echo "    address=$ADDRESS block=$START_BLOCK"

echo "==> writing $DAYS days of check-ins"
for ((d = 0; d < DAYS; d++)); do
  # A different attendance pattern per member, so streaks and the leaderboard
  # have something to actually differentiate.
  for i in "${!KEYS[@]}"; do
    case $i in
    0) go=1 ;;                                        # perfect attendance
    1) [[ $((d % 7)) -ne 3 ]] && go=1 || go=0 ;;      # misses one day a week
    2) [[ $((d % 3)) -eq 0 ]] && go=1 || go=0 ;;      # every third day
    3) [[ $d -ge $((DAYS - 5)) ]] && go=1 || go=0 ;;  # joined recently
    4) [[ $d -lt 30 && $((d % 2)) -eq 0 ]] && go=1 || go=0 ;; # drifted away
    esac
    if [[ $go -eq 1 ]]; then
      note="${NOTES[$(((d + i) % ${#NOTES[@]}))]}"
      cast_send "${KEYS[$i]}" "$ADDRESS" "checkIn(string)" "$note"
    fi
  done

  if ((d < DAYS - 1)); then
    cast rpc --rpc-url "$RPC_URL" evm_increaseTime 86400 >/dev/null
    cast rpc --rpc-url "$RPC_URL" evm_mine >/dev/null
  fi
  printf "\r    day %d/%d" "$((d + 1))" "$DAYS"
done
echo

cat <<EOF

==> done. Put this in indexer/.env.local:

CHAIN_ID=31337
PONDER_RPC_URL_BASE=$RPC_URL
STREAK_ADDRESS=$ADDRESS
STREAK_START_BLOCK=$START_BLOCK

Then: cd indexer && npm run dev
EOF
