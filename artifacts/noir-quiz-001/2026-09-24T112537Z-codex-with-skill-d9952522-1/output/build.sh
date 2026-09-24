#!/usr/bin/env bash
set -euo pipefail

# Build the Noir age_check circuit and its Ethereum-mainnet Solidity verifier.
# Run this from the app repo root. Override APP_ROOT or CIRCUIT_DIR in CI if needed.

APP_ROOT="${APP_ROOT:-$(pwd)}"
CIRCUIT_DIR="${CIRCUIT_DIR:-${APP_ROOT}/circuits/age_check}"
ARTIFACT_ROOT="${ARTIFACT_ROOT:-${APP_ROOT}/artifacts/age_check}"
FRONTEND_ARTIFACT_DIR="${FRONTEND_ARTIFACT_DIR:-${ARTIFACT_ROOT}/frontend}"
SOLIDITY_ARTIFACT_DIR="${SOLIDITY_ARTIFACT_DIR:-${ARTIFACT_ROOT}/solidity}"
SMOKE_DIR="${SMOKE_DIR:-${ARTIFACT_ROOT}/smoke}"

if [ ! -f "${CIRCUIT_DIR}/Nargo.toml" ]; then
  echo "Missing ${CIRCUIT_DIR}/Nargo.toml; run from the app repo root or set CIRCUIT_DIR." >&2
  exit 1
fi

PACKAGE_NAME="$(
  awk -F= '
    /^[[:space:]]*name[[:space:]]*=/ {
      gsub(/[[:space:]"]/, "", $2)
      print $2
      exit
    }
  ' "${CIRCUIT_DIR}/Nargo.toml"
)"

if [ -z "${PACKAGE_NAME}" ]; then
  echo "Could not read package.name from ${CIRCUIT_DIR}/Nargo.toml." >&2
  exit 1
fi

CIRCUIT_ARTIFACT="${CIRCUIT_DIR}/target/${PACKAGE_NAME}.json"
VK_PATH="${CIRCUIT_DIR}/target/vk"
FRONTEND_ARTIFACT="${FRONTEND_ARTIFACT_DIR}/${PACKAGE_NAME}.json"
SOLIDITY_VERIFIER="${SOLIDITY_ARTIFACT_DIR}/${PACKAGE_NAME}_Verifier.sol"
WITNESS_NAME="${WITNESS_NAME:-${PACKAGE_NAME}_smoke}"
WITNESS_PATH="${CIRCUIT_DIR}/target/${WITNESS_NAME}.gz"
SMOKE_PROOF="${SMOKE_DIR}/proof"
SMOKE_PUBLIC_INPUTS="${SMOKE_DIR}/public_inputs"

# Produces artifact output directories for the frontend circuit JSON, Solidity verifier, and smoke proof files.
mkdir -p "${FRONTEND_ARTIFACT_DIR}" "${SOLIDITY_ARTIFACT_DIR}" "${SMOKE_DIR}"

# Runs Nargo from the circuit package directory so the standard nested layout does not need a repo-root workspace.
cd "${CIRCUIT_DIR}"

# Produces target/${PACKAGE_NAME}.json, the compiled Noir circuit artifact consumed by NoirJS/frontend proving.
nargo compile

# Produces artifacts/age_check/frontend/${PACKAGE_NAME}.json, the stable frontend prover artifact to publish from CI.
cp "${CIRCUIT_ARTIFACT}" "${FRONTEND_ARTIFACT}"

# Produces target/vk, the EVM-targeted verification key used by both the Solidity verifier and EVM proof checks.
bb write_vk -b "${CIRCUIT_ARTIFACT}" --verifier_target evm -o "${VK_PATH}"

# Produces artifacts/age_check/solidity/${PACKAGE_NAME}_Verifier.sol, the Solidity verifier to copy into the foundry repo.
bb write_solidity_verifier -k "${VK_PATH}" -o "${SOLIDITY_VERIFIER}"

# Smoke test: prove and verify once with the known-good inputs in circuits/age_check/Prover.toml.

# Produces target/${WITNESS_NAME}.gz, the witness generated from Prover.toml.
nargo execute --prover-name Prover "${WITNESS_NAME}"

# Produces artifacts/age_check/smoke/proof and artifacts/age_check/smoke/public_inputs for the EVM-targeted proof.
bb prove -b "${CIRCUIT_ARTIFACT}" -w "${WITNESS_PATH}" --verifier_target evm -o "${SMOKE_DIR}"

# Checks artifacts/age_check/smoke/proof and public_inputs against target/vk; exits non-zero if the Prover.toml proof is invalid.
bb verify -p "${SMOKE_PROOF}" -k "${VK_PATH}" -i "${SMOKE_PUBLIC_INPUTS}"

echo "Frontend artifact: ${FRONTEND_ARTIFACT}"
echo "Solidity verifier: ${SOLIDITY_VERIFIER}"
echo "Smoke proof: ${SMOKE_PROOF}"
echo "Smoke public inputs: ${SMOKE_PUBLIC_INPUTS}"
