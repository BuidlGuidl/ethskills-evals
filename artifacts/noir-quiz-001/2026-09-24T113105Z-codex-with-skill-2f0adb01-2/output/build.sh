#!/usr/bin/env bash
set -euo pipefail

# Build the age_check Noir circuit for Ethereum mainnet verification.
#
# Expected app repo layout:
#   circuits/age_check/Nargo.toml
#   circuits/age_check/src/main.nr
#   circuits/age_check/Prover.toml
#
# Toolchain is assumed to be installed already:
#   nargo
#   bb

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
OUT_DIR="${OUT_DIR:-build/age_check}"
FRONTEND_ARTIFACT="${FRONTEND_ARTIFACT:-${OUT_DIR}/age_check.json}"
SOLIDITY_VERIFIER="${SOLIDITY_VERIFIER:-${OUT_DIR}/HonkVerifier.sol}"
RUN_SMOKE_TEST="${RUN_SMOKE_TEST:-1}"

if [[ ! -f "${CIRCUIT_DIR}/Nargo.toml" ]]; then
  echo "Missing ${CIRCUIT_DIR}/Nargo.toml. Run this from the app repo root or set CIRCUIT_DIR." >&2
  exit 1
fi

PACKAGE_NAME="$(
  sed -n 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "${CIRCUIT_DIR}/Nargo.toml" |
    head -n 1
)"

if [[ -z "${PACKAGE_NAME}" ]]; then
  echo "Could not read package.name from ${CIRCUIT_DIR}/Nargo.toml." >&2
  exit 1
fi

CIRCUIT_JSON="${CIRCUIT_DIR}/target/${PACKAGE_NAME}.json"
WITNESS_GZ="${CIRCUIT_DIR}/target/${PACKAGE_NAME}.gz"
VK_PATH="${CIRCUIT_DIR}/target/vk"
PROOF_PATH="${CIRCUIT_DIR}/target/proof"
PUBLIC_INPUTS_PATH="${CIRCUIT_DIR}/target/public_inputs"
GENERATED_VERIFIER="${CIRCUIT_DIR}/target/HonkVerifier.sol"

# Produces the handoff directory for the frontend artifact and Solidity verifier.
mkdir -p "${OUT_DIR}"

pushd "${CIRCUIT_DIR}" >/dev/null

# Produces target/${PACKAGE_NAME}.json, the ACIR circuit artifact consumed by NoirJS.
nargo compile

# Produces target/vk, the Barretenberg verification key using Keccak for EVM/mainnet compatibility.
bb write_vk --oracle_hash keccak -b "target/${PACKAGE_NAME}.json" -o target/

# Produces target/HonkVerifier.sol, the Solidity verifier contract generated from target/vk.
bb write_solidity_verifier -k target/vk -o target/HonkVerifier.sol

if [[ "${RUN_SMOKE_TEST}" == "1" ]]; then
  # Produces target/${PACKAGE_NAME}.gz, a witness generated from Prover.toml test inputs.
  nargo execute

  # Produces target/proof and target/public_inputs from the compiled circuit and witness.
  bb prove --oracle_hash keccak -b "target/${PACKAGE_NAME}.json" -w "target/${PACKAGE_NAME}.gz" -o target/

  # Checks target/proof against target/vk and target/public_inputs.
  bb verify --oracle_hash keccak -p target/proof -k target/vk -i target/public_inputs
fi

popd >/dev/null

# Produces build/age_check/age_check.json, the stable artifact path for the frontend prover.
cp "${CIRCUIT_JSON}" "${FRONTEND_ARTIFACT}"

# Produces build/age_check/HonkVerifier.sol, ready to copy into the Foundry repo.
cp "${GENERATED_VERIFIER}" "${SOLIDITY_VERIFIER}"

echo "Frontend circuit artifact: ${FRONTEND_ARTIFACT}"
echo "Solidity verifier contract: ${SOLIDITY_VERIFIER}"
if [[ "${RUN_SMOKE_TEST}" == "1" ]]; then
  echo "Smoke test proof: ${PROOF_PATH}"
  echo "Smoke test public inputs: ${PUBLIC_INPUTS_PATH}"
fi
