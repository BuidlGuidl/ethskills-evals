#!/usr/bin/env bash
# End-to-end run on a throwaway anvil chain:
#   deploy -> 3 members register -> proposal -> 3 relayed anonymous votes
#   -> a double vote is rejected -> deadline passes -> tally.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT_CHAIN=${ANVIL_PORT:-8546}
PORT_RELAY=${RELAYER_PORT:-8787}
export RPC_URL=http://127.0.0.1:$PORT_CHAIN

# anvil's well-known dev keys (never use on a real network)
DEPLOYER=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
M1=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
M2=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
M3=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
RELAYER=0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
addr() { cast wallet address "$1"; }

scripts/build-circuit.sh

for p in $PORT_CHAIN $PORT_RELAY; do
  if lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then echo "port $p is busy; set ANVIL_PORT / RELAYER_PORT"; exit 1; fi
done
anvil --silent --port $PORT_CHAIN &
ANVIL=$!
cleanup() { kill $ANVIL ${RELAY:-} 2>/dev/null || true; }
trap cleanup EXIT INT TERM PIPE
until cast block-number --rpc-url $RPC_URL >/dev/null 2>&1; do sleep 0.2; done

echo "== deploy (sender: deployer/admin wallet)"
(cd contracts && MEMBERS="$(addr $M1),$(addr $M2),$(addr $M3)" MIN_ANONYMITY_SET=3 \
  forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $DEPLOYER --broadcast -q)
cat deployments/31337.json; echo

echo "== members register identity commitments (sender: each member's NFT wallet)"
MEMBER_PRIVATE_KEY=$M1 TOKEN_ID=1 node scripts/register.mjs
MEMBER_PRIVATE_KEY=$M2 TOKEN_ID=2 node scripts/register.mjs
MEMBER_PRIVATE_KEY=$M3 TOKEN_ID=3 node scripts/register.mjs

echo "== proposal (sender: proposing member)"
PROPOSER_PRIVATE_KEY=$M1 node scripts/proposal.mjs create "Fund the grants round" 600

echo "== relayer (sender of every castVote)"
RELAYER_PRIVATE_KEY=$RELAYER PORT=$PORT_RELAY node scripts/relayer.mjs &
RELAY=$!
until curl -s -o /dev/null http://127.0.0.1:$PORT_RELAY/; do sleep 0.2; done

echo "== anonymous votes"
export PROPOSAL_ID=1 RELAYER_URL=http://127.0.0.1:$PORT_RELAY
MEMBER_PRIVATE_KEY=$M1 SUPPORT=yes node scripts/vote.mjs
MEMBER_PRIVATE_KEY=$M2 SUPPORT=no  node scripts/vote.mjs
MEMBER_PRIVATE_KEY=$M3 SUPPORT=yes node scripts/vote.mjs

echo "== member 1 tries to vote again (must fail)"
if MEMBER_PRIVATE_KEY=$M1 SUPPORT=no node scripts/vote.mjs; then echo "DOUBLE VOTE ACCEPTED"; exit 1; fi

echo "== after the deadline"
cast rpc evm_increaseTime 601 --rpc-url $RPC_URL >/dev/null
cast rpc evm_mine --rpc-url $RPC_URL >/dev/null
node scripts/proposal.mjs tally 1
