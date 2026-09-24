#!/usr/bin/env bash
set -euo pipefail

# Build the Noir age_check circuit into the browser prover artifact and the
# Solidity verifier used by the Foundry contracts.
#
# Run from the app repo root. Override these env vars in CI only if the repo
# layout changes.

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
CIRCUIT_NAME="${CIRCUIT_NAME:-age_check}"
VERIFIER_NAME="${VERIFIER_NAME:-AgeCheckVerifier.sol}"
FRONTEND_ARTIFACT_DIR="${FRONTEND_ARTIFACT_DIR:-artifacts/noir}"
SOLIDITY_ARTIFACT_DIR="${SOLIDITY_ARTIFACT_DIR:-artifacts/solidity}"
SMOKE_WITNESS_NAME="${SMOKE_WITNESS_NAME:-smoke_age_check}"

ROOT_DIR="$(pwd)"
CIRCUIT_PATH="${ROOT_DIR}/${CIRCUIT_DIR}"
FRONTEND_ARTIFACT_PATH="${ROOT_DIR}/${FRONTEND_ARTIFACT_DIR}/${CIRCUIT_NAME}.json"
SOLIDITY_VERIFIER_PATH="${ROOT_DIR}/${SOLIDITY_ARTIFACT_DIR}/${VERIFIER_NAME}"

# Produces an early failure if the Noir circuit package is not present.
test -f "${CIRCUIT_PATH}/Nargo.toml"

# Produces an early failure if the known-good prover inputs are not present.
test -f "${CIRCUIT_PATH}/Prover.toml"

# Produces output directories for the frontend artifact and Solidity verifier.
mkdir -p "${ROOT_DIR}/${FRONTEND_ARTIFACT_DIR}" "${ROOT_DIR}/${SOLIDITY_ARTIFACT_DIR}"

# Produces a working directory scoped to the Noir package.
cd "${CIRCUIT_PATH}"

# Produces fetched Noir dependencies for this package.
nargo fetch

# Produces the compiled ACIR circuit artifact at target/${CIRCUIT_NAME}.json.
nargo compile

# Produces the frontend prover artifact at ${FRONTEND_ARTIFACT_DIR}/${CIRCUIT_NAME}.json.
cp "target/${CIRCUIT_NAME}.json" "${FRONTEND_ARTIFACT_PATH}"

# Produces the Keccak-transcript verification key at target/vk for Ethereum proofs.
bb write_vk \
  -b "target/${CIRCUIT_NAME}.json" \
  --oracle_hash keccak \
  -o target/vk

# Produces the Solidity verifier contract at target/${VERIFIER_NAME}.
bb write_solidity_verifier \
  -k target/vk \
  -o "target/${VERIFIER_NAME}"

# Produces the Foundry-ready verifier copy at ${SOLIDITY_ARTIFACT_DIR}/${VERIFIER_NAME}.
cp "target/${VERIFIER_NAME}" "${SOLIDITY_VERIFIER_PATH}"

echo "Build artifacts ready:"
echo "  frontend prover artifact: ${FRONTEND_ARTIFACT_PATH}"
echo "  Solidity verifier:        ${SOLIDITY_VERIFIER_PATH}"

echo "Running smoke test with ${CIRCUIT_DIR}/Prover.toml..."

# Produces a witness from the known-good Prover.toml inputs at target/${SMOKE_WITNESS_NAME}.gz.
nargo execute "${SMOKE_WITNESS_NAME}"

# Produces a Keccak-transcript proof for the smoke witness at target/smoke_proof.
bb prove \
  -b "target/${CIRCUIT_NAME}.json" \
  -w "target/${SMOKE_WITNESS_NAME}.gz" \
  --oracle_hash keccak \
  -o target/smoke_proof

# Produces a local verification check of target/smoke_proof against target/vk.
bb verify \
  -p target/smoke_proof \
  -k target/vk \
  --oracle_hash keccak

echo "Smoke test passed."
