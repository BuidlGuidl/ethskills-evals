#!/usr/bin/env bash
# End-to-end run on a fresh anvil chain:
#   deploy → mint 5 membership NFTs → 5 members register → proposal →
#   3 anonymous ballots via the relayer (+1 via an unlinked sender wallet) →
#   double-vote rejected → deadline passes → tally.
# Anvil accounts: 0 = DAO admin/deployer, 1..5 = members, 8 = unlinked sender, 9 = relayer.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${DEMO_PORT:-18555}"   # own anvil, so an existing node on 8545 is left alone
export RPC_URL="http://127.0.0.1:$PORT"
MNEMONIC="test test test test test test test test test test test junk"
key() { cast wallet private-key --mnemonic "$MNEMONIC" --mnemonic-index "$1"; }
addr() { cast wallet address "$(key "$1")"; }

if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then echo "port $PORT is busy; set DEMO_PORT" >&2; exit 1; fi
anvil --port "$PORT" > "${ANVIL_LOG:-/dev/null}" 2>&1 & ANVIL=$!
RELAYER=""
trap 'kill $ANVIL ${RELAYER:-} 2>/dev/null || true' EXIT
until cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; do sleep 0.2; done

rm -rf notes
MIN_ANONYMITY_SET=5 PRIVATE_KEY="$(key 0)" bash scripts/deploy-local.sh
DEP="deployments/$(cast chain-id --rpc-url $RPC_URL).json"
NFT=$(node -p "require('./$DEP').membershipNFT")
VOTING=$(node -p "require('./$DEP').voting")

echo "== admin mints membership NFTs (tokens 1..5 → accounts 1..5)"
for i in 1 2 3 4 5; do
  cast send -q "$NFT" "mint(address)" "$(addr $i)" --private-key "$(key 0)" --rpc-url "$RPC_URL"
done

echo "== each member registers an identity commitment from their NFT wallet"
for i in 1 2 3 4 5; do
  MEMBER_PRIVATE_KEY="$(key $i)" TOKEN_ID=$i node scripts/member-register.mjs
done

echo "== member 1 opens proposal 1 (deadline +1h)"
DEADLINE=$(( $(cast block latest -f timestamp --rpc-url $RPC_URL) + 3600 ))
cast send -q "$VOTING" "createProposal(uint256,bytes32,uint64)" 1 "$(cast keccak 'Fund the grants program?')" "$DEADLINE" \
  --private-key "$(key 1)" --rpc-url "$RPC_URL"

echo "== relayer up"
RELAYER_PRIVATE_KEY="$(key 9)" RELAY_JITTER_MS=0 PORT=${RELAYER_PORT:-18788} node scripts/relayer.mjs & RELAYER=$!
sleep 1

echo "== ballots"
NOTE=notes/member-2.json PROPOSAL_ID=1 VOTE=yes RELAYER_URL=http://127.0.0.1:${RELAYER_PORT:-18788} node scripts/member-vote.mjs
NOTE=notes/member-3.json PROPOSAL_ID=1 VOTE=no  RELAYER_URL=http://127.0.0.1:${RELAYER_PORT:-18788} node scripts/member-vote.mjs
NOTE=notes/member-4.json PROPOSAL_ID=1 VOTE=yes RELAYER_URL=http://127.0.0.1:${RELAYER_PORT:-18788} node scripts/member-vote.mjs
NOTE=notes/member-5.json PROPOSAL_ID=1 VOTE=yes SENDER_PRIVATE_KEY="$(key 8)" node scripts/member-vote.mjs

echo "== member 2 tries to vote again (must fail)"
if NOTE=notes/member-2.json PROPOSAL_ID=1 VOTE=no RELAYER_URL=http://127.0.0.1:${RELAYER_PORT:-18788} node scripts/member-vote.mjs 2>&1 | grep -m1 "Error:"; then :; fi
echo "== member 1 tries to send its ballot from its own NFT wallet (script refuses)"
if NOTE=notes/member-1.json PROPOSAL_ID=1 VOTE=no SENDER_PRIVATE_KEY="$(key 1)" node scripts/member-vote.mjs 2>&1 | grep -m1 "Error:"; then :; fi

echo "== deadline passes"
cast rpc -q evm_increaseTime 3601 --rpc-url "$RPC_URL" >/dev/null
cast rpc -q evm_mine --rpc-url "$RPC_URL" >/dev/null
PROPOSAL_ID=1 node scripts/tally.mjs
