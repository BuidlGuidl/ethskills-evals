#!/usr/bin/env bash
# End-to-end on a fresh anvil: deploy, 3 members register, a proposal opens,
# member 1 votes yes via the relayer (others too), double vote is rejected, tally.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${ANVIL_PORT:-8546}
export RPC_URL=http://127.0.0.1:$PORT RELAYER_URL=http://127.0.0.1:${RELAYER_PORT:-8788}

# anvil default mnemonic: account 0 = deployer, 1..3 = members, 9 = relayer
K0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
K1=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
K2=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
K3=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
K9=0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6

anvil --silent --port $PORT & ANVIL=$!
trap 'kill $ANVIL ${RELAYER:-} 2>/dev/null || true' EXIT
until cast block-number --rpc-url $RPC_URL >/dev/null 2>&1; do sleep 0.2; done

[ -f circuits/vote/target/vote.json ] || scripts/build-circuit.sh
rm -rf .notes deployments/31337.json
scripts/deploy.sh --private-key $K0 >/dev/null
cat deployments/31337.json; echo

i=1; for K in $K1 $K2 $K3; do
  MEMBER_PRIVATE_KEY=$K node scripts/register.mjs --token $i; i=$((i+1))
done
MEMBER_PRIVATE_KEY=$K1 node scripts/create-proposal.mjs --token 1 --text "Fund the grants round" --period 3600

RELAYER_PRIVATE_KEY=$K9 PORT=${RELAYER_PORT:-8788} node scripts/relayer.mjs & RELAYER=$!
until curl -s -o /dev/null $RELAYER_URL; do sleep 0.2; done

REG=$(node -p 'require("./deployments/31337.json").registry.toLowerCase()')
FIRST_TX=$(node scripts/vote.mjs --note .notes/31337-$REG-token1.json --proposal 0 --vote yes | tee /dev/stderr | grep -o "0x[0-9a-f]\{64\}")
node scripts/vote.mjs --note .notes/31337-$REG-token2.json --proposal 0 --vote no
node scripts/vote.mjs --note .notes/31337-$REG-token3.json --proposal 0 --vote yes
echo "--- member 1 tries to vote again (client refuses):"
OUT=$(node scripts/vote.mjs --note .notes/31337-$REG-token1.json --proposal 0 --vote no 2>&1 || true)
grep -o "already voted on this proposal" <<<"$OUT" | head -1 || { echo "double vote NOT rejected"; exit 1; }
echo "--- replaying member 1's vote calldata straight at the contract (contract refuses):"
VOTING=$(node -p 'require("./deployments/31337.json").voting')
INPUT=$(cast tx "$FIRST_TX" input --rpc-url $RPC_URL)
OUT=$(cast call $VOTING "$INPUT" --rpc-url $RPC_URL 2>&1 || true)
grep -q "$(cast sig 'AlreadyVoted()')\|AlreadyVoted" <<<"$OUT" && echo "reverted: AlreadyVoted()" || { echo "replay NOT rejected: $OUT"; exit 1; }

echo "--- before deadline:"; node scripts/tally.mjs --proposal 0 >/dev/null 2>&1 && { echo "tally readable early"; exit 1; } || echo "result() reverts (VotingOpen)"
cast rpc evm_increaseTime 3601 --rpc-url $RPC_URL >/dev/null; cast rpc evm_mine --rpc-url $RPC_URL >/dev/null
echo "--- after deadline:"; node scripts/tally.mjs --proposal 0
