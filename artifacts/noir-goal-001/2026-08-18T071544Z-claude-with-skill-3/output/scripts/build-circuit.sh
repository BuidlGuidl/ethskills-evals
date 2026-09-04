#!/usr/bin/env bash
# Compile the ballot circuit and regenerate the Solidity verifier.
#
# Run this after any change to circuits/ballot/src/main.nr, then regenerate the
# test fixtures (node js/fixtures.mjs) — the proof format changes with the circuit.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root/circuits/ballot"

echo "==> nargo compile"
nargo compile

echo "==> bb write_vk (verifier target: evm = keccak transcript + ZK)"
bb write_vk --verifier_target evm -b target/ballot.json -o target/

echo "==> bb write_solidity_verifier -> contracts/src/verifiers/HonkVerifier.sol"
bb write_solidity_verifier -k target/vk -o "$root/contracts/src/verifiers/HonkVerifier.sol"

echo
echo "done. next:"
echo "  node js/fixtures.mjs      # regenerate proofs used by forge test"
echo "  cd contracts && forge test"
