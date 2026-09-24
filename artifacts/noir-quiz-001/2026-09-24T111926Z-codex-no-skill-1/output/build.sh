#!/usr/bin/env bash
set -euo pipefail

# Build artifacts for the age_check Noir circuit.
#
# Run this from the app repo root, where the circuit lives at:
#   circuits/age_check/Nargo.toml
#   circuits/age_check/src/main.nr
#   circuits/age_check/Prover.toml
#
# Optional overrides:
#   CIRCUIT_DIR=circuits/age_check
#   BUILD_DIR=build/age_check

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
BUILD_DIR="${BUILD_DIR:-build/age_check}"
FRONTEND_DIR="$BUILD_DIR/frontend"
SOLIDITY_DIR="$BUILD_DIR/solidity"
KEY_DIR="$BUILD_DIR/keys"
SMOKE_DIR="$BUILD_DIR/smoke"
WITNESS_NAME="${WITNESS_NAME:-age_check_smoke}"
VERIFIER_SOL="$SOLIDITY_DIR/AgeCheckVerifier.sol"

if [[ ! -f "$CIRCUIT_DIR/Nargo.toml" || ! -f "$CIRCUIT_DIR/src/main.nr" || ! -f "$CIRCUIT_DIR/Prover.toml" ]]; then
  echo "Missing expected Noir circuit layout under $CIRCUIT_DIR" >&2
  exit 1
fi

# Produces the Noir package name used for target/<package>.json.
PACKAGE_NAME="$(
  awk -F= '/^[[:space:]]*name[[:space:]]*=/ {
    gsub(/[[:space:]"]/, "", $2)
    print $2
    exit
  }' "$CIRCUIT_DIR/Nargo.toml"
)"

if [[ -z "$PACKAGE_NAME" ]]; then
  echo "Could not read package.name from $CIRCUIT_DIR/Nargo.toml" >&2
  exit 1
fi

CIRCUIT_ARTIFACT="$CIRCUIT_DIR/target/$PACKAGE_NAME.json"
FRONTEND_ARTIFACT="$FRONTEND_DIR/$PACKAGE_NAME.json"
VK_PATH="$KEY_DIR/vk"
WITNESS_PATH="$CIRCUIT_DIR/target/$WITNESS_NAME.gz"
PROOF_PATH="$SMOKE_DIR/proof"
PUBLIC_INPUTS_PATH="$SMOKE_DIR/public_inputs"

# Produces version lines in CI logs for reproducible build diagnostics.
nargo --version

# Produces version lines in CI logs for reproducible build diagnostics.
bb --version

# Produces clean output directories for frontend, Solidity, key, and smoke-test artifacts.
rm -rf "$BUILD_DIR"

# Produces the build artifact directory tree.
mkdir -p "$FRONTEND_DIR" "$SOLIDITY_DIR" "$KEY_DIR" "$SMOKE_DIR"

# Produces a dependency cache for the Noir package before compilation.
(cd "$CIRCUIT_DIR" && nargo fetch)

# Produces target/$PACKAGE_NAME.json, the compiled ACIR artifact consumed by frontend proving code.
(cd "$CIRCUIT_DIR" && nargo compile --deny-warnings)

# Produces build/age_check/frontend/$PACKAGE_NAME.json, the frontend prover artifact to ship with the app.
cp "$CIRCUIT_ARTIFACT" "$FRONTEND_ARTIFACT"

# Produces build/age_check/keys/vk, the Keccak verification key matching Ethereum/EVM verification.
bb write_vk \
  -b "$CIRCUIT_ARTIFACT" \
  -o "$KEY_DIR" \
  --oracle_hash keccak

# Produces build/age_check/solidity/AgeCheckVerifier.sol, the optimized verifier contract for Foundry.
bb write_solidity_verifier \
  -k "$VK_PATH" \
  -o "$VERIFIER_SOL" \
  --optimized

# Smoke test: generate a witness from Prover.toml, prove it, and verify the proof with the EVM-compatible VK.

# Produces target/$WITNESS_NAME.gz from circuits/age_check/Prover.toml.
(cd "$CIRCUIT_DIR" && nargo execute "$WITNESS_NAME" --prover-name Prover --deny-warnings)

# Produces build/age_check/smoke/proof and build/age_check/smoke/public_inputs.
bb prove \
  -b "$CIRCUIT_ARTIFACT" \
  -w "$WITNESS_PATH" \
  -o "$SMOKE_DIR" \
  --oracle_hash keccak

# Produces a successful native verification result for the smoke-test proof.
bb verify \
  -p "$PROOF_PATH" \
  -i "$PUBLIC_INPUTS_PATH" \
  -k "$VK_PATH" \
  --oracle_hash keccak

# Produces a concise manifest of the files CI should persist or hand to downstream repos.
printf '\nArtifacts ready:\n'
printf '  Frontend prover artifact: %s\n' "$FRONTEND_ARTIFACT"
printf '  Solidity verifier:        %s\n' "$VERIFIER_SOL"
printf '  Smoke proof:              %s\n' "$PROOF_PATH"
printf '  Smoke public inputs:      %s\n' "$PUBLIC_INPUTS_PATH"
