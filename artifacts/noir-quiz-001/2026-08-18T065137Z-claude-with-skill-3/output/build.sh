#!/usr/bin/env bash
#
# build.sh — circuit source -> frontend artifact + Solidity verifier.
#
# Assumes nargo + bb are installed and version-matched (bbup picks the bb that
# matches your nargo). Run from the repo root.
#
# Outputs:
#   frontend/public/circuits/age_check.json   <- artifact the browser prover loads
#   contracts/src/verifiers/HonkVerifier.sol  <- drop into the foundry repo
#
# Target chain is Ethereum mainnet, so every bb command uses
# --oracle_hash keccak. That flag must be identical across write_vk, prove,
# verify, and the frontend's generateProof({ keccak: true }) — mixing them
# produces serialization mismatches that only surface as a failed onchain
# verify.

set -euo pipefail

CIRCUIT_DIR="circuits/age_check"
CIRCUIT_NAME="age_check"          # must match `name` in Nargo.toml
FRONTEND_ARTIFACT_DIR="frontend/public/circuits"
VERIFIER_OUT_DIR="contracts/src/verifiers"

cd "$CIRCUIT_DIR"

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

# Compile src/main.nr to ACIR bytecode + ABI.
# Produces: target/age_check.json  (this is also the frontend artifact)
nargo compile

# Verification key for the compiled circuit.
# --oracle_hash keccak makes the VK (and every proof under it) EVM-verifiable.
# Produces: target/vk
bb write_vk --oracle_hash keccak -b "target/${CIRCUIT_NAME}.json" -o target/

# Solidity verifier generated from the VK. Contract name inside is HonkVerifier;
# it is standalone — deploy it, then pass its address to your app contract's
# constructor. Its ABI is the source of truth for how the app calls verify().
# Produces: target/Verifier.sol
bb write_solidity_verifier -k target/vk -o target/Verifier.sol

# ---------------------------------------------------------------------------
# Smoke test — local only, not needed to ship the artifacts above.
# Proves and verifies one proof against the known-good Prover.toml inputs so a
# dev can confirm the circuit is sound before wiring up the frontend.
# ---------------------------------------------------------------------------

# Execute the circuit against Prover.toml to produce a witness.
# Produces: target/age_check.gz
nargo execute

# Generate a real proof from that witness.
# Produces: target/proof, target/public_inputs
bb prove \
  --oracle_hash keccak \
  -b "target/${CIRCUIT_NAME}.json" \
  -w "target/${CIRCUIT_NAME}.gz" \
  -o target/

# Verify the proof against the VK. Non-zero exit fails the script (set -e),
# so CI catches a broken circuit here.
bb verify \
  --oracle_hash keccak \
  -p target/proof \
  -k target/vk \
  -i target/public_inputs

echo "smoke test passed: proof generated and verified"

# ---------------------------------------------------------------------------
# Hand-off — copy artifacts to their stable locations.
# ---------------------------------------------------------------------------

cd - >/dev/null

# Artifact the frontend fetches at runtime (Next.js can't import JSON across
# packages; it must be served from public/ and loaded with fetch()).
mkdir -p "$FRONTEND_ARTIFACT_DIR"
cp "${CIRCUIT_DIR}/target/${CIRCUIT_NAME}.json" "${FRONTEND_ARTIFACT_DIR}/${CIRCUIT_NAME}.json"

# Verifier source to copy into the foundry repo.
mkdir -p "$VERIFIER_OUT_DIR"
cp "${CIRCUIT_DIR}/target/Verifier.sol" "${VERIFIER_OUT_DIR}/HonkVerifier.sol"

echo "wrote ${FRONTEND_ARTIFACT_DIR}/${CIRCUIT_NAME}.json"
echo "wrote ${VERIFIER_OUT_DIR}/HonkVerifier.sol"

# ---------------------------------------------------------------------------
# Foundry-side requirements for the generated verifier (not enforced here):
#
#   [profile.default]
#   solc_version  = '0.8.27'   # verifier needs pragma >=0.8.21
#   evm_version   = 'cancun'
#   optimizer     = true
#   optimizer_runs = 200       # unoptimized HonkVerifier can exceed the 24KB
#                              # EIP-170 limit, which mainnet enforces
#
# The frontend must pin @aztec/bb.js to the exact `bb --version` used above;
# a version skew changes proof serialization and onchain verify() will revert.
# ---------------------------------------------------------------------------
