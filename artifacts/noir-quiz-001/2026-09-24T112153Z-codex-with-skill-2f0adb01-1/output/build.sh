#!/usr/bin/env bash
set -euo pipefail

# Build the age_check Noir circuit for Ethereum mainnet verification.
#
# Expected app layout:
#   circuits/age_check/Nargo.toml
#   circuits/age_check/src/main.nr
#   circuits/age_check/Prover.toml
#
# Optional overrides:
#   CIRCUIT_DIR=circuits/age_check
#   CIRCUIT_NAME=age_check
#   FRONTEND_ARTIFACT=frontend/public/circuits/age_check.json
#   FOUNDRY_VERIFIER=build/age_check/HonkVerifier.sol
#   VERIFIER_TARGET=evm
#   WITNESS_NAME=age_check

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$SCRIPT_DIR}"
CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
CIRCUIT_NAME="${CIRCUIT_NAME:-age_check}"
WITNESS_NAME="${WITNESS_NAME:-$CIRCUIT_NAME}"
FRONTEND_ARTIFACT="${FRONTEND_ARTIFACT:-frontend/public/circuits/age_check.json}"
FOUNDRY_VERIFIER="${FOUNDRY_VERIFIER:-build/age_check/HonkVerifier.sol}"
VERIFIER_TARGET="${VERIFIER_TARGET:-evm}"

CIRCUIT_PATH="$APP_ROOT/$CIRCUIT_DIR"
CIRCUIT_ARTIFACT="target/$CIRCUIT_NAME.json"
WITNESS_FILE="target/$WITNESS_NAME.gz"
GENERATED_VERIFIER="target/HonkVerifier.sol"

# Move to the app repo root so all relative output paths are stable in CI.
cd "$APP_ROOT"

# Verify the expected circuit source exists before producing artifacts.
test -f "$CIRCUIT_PATH/Nargo.toml"
test -f "$CIRCUIT_PATH/src/main.nr"
test -f "$CIRCUIT_PATH/Prover.toml"

# Enter the Noir package so nargo reads circuits/age_check/Nargo.toml and Prover.toml.
pushd "$CIRCUIT_PATH" >/dev/null

# Fetch Noir package dependencies into the CI cache / local Nargo cache.
nargo fetch

# Compile src/main.nr into the frontend-loadable ACIR artifact at target/age_check.json.
nargo compile

# Generate an Ethereum/Solidity-compatible verification key at target/vk.
bb write_vk -t "$VERIFIER_TARGET" -b "$CIRCUIT_ARTIFACT" -o target/

# Generate the optimized Solidity Honk verifier contract at target/HonkVerifier.sol.
bb write_solidity_verifier -t "$VERIFIER_TARGET" --optimized -k target/vk -o "$GENERATED_VERIFIER"

# Execute Prover.toml inputs and write the smoke-test witness to target/age_check.gz.
nargo execute "$WITNESS_NAME"

# Generate one smoke-test proof at target/proof and its public inputs at target/public_inputs.
bb prove -t "$VERIFIER_TARGET" -b "$CIRCUIT_ARTIFACT" -w "$WITNESS_FILE" -o target/

# Verify the smoke-test proof against target/vk and target/public_inputs.
bb verify -t "$VERIFIER_TARGET" -p target/proof -k target/vk -i target/public_inputs

# Return to the app repo root for handoff copies.
popd >/dev/null

# Create the frontend artifact destination directory.
mkdir -p "$(dirname -- "$FRONTEND_ARTIFACT")"

# Copy the ACIR JSON artifact to the path the frontend prover loads.
cp "$CIRCUIT_DIR/$CIRCUIT_ARTIFACT" "$FRONTEND_ARTIFACT"

# Create the Solidity verifier handoff destination directory.
mkdir -p "$(dirname -- "$FOUNDRY_VERIFIER")"

# Copy HonkVerifier.sol to the file ready to drop into the Foundry repo.
cp "$CIRCUIT_DIR/$GENERATED_VERIFIER" "$FOUNDRY_VERIFIER"

# The generated verifier is intended for mainnet EVM verification; compile it in
# Foundry with Solidity >=0.8.21, evm_version = "cancun", and optimizer enabled.
