#!/usr/bin/env bash
# Deploy NFT + verifier + AnonVoting to a local anvil chain and mint demo NFTs.
# Start the chain first:  anvil
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
MNEMONIC="test test test test test test test test test test test junk"
# anvil account 0 deploys and owns the demo NFT.
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

if [[ -z "${DEMO_MEMBERS:-}" ]]; then
  # anvil accounts 1..5 are the demo members (token ids 1..5).
  addrs=()
  for i in 1 2 3 4 5; do addrs+=("$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index "$i")"); done
  DEMO_MEMBERS="$(IFS=,; echo "${addrs[*]}")"
fi
export DEMO_MEMBERS MIN_ANONYMITY_SET="${MIN_ANONYMITY_SET:-3}"

[[ -f circuits/vote/target/anon_vote.json ]] || (cd circuits/vote && nargo compile)

forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" --broadcast
