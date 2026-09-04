#!/usr/bin/env bash
# Full local run: anvil -> deploy -> 150 members join -> proposal -> one anonymous vote -> tally.
#
#   ./scripts/demo.sh
#
# Assumes the circuit is already built (`npm run circuit`) and `npm install` has run. Starts its
# own anvil on RPC_PORT and shuts it down on exit.
set -euo pipefail

cd "$(dirname "$0")/.."
RPC_PORT="${RPC_PORT:-8545}"
export RPC_URL="http://127.0.0.1:${RPC_PORT}"

if [[ ! -f circuits/anon_vote/target/anon_vote.json ]]; then
  echo "circuit artifact missing — run: npm run circuit" >&2
  exit 1
fi

# Fail loudly rather than quietly reusing someone else's node: a leftover anvil with state from a
# previous run makes the demo look like it half-worked.
if lsof -nP -iTCP:"$RPC_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $RPC_PORT is already in use. Stop that node, or run with RPC_PORT=8546" >&2
  exit 1
fi

# `--accounts 152` pre-funds the deployer, all 150 members and the relayer, so setup needs no
# funding transactions at all — 150 transfers is a lot of blocks to mine just to stand up a demo.
anvil --silent --port "$RPC_PORT" --accounts 152 &
ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1 && break
  kill -0 "$ANVIL_PID" 2>/dev/null || { echo "anvil exited during startup" >&2; exit 1; }
  sleep 0.25
done
cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1 || { echo "anvil never became ready" >&2; exit 1; }
rm -f contracts/deployments/local.json

step() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

step "deploy + wire contracts, mint 150 membership NFTs"
(cd contracts && forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --skip-simulation \
  | grep -E "MembershipNFT|HonkVerifier|MemberRegistry|AnonVoting|relayer|members minted")

step "each member registers a commitment from their own wallet"
node scripts/register.mjs

step "a member opens a proposal (public, attributable)"
node scripts/propose.mjs "Fund the grants round" 3600

step "member 7 votes yes, submitted by a relayer"
node scripts/vote.mjs --member 7 --proposal 1 --support yes

step "member 42 votes no, submitted from a burner wallet"
node scripts/vote.mjs --member 42 --proposal 1 --support no --via burner

step "member 7 tries to vote again"
# Expected to fail, so capture instead of piping — under `pipefail` a failing `node` would sink
# the whole pipeline even when grep matches.
recast_output="$(node scripts/vote.mjs --member 7 --proposal 1 --support no 2>&1 || true)"
if grep -q "already voted" <<<"$recast_output"; then
  echo "rejected before it cost any gas: the nullifier for (member 7, proposal 1) is already spent"
else
  echo "UNEXPECTED: double vote was not caught" >&2
  echo "$recast_output" >&2
  exit 1
fi

step "tally while voting is open"
node scripts/tally.mjs 1

step "warp past the deadline and read the final tally"
cast rpc evm_increaseTime 3601 --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
node scripts/tally.mjs 1
