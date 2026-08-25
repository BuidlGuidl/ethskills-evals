#!/usr/bin/env bash
#
# Local end-to-end setup: starts anvil with a backdated clock, deploys Streak,
# and fills it with weeks of check-in history so the indexer has a real backfill
# to chew through — the same situation as launching against a contract that has
# been live on Base for months.
#
# Usage:  ./scripts/seed-local.sh            # 45 days, 6 members
#         DAYS=90 MEMBERS=8 ./scripts/seed-local.sh
#
# Leaves anvil running in the background and writes indexer/.env.local so that
# `cd indexer && pnpm dev` indexes the seeded history.
set -euo pipefail

DAYS=${DAYS:-45}
MEMBERS=${MEMBERS:-6}
RPC_URL=${RPC_URL:-http://127.0.0.1:8545}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# anvil's default mnemonic accounts: [0] deploys, [1..MEMBERS] check in.
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
)
if (( MEMBERS > ${#KEYS[@]} - 1 )); then
  echo "MEMBERS must be <= $(( ${#KEYS[@]} - 1 ))" >&2
  exit 1
fi

NOTES=("gm" "shipped the docs" "" "reviewing PRs" "deployed to Base" "" "day off, still here" "wrote tests" "onchain summer")

if curl -s -o /dev/null -m 2 "$RPC_URL"; then
  echo "Something is already listening on $RPC_URL — stop it first (pkill anvil)." >&2
  exit 1
fi

# Start the chain at UTC noon, DAYS days ago. Noon keeps every seeded check-in
# well away from a UTC midnight boundary, so one loop iteration is exactly one
# check-in day for everyone.
NOW=$(date -u +%s)
START_TS=$(( (NOW / 86400 - DAYS + 1) * 86400 + 43200 ))

echo "==> Starting anvil at $(date -u -d "@$START_TS" +%Y-%m-%dT%H:%M:%SZ) ($DAYS days back)"
anvil --timestamp "$START_TS" --silent > "$ROOT/anvil.log" 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 50); do
  cast block-number --rpc-url "$RPC_URL" > /dev/null 2>&1 && break
  sleep 0.2
done

echo "==> Deploying Streak"
(cd "$ROOT/contracts" && forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" --private-key "${KEYS[0]}" --broadcast --quiet)

read -r STREAK_ADDRESS START_BLOCK < <(node -e '
const run = require("'"$ROOT"'/contracts/broadcast/Deploy.s.sol/31337/run-latest.json");
const tx = run.transactions.find((t) => t.transactionType === "CREATE");
const receipt = run.receipts.find((r) => r.transactionHash === tx.hash);
console.log(tx.contractAddress, Number(receipt.blockNumber));
')
echo "    Streak @ $STREAK_ADDRESS (block $START_BLOCK)"

echo "==> Seeding $DAYS days of check-ins for $MEMBERS members"
for (( day = 0; day < DAYS; day++ )); do
  for (( m = 1; m <= MEMBERS; m++ )); do
    # Member 1 never misses; member 2 skips every 7th day; member 3 every 5th; ...
    if (( m > 1 && day % (m + 2) == 0 )); then continue; fi
    note=${NOTES[$(( (day * 7 + m) % ${#NOTES[@]} ))]}
    cast send "$STREAK_ADDRESS" "checkIn(string)" "$note" \
      --private-key "${KEYS[$m]}" --rpc-url "$RPC_URL" > /dev/null
  done
  cast rpc evm_increaseTime 86400 --rpc-url "$RPC_URL" > /dev/null
  cast rpc evm_mine --rpc-url "$RPC_URL" > /dev/null
  printf "\r    day %d/%d" "$(( day + 1 ))" "$DAYS"
done
echo

cat > "$ROOT/indexer/.env.local" <<ENV
# Written by scripts/seed-local.sh — local anvil setup.
CHAIN_ID=31337
PONDER_RPC_URL_BASE=$RPC_URL
STREAK_ADDRESS=$STREAK_ADDRESS
STREAK_START_BLOCK=$START_BLOCK
ENV

echo
echo "==> Done. anvil is running in the background (pid $ANVIL_PID, log: anvil.log)"
echo "    Wrote indexer/.env.local"
echo "    Next:  cd indexer && pnpm install && pnpm dev"
echo "    Stop the chain with: kill $ANVIL_PID"
