#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUIT_DIR="${CIRCUIT_DIR:-"$ROOT_DIR/circuits/age_check"}"
BUILD_DIR="${BUILD_DIR:-"$ROOT_DIR/build/age_check"}"
SMOKE_DIR="$BUILD_DIR/smoke"
WITNESS_NAME="${WITNESS_NAME:-age_check_smoke}"

NARGO_TOML="$CIRCUIT_DIR/Nargo.toml"
PACKAGE_NAME="$(awk -F '"' '/^[[:space:]]*name[[:space:]]*=/ { print $2; exit }' "$NARGO_TOML")"

if [[ -z "$PACKAGE_NAME" ]]; then
  echo "Could not read [package].name from $NARGO_TOML" >&2
  exit 1
fi

CIRCUIT_ARTIFACT="$CIRCUIT_DIR/target/$PACKAGE_NAME.json"
FRONTEND_ARTIFACT="$BUILD_DIR/$PACKAGE_NAME.json"
VK_PATH="$BUILD_DIR/vk"
SOLIDITY_VERIFIER="$BUILD_DIR/AgeCheckVerifier.sol"
WITNESS_PATH="$CIRCUIT_DIR/target/$WITNESS_NAME.gz"
PROOF_PATH="$SMOKE_DIR/proof"
PUBLIC_INPUTS_PATH="$SMOKE_DIR/public_inputs"

# Creates the reproducible output directories for frontend, verifier, and smoke-test artifacts.
mkdir -p "$BUILD_DIR" "$SMOKE_DIR"

# Fetches Noir dependencies declared by circuits/age_check/Nargo.toml into the Nargo cache.
(cd "$CIRCUIT_DIR" && nargo fetch)

# Compiles circuits/age_check/src/main.nr into target/$PACKAGE_NAME.json, the ACIR artifact NoirJS loads.
(cd "$CIRCUIT_DIR" && nargo compile)

# Copies the compiled circuit JSON to build/age_check/$PACKAGE_NAME.json for the frontend prover bundle.
cp "$CIRCUIT_ARTIFACT" "$FRONTEND_ARTIFACT"

# Writes the Ethereum/Solidity verification key to build/age_check/vk using the EVM verifier target.
bb write_vk \
  --bytecode_path "$FRONTEND_ARTIFACT" \
  --output_path "$VK_PATH" \
  --verifier_target evm

# Generates an optimized Solidity verifier at build/age_check/AgeCheckVerifier.sol for the Foundry repo.
bb write_solidity_verifier \
  --vk_path "$VK_PATH" \
  --output_path "$SOLIDITY_VERIFIER" \
  --verifier_target evm \
  --optimized

# Executes Prover.toml inputs and writes target/$WITNESS_NAME.gz, the witness for the smoke proof.
(cd "$CIRCUIT_DIR" && nargo execute --prover-name Prover "$WITNESS_NAME")

# Generates an EVM-target smoke proof plus build/age_check/smoke/public_inputs from the Prover.toml witness.
bb prove \
  --bytecode_path "$FRONTEND_ARTIFACT" \
  --witness_path "$WITNESS_PATH" \
  --output_path "$SMOKE_DIR" \
  --verifier_target evm

# Verifies the smoke proof against build/age_check/vk and build/age_check/smoke/public_inputs.
bb verify \
  --proof_path "$PROOF_PATH" \
  --vk_path "$VK_PATH" \
  --public_inputs_path "$PUBLIC_INPUTS_PATH" \
  --verifier_target evm

# Prints the generated artifact paths for CI logs.
echo "Frontend artifact: $FRONTEND_ARTIFACT"
echo "Solidity verifier: $SOLIDITY_VERIFIER"
echo "Smoke proof verified: $PROOF_PATH"
