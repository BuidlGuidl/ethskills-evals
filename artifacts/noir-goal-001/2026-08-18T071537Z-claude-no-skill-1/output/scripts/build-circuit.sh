#!/usr/bin/env bash
# Compile the Noir circuit, derive its verification key, and regenerate the
# Solidity verifier the contracts build against.
#
# Run this after ANY change to circuits/private_vote -- the deployed verifier is
# keyed to one exact circuit, and a stale HonkVerifier.sol rejects every ballot.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT="$ROOT/circuits/private_vote"
OUT="$ROOT/contracts/src/verifier/HonkVerifier.sol"

echo "==> nargo compile"
(cd "$CIRCUIT" && nargo compile)

echo "==> nargo test"
(cd "$CIRCUIT" && nargo test)

echo "==> bb write_vk (target: evm)"
bb write_vk -b "$CIRCUIT/target/private_vote.json" -o "$CIRCUIT/target/vk" -t evm

# --optimized costs nothing and cuts on-chain verification from ~3.2M to
# ~1.4M gas per ballot. -t evm is the ZK target: the non-ZK Honk variants leak
# information about the witness, which here is the member's identity.
echo "==> bb write_solidity_verifier (optimized)"
bb write_solidity_verifier -k "$CIRCUIT/target/vk/vk" -o "$OUT" -t evm --optimized

echo "==> done: $OUT"
echo
echo "Next: regenerate the proof fixture the contract tests verify against —"
echo "  node scripts/make-fixture.js"
