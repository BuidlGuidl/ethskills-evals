#!/usr/bin/env bash
# Compile the circuit and regenerate the Solidity verifier from its VK.
# Rerun after ANY change to circuits/vote — the verifier is tied to the exact circuit.
set -euo pipefail
cd "$(dirname "$0")/../circuits/vote"
nargo test
nargo compile
bb write_vk -b target/vote.json -o target --verifier_target evm
bb write_solidity_verifier -k target/vk -o ../../contracts/src/VoteVerifier.sol --verifier_target evm
