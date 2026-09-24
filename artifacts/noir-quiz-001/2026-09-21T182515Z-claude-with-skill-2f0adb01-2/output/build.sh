#!/usr/bin/env bash
#
# build.sh — Noir circuit -> frontend artifact + Solidity verifier (Ethereum mainnet)
#
# Run from the app repo root. Expects the standard nargo layout:
#   circuits/age_check/Nargo.toml
#   circuits/age_check/src/main.nr
#   circuits/age_check/Prover.toml   (known-good inputs; used only by --smoke-test)
#
# Usage:
#   ./build.sh                # CI build: artifact + VK + verifier
#   ./build.sh --smoke-test   # CI build, then prove + verify one proof locally
#
# Toolchain: nargo + bb (Barretenberg) are assumed installed. Proving and
# verifying are done by `bb`; `nargo prove` / `nargo verify` no longer exist.
#
# Every bb command uses `--oracle_hash keccak`. That is what makes the VK and
# proofs verifiable by the Solidity verifier on the EVM. The frontend must match
# it with `backend.generateProof(witness, { keccak: true })`, or its proofs will
# be rejected onchain.

set -euo pipefail

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
OUT_DIR="${OUT_DIR:-build}"     # stable hand-off directory for CI to publish/copy from

SMOKE_TEST=0
if [[ "${1:-}" == "--smoke-test" ]]; then
  SMOKE_TEST=1
fi

# Resolve OUT_DIR to an absolute path before we cd into the circuit.
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

cd "$CIRCUIT_DIR"

# Read the package name from Nargo.toml. nargo names its output files after it
# (target/<name>.json, target/<name>.gz), so we don't hardcode it.
CIRCUIT_NAME="$(sed -n 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' Nargo.toml | head -n1)"
if [[ -z "$CIRCUIT_NAME" ]]; then
  echo "error: could not read package name from $CIRCUIT_DIR/Nargo.toml" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 0. Record toolchain versions
# ---------------------------------------------------------------------------
# Produces: version lines in the CI log. The frontend's @aztec/bb.js must be
# exactly the same version as this bb. If they differ, the proof serialization
# differs and onchain verification fails.
nargo --version
bb --version

# Start from a clean target/ so no stale artifact or VK from an earlier run
# can get published.
rm -rf target

# ---------------------------------------------------------------------------
# 1. Compile the circuit
# ---------------------------------------------------------------------------
# Produces: target/<name>.json, the compiled ACIR bytecode plus ABI.
# This is (a), the artifact the frontend prover (NoirJS + UltraHonkBackend) loads.
# Also fetches any git dependencies declared in Nargo.toml.
nargo compile

# ---------------------------------------------------------------------------
# 2. Generate the verification key (EVM flavor)
# ---------------------------------------------------------------------------
# Produces: target/vk, the verification key. The Solidity verifier is built
# from it, and the smoke test uses it for `bb verify`.
# --oracle_hash keccak is required for the onchain verifier.
bb write_vk --oracle_hash keccak -b "target/${CIRCUIT_NAME}.json" -o target/

# ---------------------------------------------------------------------------
# 3. Generate the Solidity verifier
# ---------------------------------------------------------------------------
# Produces: target/HonkVerifier.sol. This is (b), a standalone contract. Deploy
# it on its own and pass its address to the app contract's constructor.
# Notes for the foundry repo:
#   - requires pragma solidity >=0.8.21 and evm_version = "cancun"
#   - enable the optimizer (optimizer = true, optimizer_runs = 200); the
#     generated contract can otherwise exceed the 24KB EIP-170 size limit,
#     which mainnet enforces
#   - read the verify() signature and public-input order from this file;
#     don't guess them
bb write_solidity_verifier -k target/vk -o target/HonkVerifier.sol

# ---------------------------------------------------------------------------
# 4. Stage the hand-off artifacts
# ---------------------------------------------------------------------------
# Produces: $OUT_DIR/<name>.json  -> copy to the frontend (e.g. public/circuits/)
#           $OUT_DIR/HonkVerifier.sol -> copy to the foundry repo (e.g. src/verifiers/)
#           $OUT_DIR/vk            -> kept so the verifier can be regenerated/audited
cp "target/${CIRCUIT_NAME}.json" "$OUT_DIR/${CIRCUIT_NAME}.json"
cp target/HonkVerifier.sol       "$OUT_DIR/HonkVerifier.sol"
cp target/vk                     "$OUT_DIR/vk"

echo "Build complete:"
echo "  frontend artifact : $OUT_DIR/${CIRCUIT_NAME}.json"
echo "  solidity verifier : $OUT_DIR/HonkVerifier.sol"

if [[ "$SMOKE_TEST" -ne 1 ]]; then
  exit 0
fi

# ===========================================================================
# SMOKE TEST (local sanity check, optional)
# ===========================================================================
# Not part of the production build. It proves and verifies one proof from the
# known-good Prover.toml with the CLI, to confirm the circuit, VK and keccak
# settings agree before the frontend is wired up.

echo "Running smoke test against Prover.toml..."

# Produces: target/<name>.gz, the solved witness. Also checks every assert in
# main.nr against the Prover.toml inputs, so bad inputs or a broken circuit
# fail here with the assert message.
nargo execute

# Produces: target/proof and target/public_inputs, an UltraHonk proof built
# with the same keccak oracle that the Solidity verifier expects.
bb prove --oracle_hash keccak \
  -b "target/${CIRCUIT_NAME}.json" \
  -w "target/${CIRCUIT_NAME}.gz" \
  -o target/

# Produces: no file. Exits 0 if the proof verifies against the VK the
# Solidity verifier was generated from; any other exit code fails the script
# because of set -e.
bb verify --oracle_hash keccak \
  -p target/proof \
  -k target/vk \
  -i target/public_inputs

echo "Smoke test passed: proof verified against target/vk."
