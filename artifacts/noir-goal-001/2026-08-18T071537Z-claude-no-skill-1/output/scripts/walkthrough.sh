#!/usr/bin/env bash
# The exact sequence NOTES.md describes, for ONE member on ONE proposal, on a
# throwaway local chain. Four transactions, three different senders.
#
#   ./scripts/walkthrough.sh
#
# Env: PORT (default 8545)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8545}"
export RPC_URL="http://127.0.0.1:${PORT}"
run() { env -u NODE_OPTIONS node "$ROOT/scripts/$1"; }
rule() { printf '\n\033[1m--- %s\033[0m\n' "$1"; }

if [ ! -f "$ROOT/circuits/private_vote/target/private_vote.json" ]; then "$ROOT/scripts/build-circuit.sh"; fi

(cd "$ROOT/contracts" && forge build >/dev/null)

anvil --port "$PORT" --silent &
ANVIL_PID=$!
# shellcheck disable=SC2064
trap "kill $ANVIL_PID 2>/dev/null || true" EXIT
for _ in $(seq 1 60); do cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break; sleep 0.25; done

rule "deploy (admin wallet)"
"$ROOT/scripts/deploy.sh" | grep -E "HonkVerifier|MembershipNFT|MemberSet|PrivateBallot|admin"

rule "background: 149 other members already joined (demo scaffolding)"
COHORT=149 run seed.js

rule "tx 1 of 4: issue our member's seat (admin wallet)"
run mint.js

rule "tx 2 of 4: the member joins the vote (member's own wallet)"
run enroll.js

rule "tx 3 of 4: open a proposal (a member's own wallet)"
run propose.js

rule "tx 4 of 4: cast the ballot (an unlinked submitter wallet)"
PROPOSAL_ID=0 VOTE=yes run vote.js

rule "the deadline passes"
cast rpc evm_increaseTime 259201 --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null

rule "anyone reads the tally (no wallet at all)"
PROPOSAL_ID=0 run tally.js
