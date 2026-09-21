#!/usr/bin/env bash
# Build the age_check Noir circuit into:
#   (a) the ACIR artifact the frontend prover loads with NoirJS + @aztec/bb.js
#   (b) a Solidity UltraHonk verifier for the foundry repo (Ethereum mainnet)
# then optionally smoke-test one real prove + verify against Prover.toml.
#
# Usage:
#   ./build.sh               # build only (what CI runs)
#   ./build.sh --smoke-test  # build, then prove + verify with Prover.toml inputs
#
# Env overrides:
#   CIRCUIT_DIR  path to the nargo package        (default: circuits/age_check)
#   OUT_DIR      where deliverables are collected (default: build)
#
# Toolchain (assumed installed): nargo (via `noirup -v <ver>`) and bb (via
# `bbup -v <ver>` -- pin it; bare `bbup` can resolve a mismatched version).
# The frontend's @aztec/bb.js MUST be the exact same version as this bb, or the
# onchain verifier generated here will reject browser-generated proofs.

set -euo pipefail

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
OUT_DIR="${OUT_DIR:-build}"
SMOKE_TEST=0
[[ "${1:-}" == "--smoke-test" ]] && SMOKE_TEST=1

# EVM target = keccak transcript + ZK. VK, verifier, prove and verify must all
# agree on this, and it must match `generateProof(witness, { verifierTarget: "evm" })`
# in the frontend. Proofs made for any other target will not verify onchain.
VERIFIER_TARGET="evm"

# Resolve absolute paths before we cd into the circuit.
REPO_ROOT="$(pwd)"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
cd "$CIRCUIT_DIR"

# Package name from Nargo.toml decides the artifact filenames (target/<name>.json).
CIRCUIT_NAME="$(sed -n 's/^name *= *"\(.*\)"/\1/p' Nargo.toml | head -n1)"
: "${CIRCUIT_NAME:?could not read package name from $CIRCUIT_DIR/Nargo.toml}"

# Record exact toolchain versions in the CI log and alongside the artifacts, so
# the frontend can pin @aztec/bb.js to the same bb version.
# Produces: $OUT_DIR/toolchain.txt
{
  echo "nargo: $(nargo --version | tr '\n' ' ')"
  echo "bb: $(bb --version)"
} | tee "$OUT_DIR/toolchain.txt"

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

# Clear stale outputs so CI never ships an artifact from a previous circuit.
rm -rf target

# Type-check and compile the circuit to ACIR.
# Produces: target/<name>.json  (bytecode + ABI -- deliverable (a), the file the
#           frontend passes to `new Noir(circuit)` and `new UltraHonkBackend(circuit.bytecode, ...)`)
nargo compile

# Run the circuit's own #[test] functions, if any. Fails the build on regressions.
# Produces: nothing on disk (pass/fail only)
nargo test

# Derive the verification key from the compiled circuit, for the EVM target.
# Produces: target/vk       (binary verification key, input to the Solidity verifier)
#           target/vk_hash  (hash of the VK)
bb write_vk \
  -b "target/${CIRCUIT_NAME}.json" \
  -o target \
  --verifier_target "$VERIFIER_TARGET"

# Generate the Solidity verifier from that VK.
# Produces: target/HonkVerifier.sol  (deliverable (b); contract exposes
#           verify(bytes proof, bytes32[] publicInputs) -- check the ABI rather
#           than assuming, and pass public inputs in the circuit's `pub` order)
# Foundry requirements for this file: pragma >=0.8.27 -> solc_version = '0.8.27',
# evm_version = 'cancun', optimizer on (unoptimized it exceeds the 24KB limit).
bb write_solidity_verifier \
  -k target/vk \
  -o target/HonkVerifier.sol

# Collect the deliverables in one place for CI to upload / copy.
# Produces: $OUT_DIR/<name>.json       -> frontend (e.g. copy into the app's public/ or src/)
#           $OUT_DIR/HonkVerifier.sol  -> foundry repo src/
#           $OUT_DIR/vk                -> kept for offchain verification / auditing
cp "target/${CIRCUIT_NAME}.json" "$OUT_DIR/${CIRCUIT_NAME}.json"
cp target/HonkVerifier.sol "$OUT_DIR/HonkVerifier.sol"
cp target/vk "$OUT_DIR/vk"

echo "Built: $OUT_DIR/${CIRCUIT_NAME}.json, $OUT_DIR/HonkVerifier.sol"

# ---------------------------------------------------------------------------
# Smoke test: one real proof from Prover.toml, verified with the same VK and
# target the Solidity verifier was generated from. Run locally before wiring the
# frontend: if this fails, the browser prover and the contract will too.
# ---------------------------------------------------------------------------
if [[ "$SMOKE_TEST" -eq 1 ]]; then
  # Solve the circuit with the known-good inputs in Prover.toml. Fails here if
  # any constraint (e.g. the age assertion) is unsatisfied.
  # Produces: target/<name>.gz  (compressed witness)
  nargo execute

  # Generate an UltraHonk proof over that witness, for the EVM target.
  # Produces: target/proof/proof          (proof bytes -> `proof` arg of verify())
  #           target/proof/public_inputs  (32-byte public inputs -> `publicInputs` arg)
  mkdir -p target/proof
  bb prove \
    -b "target/${CIRCUIT_NAME}.json" \
    -w "target/${CIRCUIT_NAME}.gz" \
    -k target/vk \
    -o target/proof \
    --verifier_target "$VERIFIER_TARGET"

  # Verify the proof offchain against the same VK the Solidity verifier embeds.
  # Produces: exit code 0 on success (set -e aborts the script otherwise)
  bb verify \
    -k target/vk \
    -p target/proof/proof \
    -i target/proof/public_inputs \
    --verifier_target "$VERIFIER_TARGET"

  echo "Smoke test passed: proof from Prover.toml verifies (target: $VERIFIER_TARGET)."
  echo "Proof artifacts left in $CIRCUIT_DIR/target/proof/ (e.g. for a forge test fixture)."
fi

cd "$REPO_ROOT"
