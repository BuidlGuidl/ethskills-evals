#!/usr/bin/env bash
#
# build.sh — Noir circuit -> frontend prover artifact + Solidity verifier
#
# Circuit layout (in the app repo):
#   circuits/age_check/
#     Nargo.toml
#     src/main.nr
#     Prover.toml      <- known-good test inputs (used by the smoke test only)
#
# Outputs (in $OUT_DIR, default ./build):
#   age_check.json   ACIR bytecode + ABI. The frontend loads this with
#                    @noir-lang/noir_js (witness) + @aztec/bb.js (proving).
#   vk               UltraHonk verification key, EVM flavor (keccak transcript).
#   Verifier.sol     Solidity UltraHonk verifier; drop into the foundry repo.
#
# Usage:
#   ./build.sh               # build artifacts + run smoke test
#   SKIP_SMOKE=1 ./build.sh  # CI build only
#
# IMPORTANT — why every bb command below uses `-t evm`:
#   bb defaults to a Poseidon2 Fiat-Shamir transcript, which is cheap to
#   verify in-circuit but NOT what the Solidity verifier implements. Proofs and
#   VKs meant for onchain verification must be generated with the EVM target
#   (keccak transcript). If the VK, the verifier contract, or the proofs the
#   frontend produces disagree on this, every onchain verify() call reverts.
#   The frontend must match: in bb.js use UltraHonkBackend and generate proofs
#   with the EVM/keccak option (e.g. `backend.generateProof(witness, { keccak: true })`
#   or `{ verifierTarget: 'evm' }` depending on the bb.js version).
#
# Toolchain assumed installed (noirup / bbup). nargo and bb versions MUST be a
# compatible pair — bb reads the ACIR nargo emits, and the bb.js version in the
# frontend must equal the bb CLI version used here, or the frontend's proofs
# will not verify against this Verifier.sol. Pin both below.

set -euo pipefail

# --- configuration -----------------------------------------------------------

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
CIRCUIT_NAME="${CIRCUIT_NAME:-age_check}"        # must match `name` in Nargo.toml
OUT_DIR="${OUT_DIR:-build}"

# Pin these to the versions the frontend's package.json uses. Leave empty to
# skip enforcement (not recommended in CI).
EXPECTED_NARGO_VERSION="${EXPECTED_NARGO_VERSION:-}"   # e.g. 1.0.0-beta.x
EXPECTED_BB_VERSION="${EXPECTED_BB_VERSION:-}"         # e.g. must equal @aztec/bb.js

TARGET_DIR="$CIRCUIT_DIR/target"
ARTIFACT="$TARGET_DIR/$CIRCUIT_NAME.json"
WITNESS="$TARGET_DIR/$CIRCUIT_NAME.gz"

log() { printf '\n==> %s\n' "$*"; }

# --- 0. toolchain check ------------------------------------------------------

log "Toolchain versions"
# Prints nargo + noirc versions (also recorded in CI logs for reproducibility).
nargo --version
# Prints barretenberg CLI version.
bb --version

if [[ -n "$EXPECTED_NARGO_VERSION" ]] && ! nargo --version | grep -qF "$EXPECTED_NARGO_VERSION"; then
  echo "error: nargo version mismatch (want $EXPECTED_NARGO_VERSION)" >&2; exit 1
fi
if [[ -n "$EXPECTED_BB_VERSION" ]] && ! bb --version | grep -qF "$EXPECTED_BB_VERSION"; then
  echo "error: bb version mismatch (want $EXPECTED_BB_VERSION)" >&2; exit 1
fi

# Start from a clean slate so a stale artifact/VK can never be shipped.
rm -rf "$TARGET_DIR" "$OUT_DIR"
mkdir -p "$OUT_DIR"

# --- 1. check + test the circuit ---------------------------------------------

log "nargo check"
# Type-checks src/main.nr and resolves dependencies. Produces nothing (note: if
# Prover.toml is missing, this also writes an empty template of it).
(cd "$CIRCUIT_DIR" && nargo check)

