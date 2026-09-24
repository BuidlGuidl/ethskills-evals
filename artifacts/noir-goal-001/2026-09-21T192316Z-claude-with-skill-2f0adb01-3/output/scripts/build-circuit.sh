#!/usr/bin/env bash
# Compile the ballot circuit, derive its verification key, and regenerate the
# Solidity verifier into the foundry project (contracts/src/verifiers/).
#
# Verifier target is `evm` = keccak transcript + ZERO-KNOWLEDGE Honk. Do not
# switch to `evm-no-zk` (or bb.js's deprecated `{ keccak: true }`): non-ZK
# proofs are not guaranteed to hide the witness, i.e. the voter's identity.
# The prover (scripts/member-vote.mjs) uses the same target.
set -euo pipefail
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUIT="$ROOT/circuits/vote"

cd "$CIRCUIT"
nargo test
nargo compile
bb write_vk -t evm -b target/vote.json -o target/
bb write_solidity_verifier -t evm -k target/vk -o "$ROOT/contracts/src/verifiers/HonkVerifier.sol"
echo "circuit artifact: circuits/vote/target/vote.json"
echo "verifier:         contracts/src/verifiers/HonkVerifier.sol"
