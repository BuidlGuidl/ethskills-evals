#!/usr/bin/env bash
set -euo pipefail

# Build outputs are written relative to the app repo root by default.
ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
CIRCUIT_DIR="${CIRCUIT_DIR:-${ROOT_DIR}/circuits/age_check}"
BUILD_DIR="${BUILD_DIR:-${ROOT_DIR}/build/age_check}"
FRONTEND_DIR="${FRONTEND_DIR:-${BUILD_DIR}/frontend}"
SOLIDITY_DIR="${SOLIDITY_DIR:-${BUILD_DIR}/solidity}"
BB_DIR="${BB_DIR:-${BUILD_DIR}/bb}"
SMOKE_DIR="${SMOKE_DIR:-${BUILD_DIR}/smoke}"

cd "$CIRCUIT_DIR"

PACKAGE_NAME="${PACKAGE_NAME:-$(awk -F '"' '/^[[:space:]]*name[[:space:]]*=/{print $2; exit}' Nargo.toml)}"
if [[ -z "$PACKAGE_NAME" ]]; then
  echo "Could not read package name from ${CIRCUIT_DIR}/Nargo.toml" >&2
  exit 1
fi

CIRCUIT_JSON="${CIRCUIT_DIR}/target/${PACKAGE_NAME}.json"
FRONTEND_ARTIFACT="${FRONTEND_DIR}/age_check.json"
VK_PATH="${BB_DIR}/vk"
SOLIDITY_VERIFIER="${SOLIDITY_DIR}/AgeCheckVerifier.sol"
SMOKE_WITNESS_NAME="${SMOKE_WITNESS_NAME:-age_check_smoke}"
SMOKE_WITNESS_PATH="${CIRCUIT_DIR}/target/${SMOKE_WITNESS_NAME}.gz"
SMOKE_PROOF_PATH="${SMOKE_DIR}/proof"
SMOKE_PUBLIC_INPUTS_PATH="${SMOKE_DIR}/public_inputs"

# Produces stdout with the Noir compiler version captured in CI logs.
nargo --version

# Produces stdout with the Barretenberg backend version captured in CI logs.
bb --version

# Produces clean output directories for frontend, Solidity, bb, and smoke-test artifacts.
rm -rf "$BUILD_DIR"

# Produces the directory that will contain the frontend prover artifact.
mkdir -p "$FRONTEND_DIR"

# Produces the directory that will contain the generated Solidity verifier.
mkdir -p "$SOLIDITY_DIR"

# Produces the directory that will contain the Ethereum-targeted verification key.
mkdir -p "$BB_DIR"

# Produces the directory that will contain local smoke-test proof files.
mkdir -p "$SMOKE_DIR"

# Produces target/${PACKAGE_NAME}.json, the compiled Noir circuit artifact.
nargo compile --force

# Produces build/age_check/frontend/age_check.json for the browser prover to load with NoirJS.
cp "$CIRCUIT_JSON" "$FRONTEND_ARTIFACT"

# Produces build/age_check/bb/vk, a verification key using Keccak for Ethereum Solidity verification.
bb write_vk -s ultra_honk -b "$CIRCUIT_JSON" -o "$BB_DIR" --oracle_hash keccak

# Produces build/age_check/solidity/AgeCheckVerifier.sol, optimized and ready to copy into the Foundry repo.
bb write_solidity_verifier -s ultra_honk -k "$VK_PATH" -o "$SOLIDITY_VERIFIER" --optimized

# Produces target/${SMOKE_WITNESS_NAME}.gz by executing the circuit with circuits/age_check/Prover.toml.
nargo execute "$SMOKE_WITNESS_NAME"

# Produces build/age_check/smoke/proof and build/age_check/smoke/public_inputs from the Prover.toml witness.
bb prove -s ultra_honk -b "$CIRCUIT_JSON" -w "$SMOKE_WITNESS_PATH" -k "$VK_PATH" -o "$SMOKE_DIR" --oracle_hash keccak

# Produces a native verification result for the smoke proof; exits non-zero if the proof or public inputs fail.
bb verify -s ultra_honk -k "$VK_PATH" -p "$SMOKE_PROOF_PATH" -i "$SMOKE_PUBLIC_INPUTS_PATH" --oracle_hash keccak

echo "Frontend artifact: $FRONTEND_ARTIFACT"
echo "Solidity verifier: $SOLIDITY_VERIFIER"
echo "Smoke proof: $SMOKE_PROOF_PATH"
