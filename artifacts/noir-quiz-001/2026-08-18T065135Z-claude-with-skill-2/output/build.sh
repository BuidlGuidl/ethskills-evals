#!/usr/bin/env bash
#
# build.sh — circuit source -> frontend prover artifact + Solidity verifier.
#
# Run from the app repo root (the repo containing circuits/age_check/).
# Assumes nargo and bb are already installed and version-matched
# (bbup picks the bb that matches your nargo — mismatches break proof
# serialization and onchain verification).
#
# Outputs:
#   frontend/public/circuits/age_check.json   -> loaded by NoirJS in the browser
#   dist/verifier/HonkVerifier.sol            -> drop into the foundry repo
#   dist/verifier/vk                          -> verification key (keep with the verifier)
#
# Smoke test (SKIP_SMOKE=1 to skip, e.g. in CI): generates and verifies one
# proof from Prover.toml. Not part of the production build.

set -euo pipefail

CIRCUIT_DIR="circuits/age_check"
CIRCUIT_NAME="age_check"          # must match `name` in Nargo.toml
FRONTEND_ARTIFACT_DIR="frontend/public/circuits"
VERIFIER_OUT_DIR="dist/verifier"

# --- 0. Toolchain versions ---------------------------------------------------
# Printed into the CI log so a bad proof can be traced back to a toolchain bump.
# The frontend's @aztec/bb.js version must exactly match this bb version.
nargo --version
bb --version

cd "$CIRCUIT_DIR"

# --- 1. Compile --------------------------------------------------------------
# Produces target/age_check.json — the ACIR circuit artifact. This is the file
# NoirJS loads (UltraHonkBackend reads .bytecode from it) and the file bb takes
# as -b on every command below.
nargo compile

# --- 2. Execute --------------------------------------------------------------
# Reads Prover.toml and produces target/age_check.gz — the witness (solved
# values for every wire). Needed for the smoke-test proof below; also fails
# fast in CI if the circuit's constraints don't hold for known-good inputs.
nargo execute

# --- 3. Verification key -----------------------------------------------------
# Produces target/vk — the UltraHonk verification key.
# --oracle_hash keccak is REQUIRED for onchain verification: it makes the
# Fiat-Shamir transcript use keccak, which is what the Solidity verifier can
# compute cheaply on the EVM. Every bb command in this script uses the same
# flag; mixing hashes silently produces proofs that fail onchain.
bb write_vk --oracle_hash keccak -b "target/${CIRCUIT_NAME}.json" -o target/

# --- 4. Solidity verifier ----------------------------------------------------
# Produces target/Verifier.sol — a standalone HonkVerifier contract generated
# from the VK. It is deployed on its own; your app contract takes its deployed
# address in the constructor. Its ABI is the source of truth for the
# proof/public-input encoding — read it before writing the app-side interface.
bb write_solidity_verifier -k target/vk -o target/Verifier.sol

cd - >/dev/null

# --- 5. Publish artifacts to their stable locations --------------------------
# Fixed paths so the frontend and the foundry repo never hand-copy files ad hoc.
mkdir -p "$FRONTEND_ARTIFACT_DIR" "$VERIFIER_OUT_DIR"

# Circuit artifact the frontend prover fetches at runtime
# (Next.js can't import JSON across packages — it must be served from public/).
cp "${CIRCUIT_DIR}/target/${CIRCUIT_NAME}.json" "${FRONTEND_ARTIFACT_DIR}/${CIRCUIT_NAME}.json"

# Verifier contract to copy into the foundry repo (e.g. src/verifiers/HonkVerifier.sol)
cp "${CIRCUIT_DIR}/target/Verifier.sol" "${VERIFIER_OUT_DIR}/HonkVerifier.sol"

# VK travels with the verifier — regenerating a verifier from a different VK
# silently invalidates every previously generated proof.
cp "${CIRCUIT_DIR}/target/vk" "${VERIFIER_OUT_DIR}/vk"

echo "build ok:"
echo "  frontend artifact -> ${FRONTEND_ARTIFACT_DIR}/${CIRCUIT_NAME}.json"
echo "  verifier          -> ${VERIFIER_OUT_DIR}/HonkVerifier.sol"

# Mainnet reminders for whoever drops the verifier into foundry:
#   - HonkVerifier.sol needs pragma solidity >=0.8.21 and EVM version cancun,
#     so foundry.toml needs solc_version = '0.8.27' and evm_version = 'cancun'.
#   - The generated verifier can exceed the 24KB EIP-170 limit; enable the
#     optimizer (optimizer = true, optimizer_runs = 200). Ethereum mainnet
#     enforces 24KB — the anvil/forge --code-size-limit escape hatch is
#     local-testing only.

# --- 6. Smoke test (local sanity check, not part of the build) ---------------
# Proves and verifies one proof from the Prover.toml inputs. If this passes,
# the circuit + VK + keccak transcript are internally consistent and the
# circuit is ready to wire into the frontend.
if [[ "${SKIP_SMOKE:-0}" == "1" ]]; then
  echo "smoke test skipped (SKIP_SMOKE=1)"
  exit 0
fi

cd "$CIRCUIT_DIR"

# Produces target/proof (raw proof bytes) and target/public_inputs (the
# circuit's `pub` params, in declaration order — the same order the Solidity
# verifier expects). Uses the witness from step 2.
bb prove --oracle_hash keccak \
  -b "target/${CIRCUIT_NAME}.json" \
  -w "target/${CIRCUIT_NAME}.gz" \
  -o target/

# Verifies that proof against the VK from step 3. Exits non-zero on failure,
# so `set -e` fails the script. Same --oracle_hash keccak as everywhere else.
bb verify --oracle_hash keccak \
  -p target/proof \
  -k target/vk \
  -i target/public_inputs

cd - >/dev/null

echo "smoke test ok: one proof generated and verified against Prover.toml inputs"
