#!/usr/bin/env bash
# Compile the Noir circuit, derive its verification key and Solidity verifier,
# and copy the two hand-off artifacts into source folders:
#   circuits/vote/target/vote.json  -> scripts/artifacts/vote.json      (NoirJS prover)
#   circuits/vote/target/vk         -> contracts/src/verifiers/HonkVerifier.sol
# `-t evm` = keccak transcript + zero-knowledge UltraHonk. The prover
# (scripts/lib/prove.mjs) must use the same target.
set -euo pipefail
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/circuits/vote"

nargo test
nargo compile
bb write_vk -t evm -b target/vote.json -o target/
bb write_solidity_verifier -t evm -k target/vk -o target/HonkVerifier.sol

mkdir -p "$ROOT/scripts/artifacts" "$ROOT/contracts/src/verifiers"
cp target/vote.json "$ROOT/scripts/artifacts/vote.json"
cp target/HonkVerifier.sol "$ROOT/contracts/src/verifiers/HonkVerifier.sol"
echo "circuit artifact + HonkVerifier.sol updated"
