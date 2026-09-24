#!/usr/bin/env bash
# End-to-end on a fresh anvil: deploy, 4 members join, one proposal, 3 anonymous
# votes through the relayer, a rejected double vote, deadline passes, tally.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${ANVIL_PORT:-8555}
export RPC_URL=http://127.0.0.1:$PORT
export RELAYER_URL=http://127.0.0.1:${RELAYER_PORT:-8787}
if cast block-number --rpc-url $RPC_URL >/dev/null 2>&1; then
  echo "something is already listening on $RPC_URL; set ANVIL_PORT" >&2; exit 1
fi

# anvil's well-known dev keys (never use on a real network)
DEPLOYER=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
M1=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
M2=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
M3=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
M4=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
RELAYER=0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6

anvil --port $PORT --silent & ANVIL=$!
trap 'kill $ANVIL ${RELAY:-} 2>/dev/null || true' EXIT
until cast block-number --rpc-url $RPC_URL >/dev/null 2>&1; do sleep 0.2; done

(cd circuits/vote && nargo compile)
MINT_TO=$(for k in $M1 $M2 $M3 $M4; do cast wallet address $k; done | paste -sd, -) \
MIN_ANONYMITY_SET=3 \
  forge script contracts/script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --private-key $DEPLOYER >/dev/null
cat deployments/31337.json; echo

rm -f notes/31337-*.json
i=1; for k in $M1 $M2 $M3 $M4; do MEMBER_KEY=$k TOKEN_ID=$i node scripts/register.mjs; i=$((i+1)); done

MEMBER_KEY=$M1 DESCRIPTION="Fund the grants round" VOTING_SECONDS=3600 node scripts/create-proposal.mjs

PORT=${RELAYER_PORT:-8787} RELAYER_KEY=$RELAYER node scripts/relayer.mjs & RELAY=$!
sleep 1

NOTE=notes/31337-1.json PROPOSAL_ID=0 VOTE=yes node scripts/vote.mjs
NOTE=notes/31337-2.json PROPOSAL_ID=0 VOTE=no  node scripts/vote.mjs
NOTE=notes/31337-3.json PROPOSAL_ID=0 VOTE=yes node scripts/vote.mjs
echo "--- member 1 tries to vote again (expect NullifierUsed):"
NOTE=notes/31337-1.json PROPOSAL_ID=0 VOTE=no node scripts/vote.mjs && exit 1 || true

PROPOSAL_ID=0 node scripts/tally.mjs
cast rpc evm_increaseTime 3601 --rpc-url $RPC_URL >/dev/null && cast rpc evm_mine --rpc-url $RPC_URL >/dev/null
PROPOSAL_ID=0 node scripts/tally.mjs
