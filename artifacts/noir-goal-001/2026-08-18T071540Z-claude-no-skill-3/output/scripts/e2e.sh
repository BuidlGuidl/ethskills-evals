#!/usr/bin/env bash
# One-command end-to-end demo on a throwaway local chain.
#
#   ./scripts/e2e.sh              # 150 members, member 42 votes yes
#   MEMBERS=30 MEMBER=7 SUPPORT=no ./scripts/e2e.sh
#
# Starts anvil, deploys, has members join, opens a proposal, casts one
# anonymous vote, closes voting and reads the tally.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-8545}"
RPC_URL="http://127.0.0.1:${PORT}"
MEMBERS="${MEMBERS:-150}"
MEMBER="${MEMBER:-42}"
SUPPORT="${SUPPORT:-yes}"
VOTING_PERIOD="${VOTING_PERIOD:-3600}"
# Keep the demo self-consistent: never require a larger anonymity set than the
# number of members this run actually registers.
if [ -z "${MIN_ANONYMITY_SET:-}" ]; then
  MIN_ANONYMITY_SET=$(( MEMBERS < 20 ? MEMBERS : 20 ))
fi
export RPC_URL MIN_ANONYMITY_SET

banner() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Set PORT=... or stop the other process." >&2
  exit 1
fi

banner "Starting anvil on :$PORT"
anvil --port "$PORT" --silent &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1 && break
  sleep 0.25
done

# Make sure we are talking to the node we just started, and that it is fresh.
# A leftover anvil from an earlier run can carry an evm_increaseTime offset,
# which silently makes deadlines behave unlike a real chain.
kill -0 "$ANVIL_PID" 2>/dev/null || { echo "anvil failed to start" >&2; exit 1; }
START_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "?")
if [ "$START_BLOCK" != "0" ]; then
  echo "Expected a fresh chain at $RPC_URL but block number is $START_BLOCK." >&2
  echo "Another node is probably still running there. Stop it, or set PORT=..." >&2
  exit 1
fi
echo "anvil up (pid $ANVIL_PID, fresh chain)"

banner "Deploying and wiring contracts"
rm -f contracts/deployments/31337.json
( cd contracts && MEMBER_COUNT="$MEMBERS" MIN_ANONYMITY_SET="$MIN_ANONYMITY_SET" \
    forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast >/dev/null )
cat contracts/deployments/31337.json

banner "Members join the voter set (their own wallets)"
COUNT="$MEMBERS" npm run --silent register

banner "Admin opens a proposal"
VOTING_PERIOD="$VOTING_PERIOD" npm run --silent propose

banner "One member votes anonymously"
MEMBER="$MEMBER" SUPPORT="$SUPPORT" npm run --silent vote

banner "Closing the vote and reading the tally"
cast rpc evm_increaseTime "$((VOTING_PERIOD + 1))" --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
npm run --silent tally
