#!/usr/bin/env bash
# End-to-end run on a fresh anvil: deploy, 3 members join, a proposal opens,
# each member votes through the relayer, a double vote is rejected, time passes,
# tally is read. Uses anvil's well-known dev keys:
#   #0 deployer   #1-#3 members (NFT holders)   #9 relayer (unrelated wallet)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
PORT_ANVIL=${PORT_ANVIL:-8555}; export RPC_URL=http://127.0.0.1:$PORT_ANVIL PORT=${PORT:-8797}; export RELAYER_URL=http://127.0.0.1:$PORT NOTES_DIR="$ROOT/.notes/demo"
M="test test test test test test test test test test test junk"   # anvil default mnemonic
key() { cast wallet private-key "$M" "$1"; }
addr() { cast wallet address "$(key "$1")"; }
K0=$(key 0); K1=$(key 1); K2=$(key 2); K3=$(key 3); K9=$(key 9)
A1=$(addr 1); A2=$(addr 2); A3=$(addr 3)

rm -rf "$NOTES_DIR"
anvil --silent --port $PORT_ANVIL & ANVIL=$!
trap 'kill ${RELAYER:-} $ANVIL 2>/dev/null; wait 2>/dev/null' EXIT
until cast chain-id --rpc-url $RPC_URL >/dev/null 2>&1; do sleep 0.2; done

(cd contracts && DEMO_MEMBERS="$A1,$A2,$A3" MIN_ANONYMITY_SET=3 \
  forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $K0 --broadcast -q)

TOKEN_ID=1 MEMBER_KEY=$K1 node scripts/register.mjs
TOKEN_ID=2 MEMBER_KEY=$K2 node scripts/register.mjs
TOKEN_ID=3 MEMBER_KEY=$K3 node scripts/register.mjs

PROPOSER_KEY=$K1 DESCRIPTION="Adopt budget v2?" VOTING_PERIOD=3600 node scripts/propose.mjs

RELAYER_KEY=$K9 node scripts/relayer.mjs & RELAYER=$!
until curl -s -o /dev/null $RELAYER_URL; do sleep 0.2; done

NOTE=$NOTES_DIR/member-1.json PROPOSAL_ID=0 SUPPORT=yes node scripts/vote.mjs
NOTE=$NOTES_DIR/member-2.json PROPOSAL_ID=0 SUPPORT=no  node scripts/vote.mjs
NOTE=$NOTES_DIR/member-3.json PROPOSAL_ID=0 SUPPORT=yes node scripts/vote.mjs

echo "--- double vote attempt (must fail) ---"
if NOTE=$NOTES_DIR/member-1.json PROPOSAL_ID=0 SUPPORT=no node scripts/vote.mjs 2>/tmp/anon-vote-err.log; then
  echo "ERROR: double vote accepted"; exit 1
else echo "rejected as expected: $(grep -oE 'relayer rejected vote: [A-Za-z]+' /tmp/anon-vote-err.log | tail -1)"; fi

cast rpc evm_increaseTime 3601 --rpc-url $RPC_URL >/dev/null
cast rpc evm_mine --rpc-url $RPC_URL >/dev/null
PROPOSAL_ID=0 node scripts/tally.mjs
