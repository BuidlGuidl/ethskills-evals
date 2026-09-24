#!/usr/bin/env bash
# End-to-end on a throwaway anvil chain: deploy, 5 members join, a proposal
# opens, every member votes via the relayer, time passes, anyone reads the tally.
set -euo pipefail
cd "$(dirname "$0")/.."
# Pick a free port pair so we never talk to some other chain already running.
PORT=${DEMO_PORT:-28545}
port_busy() { nc -z 127.0.0.1 "$1" 2>/dev/null; }
while port_busy $PORT || port_busy $((PORT + 1)); do PORT=$((PORT + 2)); done
export RPC_URL=http://127.0.0.1:$PORT
export RELAYER_URL=http://127.0.0.1:$((PORT + 1))

# anvil's default dev keys (index 0 = DAO admin, 1..5 = members, 9 = relayer)
KEYS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
)
RELAYER_KEY=0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
addr() { cast wallet address "$1"; }

[ -f circuits/vote/target/vote.json ] || ./scripts/build-circuit.sh

anvil --silent --port $PORT & ANVIL=$!
RELAYER=
trap 'kill $ANVIL ${RELAYER:-} 2>/dev/null || true' EXIT
until cast chain-id --rpc-url $RPC_URL >/dev/null 2>&1; do
  kill -0 $ANVIL 2>/dev/null || { echo "anvil failed to start on :$PORT"; exit 1; }
  sleep 0.2
done
echo "== local chain on :$PORT"

MEMBERS=$(for i in 1 2 3 4 5; do addr "${KEYS[$i]}"; done | paste -sd, -)
PRIVATE_KEY=${KEYS[0]} DEMO_MEMBERS=$MEMBERS MIN_ANONYMITY_SET=3 \
  forge script contracts/script/Deploy.s.sol --rpc-url $RPC_URL --broadcast -q
DEP=deployments/31337.json
GROUP=$(jq -r .memberGroup $DEP); VOTING=$(jq -r .anonymousVoting $DEP)

SECRETS=$(mktemp -d)
echo "== members join (each from their own NFT wallet)"
for i in 1 2 3 4 5; do
  MEMBER_PRIVATE_KEY=${KEYS[$i]} node scripts/member.mjs join --token-id $i --secret-file $SECRETS/m$i.json
done

echo "== member 1 opens proposal 1 (3 day voting period)"
cast send -q --rpc-url $RPC_URL $VOTING "createProposal(string,uint64)" "Fund the grants round?" 259200 --private-key ${KEYS[1]}

PORT=$((PORT + 1)) RELAYER_PRIVATE_KEY=$RELAYER_KEY node scripts/relayer.mjs & RELAYER=$!
until curl -s $RELAYER_URL >/dev/null; do sleep 0.2; done

echo "== members vote through the relayer"
VOTES=(_ --yes --no --yes --yes --no)
for i in 1 2 3 4 5; do
  node scripts/member.mjs vote --proposal 1 ${VOTES[$i]} --secret-file $SECRETS/m$i.json
done

echo "== member 3 tries to vote again (expect AlreadyVoted)"
node scripts/member.mjs vote --proposal 1 --no --secret-file $SECRETS/m3.json 2>&1 | tail -1 || true

echo "== tally before deadline (expect revert VotingOpen)"
cast call --rpc-url $RPC_URL $VOTING "tally(uint256)(uint256,uint256,uint256)" 1 2>&1 | tail -1 || true

cast rpc --rpc-url $RPC_URL evm_increaseTime 259201 >/dev/null && cast rpc --rpc-url $RPC_URL evm_mine >/dev/null
echo "== tally after deadline: yes, no, eligible"
cast call --rpc-url $RPC_URL $VOTING "tally(uint256)(uint256,uint256,uint256)" 1

echo "== which wallets sent VoteCast transactions:"
for h in $(cast logs --rpc-url $RPC_URL --from-block 0 --address $VOTING "VoteCast(uint256 indexed,bool,uint256)" --json | jq -r '.[].transactionHash'); do
  cast tx --rpc-url $RPC_URL $h from
done | sort | uniq -c
echo "   (relayer = $(addr $RELAYER_KEY); members = $MEMBERS)"
rm -rf "$SECRETS"
