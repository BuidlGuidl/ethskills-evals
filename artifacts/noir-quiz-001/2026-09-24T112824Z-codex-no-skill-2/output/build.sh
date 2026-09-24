#!/usr/bin/env bash
set -euo pipefail

# Build pipeline for the age_check Noir circuit.
#
# Run from the app repo root, or set APP_ROOT to the repo checkout:
#   APP_ROOT=/path/to/app ./build.sh

APP_ROOT="$(cd "${APP_ROOT:-$(pwd)}" && pwd)"
RAW_CIRCUIT_DIR="${CIRCUIT_DIR:-$APP_ROOT/circuits/age_check}"
if [[ -d "$RAW_CIRCUIT_DIR" ]]; then
  CIRCUIT_DIR="$(cd "$RAW_CIRCUIT_DIR" && pwd)"
else
  CIRCUIT_DIR="$RAW_CIRCUIT_DIR"
fi
BUILD_DIR="${BUILD_DIR:-$APP_ROOT/build/age_check}"
BUILD_DIR="$(mkdir -p "$BUILD_DIR" && cd "$BUILD_DIR" && pwd)"
FRONTEND_ARTIFACT="$BUILD_DIR/frontend/age_check.json"
SOLIDITY_VERIFIER="$BUILD_DIR/solidity/AgeCheckVerifier.sol"
WITNESS_NAME="${WITNESS_NAME:-age_check_smoke}"
SCHEME="${SCHEME:-ultra_honk}"
ORACLE_HASH="${ORACLE_HASH:-keccak}"

if [[ ! -f "$CIRCUIT_DIR/Nargo.toml" ]]; then
  echo "Missing $CIRCUIT_DIR/Nargo.toml. Run this from the app repo root or set APP_ROOT." >&2
  exit 1
fi

if [[ ! -f "$CIRCUIT_DIR/Prover.toml" ]]; then
  echo "Missing $CIRCUIT_DIR/Prover.toml. The smoke test needs known-good prover inputs." >&2
  exit 1
fi

if [[ ! -f "$CIRCUIT_DIR/src/main.nr" ]]; then
  echo "Missing $CIRCUIT_DIR/src/main.nr." >&2
  exit 1
fi

PACKAGE_NAME="$(
  awk -F= '
    /^[[:space:]]*name[[:space:]]*=/ {
      gsub(/[[:space:]"]/, "", $2);
      print $2;
      exit;
    }
  ' "$CIRCUIT_DIR/Nargo.toml"
)"

if [[ -z "$PACKAGE_NAME" ]]; then
  echo "Could not read package name from $CIRCUIT_DIR/Nargo.toml." >&2
  exit 1
fi

CIRCUIT_ARTIFACT="$CIRCUIT_DIR/target/$PACKAGE_NAME.json"
WITNESS_PATH="$CIRCUIT_DIR/target/$WITNESS_NAME.gz"
VK_PATH="$CIRCUIT_DIR/target/vk"
PROOF_PATH="$BUILD_DIR/smoke/proof"
PUBLIC_INPUTS_PATH="$BUILD_DIR/smoke/public_inputs"

# Produces empty output directories for reproducible CI artifacts.
rm -rf "$BUILD_DIR"

# Produces frontend, Solidity, and smoke-test artifact directories.
mkdir -p "$BUILD_DIR/frontend" "$BUILD_DIR/solidity" "$BUILD_DIR/smoke"

# Produces a shell context rooted at the Noir package containing Nargo.toml.
pushd "$CIRCUIT_DIR" >/dev/null

# Produces target/$PACKAGE_NAME.json, the ACIR circuit artifact used by NoirJS/frontend provers.
nargo compile

# Produces build/age_check/frontend/age_check.json, the artifact the frontend prover should load.
cp "$CIRCUIT_ARTIFACT" "$FRONTEND_ARTIFACT"

# Produces target/vk, the Barretenberg verification key using Keccak challenges for Ethereum Solidity verification.
bb write_vk \
  -s "$SCHEME" \
  -b "$CIRCUIT_ARTIFACT" \
  -o "$CIRCUIT_DIR/target" \
  --oracle_hash "$ORACLE_HASH"

# Produces build/age_check/solidity/AgeCheckVerifier.sol, the Solidity verifier contract ready for the Foundry repo.
bb write_solidity_verifier \
  -s "$SCHEME" \
  -k "$VK_PATH" \
  -o "$SOLIDITY_VERIFIER" \
  --optimized

# Smoke test: generate and check one proof from the known-good Prover.toml inputs.

# Produces target/$WITNESS_NAME.gz, the witness generated from Prover.toml.
nargo execute "$WITNESS_NAME"

# Produces build/age_check/smoke/proof and build/age_check/smoke/public_inputs, and also checks the proof natively.
bb prove \
  -s "$SCHEME" \
  -b "$CIRCUIT_ARTIFACT" \
  -w "$WITNESS_PATH" \
  -o "$BUILD_DIR/smoke" \
  -k "$VK_PATH" \
  --oracle_hash "$ORACLE_HASH" \
  --verify

# Produces a final independent verification result for the smoke-test proof and public inputs.
bb verify \
  -s "$SCHEME" \
  -k "$VK_PATH" \
  -p "$PROOF_PATH" \
  -i "$PUBLIC_INPUTS_PATH" \
  --oracle_hash "$ORACLE_HASH"

# Produces the original shell context after building inside the circuit package.
popd >/dev/null

echo "Frontend prover artifact: $FRONTEND_ARTIFACT"
echo "Solidity verifier:        $SOLIDITY_VERIFIER"
echo "Smoke-test proof:         $PROOF_PATH"
echo "Smoke-test public inputs: $PUBLIC_INPUTS_PATH"
