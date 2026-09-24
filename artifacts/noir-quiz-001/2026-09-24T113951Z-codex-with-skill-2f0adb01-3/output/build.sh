#!/usr/bin/env bash
set -euo pipefail

# Build the age_check Noir circuit for an Ethereum mainnet verifier.
# Run from the app repo root. The circuit must use the standard nargo layout:
# circuits/age_check/Nargo.toml, circuits/age_check/src/main.nr, Prover.toml.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUIT_DIR="${ROOT_DIR}/circuits/age_check"
OUT_DIR="${ROOT_DIR}/artifacts/age_check"
FRONTEND_ARTIFACT="${OUT_DIR}/age_check.json"
SOLIDITY_VERIFIER="${OUT_DIR}/HonkVerifier.sol"

if [[ ! -f "${CIRCUIT_DIR}/Nargo.toml" ]]; then
  echo "Missing ${CIRCUIT_DIR}/Nargo.toml. Run this script from the app repo root." >&2
  exit 1
fi

if [[ ! -f "${CIRCUIT_DIR}/Prover.toml" ]]; then
  echo "Missing ${CIRCUIT_DIR}/Prover.toml. Smoke test needs known-good inputs." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

pushd "${CIRCUIT_DIR}" >/dev/null

# Produces target/<package>.json, the compiled ACIR circuit artifact.
nargo compile

PACKAGE_NAME="$(awk -F '"' '/^[[:space:]]*name[[:space:]]*=/ { print $2; exit }' Nargo.toml)"
CIRCUIT_JSON="target/${PACKAGE_NAME}.json"
WITNESS_GZ="target/${PACKAGE_NAME}.gz"

if [[ -z "${PACKAGE_NAME}" || ! -f "${CIRCUIT_JSON}" ]]; then
  echo "Could not find compiled circuit artifact at ${CIRCUIT_DIR}/${CIRCUIT_JSON}." >&2
  exit 1
fi

# Produces the frontend prover artifact loaded by NoirJS.
cp "${CIRCUIT_JSON}" "${FRONTEND_ARTIFACT}"

# Produces target/vk, the keccak-compatible verification key for EVM verification.
bb write_vk --oracle_hash keccak -b "${CIRCUIT_JSON}" -o target

# Produces the Solidity Honk verifier contract for the Foundry repo.
bb write_solidity_verifier -k target/vk -o "${SOLIDITY_VERIFIER}"

# Produces target/<package>.gz, the witness generated from Prover.toml inputs.
nargo execute

# Produces target/proof and target/public_inputs using the same keccak oracle hash as mainnet verification.
bb prove --oracle_hash keccak -b "${CIRCUIT_JSON}" -w "${WITNESS_GZ}" -o target

# Checks target/proof against target/vk and target/public_inputs as a local smoke test.
bb verify --oracle_hash keccak -p target/proof -k target/vk -i target/public_inputs

popd >/dev/null

echo "Frontend circuit artifact: ${FRONTEND_ARTIFACT}"
echo "Solidity verifier contract: ${SOLIDITY_VERIFIER}"
