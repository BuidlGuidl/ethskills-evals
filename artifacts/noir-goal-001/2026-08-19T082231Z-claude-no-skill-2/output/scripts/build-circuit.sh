#!/usr/bin/env bash
# Compile the Noir circuit and regenerate the Solidity verifier from its VK.
#
# The verifier is committed under src/verifiers/ because `forge build` needs it, but
# it is generated output - never hand-edit it, re-run this instead. Changing anything
# in circuits/vote/src changes the VK, which changes the verifier, which invalidates
# every previously generated proof (including test/fixtures/ballot.json).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT="$ROOT/circuits/vote"
VERIFIER_OUT="$ROOT/src/verifiers/HonkVerifier.sol"

# 'evm' = keccak transcript + zero knowledge. The '-no-zk' variants also verify
# onchain but do not hide the witness, and here the witness is the voter.
TARGET="evm"

echo "==> nargo test"
(cd "$CIRCUIT" && nargo test)

echo "==> nargo compile"
(cd "$CIRCUIT" && nargo compile)

echo "==> bb write_vk (target: $TARGET)"
bb write_vk -b "$CIRCUIT/target/vote.json" -o "$CIRCUIT/target" -t "$TARGET"

echo "==> bb write_solidity_verifier"
# --optimized cuts onchain verification from ~2.7M gas to ~0.92M.
bb write_solidity_verifier -k "$CIRCUIT/target/vk" -o "$VERIFIER_OUT" -t "$TARGET" --optimized

echo "==> forge build"
(cd "$ROOT" && forge build)

echo
echo "circuit:  $CIRCUIT/target/vote.json"
echo "verifier: $VERIFIER_OUT"
