#!/usr/bin/env bash
#
# Seeds a local anvil with ~3 months of back-dated check-in history, so the
# feed, streaks and leaderboard have something real to show — and so you can
# verify the indexer actually backfills history rather than only catching
# events from the moment it started.
#
# Usage:
#   anvil --timestamp $(( $(date +%s) - 90*86400 )) --block-time 0   # terminal 1
#   ./scripts/seed-local.sh                                         # terminal 2
#
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
DAYS=${DAYS:-90}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Anvil's deterministic accounts 0-7 are our community members.
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
NOTES=("gm" "shipped the docs" "" "wagmi" "reviewing PRs today" "" "back from vacation" "deployed to base" "gm gm" "")

command -v cast >/dev/null || { echo "foundry's 'cast' is required"; exit 1; }

echo "==> Deploying Streak"
DEPLOY_BLOCK=$(cast block-number --rpc-url "$RPC")
ADDRESS=$(cast send --rpc-url "$RPC" --private-key "${KEYS[0]}" --json \
  --create "$(jq -r '.bytecode.object' "$ROOT/contracts/out/Streak.sol/Streak.json")" \
  | jq -r '.contractAddress')
echo "    Streak at $ADDRESS (deploy block $DEPLOY_BLOCK)"

echo "==> Writing $DAYS days of check-ins"
for (( day=0; day<DAYS; day++ )); do
  for (( i=0; i<${#KEYS[@]}; i++ )); do
    # Deterministic pseudo-attendance: member 0 never misses (long streak),
    # and each later member skips more often. Produces real multi-day runs,
    # broken streaks, and a varied leaderboard.
    if (( (day * 31 + i * 17) % 10 >= i )); then
      note=${NOTES[$(( (day * 7 + i) % ${#NOTES[@]} ))]}
      cast send --rpc-url "$RPC" --private-key "${KEYS[$i]}" \
        "$ADDRESS" "checkIn(string)" "$note" >/dev/null
    fi
  done
  cast rpc --rpc-url "$RPC" evm_increaseTime 86400 >/dev/null
  cast rpc --rpc-url "$RPC" evm_mine >/dev/null
  if (( day % 10 == 0 )); then echo "    day $day/$DAYS"; fi
done

HEAD=$(cast block-number --rpc-url "$RPC")
echo "==> Done. $(cast call --rpc-url "$RPC" "$ADDRESS" "totalCheckIns()(uint256)") check-ins from $(cast call --rpc-url "$RPC" "$ADDRESS" "totalMembers()(uint256)") members, head block $HEAD"

mkdir -p "$ROOT/contracts/deployments"
cat > "$ROOT/contracts/deployments/local.json" <<JSON
{
  "network": "local",
  "address": "$ADDRESS",
  "startBlock": $DEPLOY_BLOCK
}
JSON
echo "==> Wrote contracts/deployments/local.json"
echo "    Next: node scripts/configure-subgraph.mjs local && (cd subgraph && npm run create:local && npm run deploy:local)"
