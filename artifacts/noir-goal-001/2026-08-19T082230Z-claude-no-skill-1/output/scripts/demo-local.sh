#!/usr/bin/env bash
# End-to-end walkthrough on a local chain.
#
#   anvil                      # in another terminal
#   ./scripts/demo-local.sh
#
# Deploys, has MEMBERS members join, opens a proposal, casts three ballots
# through a relayer, shows a double vote being refused, jumps past the deadline
# and reads the tally.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
MEMBERS="${MEMBERS:-8}"
MNEMONIC="test test test test test test test test test test test junk"
FUNDER_KEY="${FUNDER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

# The relayer is deliberately account 200: it holds no membership NFT and never
# appears in the tree. All it does is pay gas for other people's ballots.
RELAYER_KEY="$(cast wallet private-key --mnemonic "$MNEMONIC" --mnemonic-index 200)"
RELAYER_ADDR="$(cast wallet address --private-key "$RELAYER_KEY")"

# A Yarn PnP loader inherited from an enclosing project hijacks module
# resolution and hides this directory's node_modules. Drop it if present.
case "${NODE_OPTIONS:-}" in *pnp*) unset NODE_OPTIONS ;; esac

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "no chain at $RPC_URL - start one with \`anvil\`" >&2
  exit 1
fi

step "deploy"
MEMBER_COUNT=150 ./scripts/deploy-local.sh | grep -E "membershipNFT|joinVerifier|voteVerifier|memberRegistry|privateBallot|minted"

step "fund the relayer ($RELAYER_ADDR)"
cast send "$RELAYER_ADDR" --value 10ether --private-key "$FUNDER_KEY" --rpc-url "$RPC_URL" >/dev/null
echo "funded with 10 ETH"

step "$MEMBERS members join the voting set"
for ((i = 0; i < MEMBERS; i++)); do
  node scripts/member-join.mjs --member "$i" --token "$i" | grep -E "^joined|registry now"
done

step "a member opens a proposal"
node scripts/create-proposal.mjs --proposer 0 --text "Fund the grants round" --hours 24

step "member 3 votes YES, relayed"
node scripts/member-vote.mjs --member 3 --proposal 0 --support yes --relayer "$RELAYER_KEY"

step "members 5 and 6 vote NO, relayed"
node scripts/member-vote.mjs --member 5 --proposal 0 --support no --relayer "$RELAYER_KEY" | tail -6
node scripts/member-vote.mjs --member 6 --proposal 0 --support no --relayer "$RELAYER_KEY" | tail -6

step "member 3 tries to vote a second time"
if node scripts/member-vote.mjs --member 3 --proposal 0 --support no --relayer "$RELAYER_KEY" >/dev/null 2>&1; then
  echo "FAIL: the double vote was accepted" >&2
  exit 1
fi
echo "refused, as it should be - the nullifier is already spent"

step "the tally before the deadline"
node scripts/read-tally.mjs --proposal 0 || true

step "jump past the deadline"
cast rpc evm_increaseTime 90000 --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
echo "24h later"

step "the tally after the deadline"
node scripts/read-tally.mjs --proposal 0

step "what a chain observer can see"
echo "every ballot arrived from the one relayer $RELAYER_ADDR;"
echo "none of the three carried a member address, a leaf index or a commitment."
