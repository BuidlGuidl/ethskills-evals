#!/usr/bin/env bash
# End-to-end walkthrough on a local chain: five members join, one proposal is
# opened, two members vote through a relayer, a double vote is refused, and the
# tally is read after the deadline.
#
#   1. anvil                       (in another terminal)
#   2. ./scripts/demo-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export RPC_URL=${RPC_URL:-http://127.0.0.1:8545}

# Some toolchains inject a Yarn PnP loader through NODE_OPTIONS, which hides
# this project's own node_modules. Run node with a clean slate.
node() { env -u NODE_OPTIONS "$(command -v node)" "$@"; }

if [ ! -f circuits/vote/target/vote.json ]; then
  echo "== compiling the circuit =="
  (cd circuits/vote && nargo compile)
fi

echo "== deploying =="
./scripts/deploy-local.sh >/dev/null
cat "deployments/$(cast chain-id --rpc-url "$RPC_URL").json"

# anvil accounts 1..5 are the demo members, account 9 is the relayer.
KEYS=(
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
)

echo
echo "== five members join the anonymity set =="
for key in "${KEYS[@]}"; do
  node js/register.js --member-key "$key" | grep -E "member wallet|leaf index"
done

echo
echo "== a member opens a proposal =="
node js/propose.js --text "Fund the grants round?" --hours 24

PROPOSAL=$(cast call "$(node -e 'console.log(require("./deployments/31337.json").ballot)')" \
  "proposalCount()(uint256)" --rpc-url "$RPC_URL")

echo
echo "== member 1 votes yes, relayed by anvil account 9 =="
node js/vote.js --proposal "$PROPOSAL" --support yes --member-key "${KEYS[0]}"

echo
echo "== member 2 votes no, relayed by anvil account 8 =="
node js/vote.js --proposal "$PROPOSAL" --support no --member-key "${KEYS[1]}" \
  --relayer-key 0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97 | tail -8

echo
echo "== member 1 tries to vote again =="
SECOND_ATTEMPT=$(node js/vote.js --proposal "$PROPOSAL" --support no --member-key "${KEYS[0]}" 2>&1 || true)
if echo "$SECOND_ATTEMPT" | grep -q "already voted"; then
  echo "refused: the nullifier for (this member, this proposal) is already spent"
else
  echo "UNEXPECTED: the second ballot was not refused" >&2
  echo "$SECOND_ATTEMPT" >&2
  exit 1
fi

echo
echo "== the tally, after the deadline =="
node js/tally.js --proposal "$PROPOSAL" --warp
