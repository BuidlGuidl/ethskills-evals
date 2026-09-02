#!/usr/bin/env bash
#
# build.sh — circuit source -> frontend artifact + Solidity verifier.
#
# Layout assumed (app repo):
#   circuits/age_check/Nargo.toml
#   circuits/age_check/src/main.nr
#   circuits/age_check/Prover.toml     # known-good test inputs
#
# Usage:
#   ./build.sh            # production build (what CI runs)
#   ./build.sh --smoke    # production build + local proof smoke test
#
# Assumes nargo and bb are already installed and on PATH.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CIRCUIT_NAME="age_check"                       # must match `name` in Nargo.toml
CIRCUIT_DIR="$ROOT/circuits/$CIRCUIT_NAME"
TARGET_DIR="$CIRCUIT_DIR/target"

# Hand-off destinations. Keep these stable — every other subsystem reads them.
FRONTEND_ARTIFACT_DIR="${FRONTEND_ARTIFACT_DIR:-$ROOT/frontend/public/circuits}"
VERIFIER_OUT_DIR="${VERIFIER_OUT_DIR:-$ROOT/dist/verifier}"   # copy into the foundry repo at src/verifiers/

RUN_SMOKE_TEST=0
[[ "${1:-}" == "--smoke" || "${1:-}" == "--smoke-test" ]] && RUN_SMOKE_TEST=1

# ---------------------------------------------------------------------------
# 0. Preflight
# ---------------------------------------------------------------------------

# Prints toolchain versions into the CI log. The bb version here MUST equal the
# @aztec/bb.js version the frontend installs — a mismatch changes proof
# serialization and onchain verification fails at runtime, not at build time.
nargo --version
bb --version

cd "$CIRCUIT_DIR"

# ---------------------------------------------------------------------------
# 1. Production build — this is the full CI sequence
# ---------------------------------------------------------------------------

# Compiles src/main.nr to ACIR bytecode + ABI.
# Produces: target/age_check.json  <- the artifact NoirJS loads in the frontend
nargo compile

# Derives the verification key from the compiled circuit.
# --oracle_hash keccak is REQUIRED for EVM verification; without it the proof
# transcript uses Poseidon and the Solidity verifier will reject valid proofs.
# Produces: target/vk
bb write_vk --oracle_hash keccak -b "target/$CIRCUIT_NAME.json" -o target/

# Generates the standalone Solidity verifier from the VK.
# (Command is `bb write_solidity_verifier` — `nargo codegen-verifier` and
# `bb contract` no longer exist.)
# Produces: target/Verifier.sol  <- contract HonkVerifier
bb write_solidity_verifier -k target/vk -o target/Verifier.sol

# ---------------------------------------------------------------------------
# 2. Publish artifacts to their stable locations
# ---------------------------------------------------------------------------

mkdir -p "$FRONTEND_ARTIFACT_DIR" "$VERIFIER_OUT_DIR"

# (a) Frontend prover input. Must live under public/ and be loaded with
#     fetch("/circuits/age_check.json") — bundler JSON imports break in Next.js.
cp "target/$CIRCUIT_NAME.json" "$FRONTEND_ARTIFACT_DIR/$CIRCUIT_NAME.json"

# (b) Solidity verifier, ready to drop into the foundry repo as
#     src/verifiers/HonkVerifier.sol. It is a SEPARATE deployment: deploy it
#     first, then pass its address to the app contract's constructor.
cp target/Verifier.sol "$VERIFIER_OUT_DIR/HonkVerifier.sol"

# (c) VK kept alongside for reproducibility / regenerating the verifier.
cp target/vk "$VERIFIER_OUT_DIR/vk"

echo "artifact : $FRONTEND_ARTIFACT_DIR/$CIRCUIT_NAME.json"
echo "verifier : $VERIFIER_OUT_DIR/HonkVerifier.sol"
echo "vk       : $VERIFIER_OUT_DIR/vk"

# Foundry repo requirements for the generated verifier (Ethereum mainnet):
#   [profile.default]
#   solc_version = '0.8.27'   # verifier needs pragma solidity >=0.8.21
#   evm_version  = 'cancun'
#   optimizer = true
#   optimizer_runs = 200      # unoptimized HonkVerifier exceeds the 24KB
#                             # EIP-170 limit — mainnet enforces it, no escape hatch.

[[ $RUN_SMOKE_TEST -eq 1 ]] || exit 0

# ---------------------------------------------------------------------------
# 3. Smoke test (local only — not part of the CI production build)
#
# Proves and verifies once against the known-good Prover.toml inputs, so a dev
# can confirm the circuit is sound before wiring up the frontend.
# Every command below uses --oracle_hash keccak to match the VK generated
# above; mixing hashes here produces a serialization mismatch, not a clear error.
# ---------------------------------------------------------------------------

# Runs the circuit on Prover.toml inputs and solves the witness.
# Fails here = bad inputs or a failing assert in main.nr.
# Produces: target/age_check.gz
nargo execute

# Generates a real UltraHonk proof from circuit + witness.
# Produces: target/proof, target/public_inputs
bb prove --oracle_hash keccak \
  -b "target/$CIRCUIT_NAME.json" \
  -w "target/$CIRCUIT_NAME.gz" \
  -o target/

# Verifies that proof against the VK. Exits non-zero if invalid.
bb verify --oracle_hash keccak \
  -p target/proof \
  -k target/vk \
  -i target/public_inputs

echo "smoke test OK — proof generated and verified against Prover.toml inputs"

# Note: this verifies offchain. The onchain path is only proven by deploying
# HonkVerifier.sol in the foundry repo and calling verify() with this proof —
# public input ORDER must match the circuit's `pub` params exactly.
