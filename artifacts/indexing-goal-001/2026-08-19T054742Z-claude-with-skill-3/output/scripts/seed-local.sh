#!/usr/bin/env bash
# Deploys Streak to a local anvil and fills it with weeks of back-dated check-ins,
# so you can develop the read side against a contract that already has history --
# which is the situation the app actually launches into.
#
#   anvil                      # terminal 1
#   ./scripts/seed-local.sh    # terminal 2
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"
DAYS="${DAYS:-45}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# anvil's default accounts 0-4.
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
)
NAMES=(alice bob carol dave erin)
NOTES=("gm" "shipped the docs" "reviewed 3 PRs" "" "back at it" "deployed to base" "gm gm")

command -v cast >/dev/null || { echo "foundry (cast) is required: https://getfoundry.sh"; exit 1; }
cast block-number --rpc-url "$RPC" >/dev/null 2>&1 || { echo "no anvil at $RPC -- run 'anvil' first"; exit 1; }

# Back-date the chain so the seeded history *ends today*: the last day seeded is
# the current UTC day, which is what the app sees in production. (Seeding forward
# from now would put the whole record in the future, where "this month" and live
# streaks make no sense.)
START_TS=$(( ($(date -u +%s) / 86400 - DAYS + 1) * 86400 + 3600 ))
cast rpc anvil_setTime $(( START_TS - 86400 )) --rpc-url "$RPC" >/dev/null

echo "==> deploying Streak to $RPC"
DEPLOY_BLOCK=$(( $(cast block-number --rpc-url "$RPC") + 1 ))
ADDRESS=$(cd "$ROOT/contracts" && forge create src/Streak.sol:Streak \
  --rpc-url "$RPC" --private-key "${KEYS[0]}" --broadcast --json \
  | grep -o '"deployedTo": *"[^"]*"' | grep -o '0x[0-9a-fA-F]*')
echo "    address=$ADDRESS  startBlock=$DEPLOY_BLOCK"

echo "==> seeding $DAYS days of check-ins across ${#KEYS[@]} members, ending today"
for ((d = 0; d < DAYS; d++)); do
  cast rpc evm_setNextBlockTimestamp $(( START_TS + d * 86400 )) --rpc-url "$RPC" >/dev/null
  for ((m = 0; m < ${#KEYS[@]}; m++)); do
    # Each member has their own rhythm, so streaks and rankings actually differ:
    # alice never misses, bob skips every 7th day, carol every 3rd, and so on.
    case $m in
      0) skip=0 ;;
      1) skip=$(( d % 7 == 6 )) ;;
      2) skip=$(( d % 3 == 2 )) ;;
      3) skip=$(( d % 2 == 1 )) ;;
      *) skip=$(( d % 5 != 0 )) ;;
    esac
    [ "$skip" = "1" ] && continue

    note="${NOTES[$(( (d + m) % ${#NOTES[@]} ))]}"
    cast send "$ADDRESS" "checkIn(string)" "$note" \
      --rpc-url "$RPC" --private-key "${KEYS[$m]}" >/dev/null
  done
  printf '.'
done
echo ""

TOTAL=$(cast call "$ADDRESS" "totalCheckIns()(uint64)" --rpc-url "$RPC")
echo "==> done: $TOTAL check-ins on chain, from block $DEPLOY_BLOCK to $(cast block-number --rpc-url "$RPC")"
for ((m = 0; m < ${#KEYS[@]}; m++)); do
  addr=$(cast wallet address --private-key "${KEYS[$m]}")
  echo "    ${NAMES[$m]} $addr -> $(cast call "$ADDRESS" "getMember(address)(uint32,uint32,uint32)" "$addr" --rpc-url "$RPC" | tr '\n' ' ')(streak total lastDay)"
done

cat > "$ROOT/indexer/.env.local" <<EOF
CHAIN_ID=31337
PONDER_RPC_URL=$RPC
STREAK_ADDRESS=$ADDRESS
STREAK_START_BLOCK=$DEPLOY_BLOCK
EOF
echo "==> wrote indexer/.env.local -- now run: cd indexer && npm run dev"