log "nargo test"
# Runs any #[test] functions in the circuit crate. Produces nothing; fails the
# build on a failing test.
(cd "$CIRCUIT_DIR" && nargo test)

# --- 2. (a) frontend prover artifact -----------------------------------------

log "nargo compile"
# Produces target/age_check.json: the compiled ACIR program (base64 bytecode)
# plus its ABI. This is the exact file the frontend imports and passes to
# `new Noir(circuit)` / `new UltraHonkBackend(circuit.bytecode)`.
(cd "$CIRCUIT_DIR" && nargo compile)

cp "$ARTIFACT" "$OUT_DIR/$CIRCUIT_NAME.json"

# --- 3. (b) Solidity verifier ------------------------------------------------

log "bb write_vk (EVM target)"
# Produces target/vk (and target/vk_hash): the UltraHonk verification key for
# this exact bytecode, using the keccak transcript the Solidity verifier needs.
# Any change to main.nr or to the nargo version changes the VK -> redeploy.
bb write_vk -b "$ARTIFACT" -o "$TARGET_DIR" -t evm

log "bb write_solidity_verifier"
# Produces Verifier.sol: a self-contained Solidity UltraHonk verifier with the
# VK baked in. Exposes `verify(bytes calldata proof, bytes32[] calldata
# publicInputs) returns (bool)`.
# Foundry note: the generated contract is large — compile it with the optimizer
# enabled (and check `forge build --sizes` against the 24,576-byte EIP-170
# limit) before deploying to mainnet.
bb write_solidity_verifier -k "$TARGET_DIR/vk" -o "$OUT_DIR/Verifier.sol" -t evm

cp "$TARGET_DIR/vk" "$OUT_DIR/vk"

# Record provenance so the deployed verifier can be traced back to its source.
{
  echo "circuit:  $CIRCUIT_NAME"
  echo "nargo:    $(nargo --version | tr '\n' ' ')"
  echo "bb:       $(bb --version)"
  echo "artifact: $(shasum -a 256 "$OUT_DIR/$CIRCUIT_NAME.json" | cut -d' ' -f1)"
  echo "vk:       $(shasum -a 256 "$OUT_DIR/vk" | cut -d' ' -f1)"
} > "$OUT_DIR/BUILD_INFO"

log "Build artifacts"
ls -l "$OUT_DIR"

# --- 4. smoke test: one proof against Prover.toml ----------------------------

if [[ "${SKIP_SMOKE:-0}" == "1" ]]; then
  log "SKIP_SMOKE=1 — skipping proof smoke test"
  exit 0
fi

log "nargo execute (witness from Prover.toml)"
# Reads Prover.toml, runs the circuit, and checks every constraint/assert.
# Produces target/age_check.gz: the solved witness. Fails here if the test
# inputs don't satisfy the circuit.
(cd "$CIRCUIT_DIR" && nargo execute)

log "bb prove (EVM target)"
# Produces target/proof and target/public_inputs: an UltraHonk proof with the
# keccak transcript — the same kind of proof the frontend must submit onchain.
bb prove -b "$ARTIFACT" -w "$WITNESS" -k "$TARGET_DIR/vk" -o "$TARGET_DIR" -t evm

log "bb verify (EVM target)"
# Verifies the proof natively against the same VK that is baked into
# Verifier.sol. Produces nothing; non-zero exit on an invalid proof.
bb verify -k "$TARGET_DIR/vk" -p "$TARGET_DIR/proof" -i "$TARGET_DIR/public_inputs" -t evm

# Keep the fixture around: the foundry repo can load proof + public_inputs in a
# forge test that calls Verifier.verify() — the only check that proves the
# deployed contract, not just bb, accepts the proof.
mkdir -p "$OUT_DIR/fixtures"
cp "$TARGET_DIR/proof" "$TARGET_DIR/public_inputs" "$OUT_DIR/fixtures/"

log "Smoke test passed: proof generated and verified for Prover.toml inputs"
