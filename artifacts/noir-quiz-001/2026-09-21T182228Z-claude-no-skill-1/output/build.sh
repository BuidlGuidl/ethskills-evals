#!/usr/bin/env bash
#
# build.sh — Noir circuit -> frontend artifact + Solidity verifier (+ smoke test)
#
# Run from the app repo root (or set CIRCUIT_DIR). Expects the standard nargo
# layout:
#   circuits/age_check/Nargo.toml
#   circuits/age_check/src/main.nr
#   circuits/age_check/Prover.toml   (known-good inputs, used by the smoke test)
#
# Outputs (in $OUT_DIR, default ./build):
#   <name>.json        compiled ACIR program — what the frontend prover loads
#                      (noir_js executes it for the witness, bb.js proves it)
#   vk                 verification key the Solidity verifier is generated from
#   Verifier.sol       HonkVerifier contract — drop into the foundry repo
#   toolchain.txt      nargo/bb versions; the frontend's @noir-lang/noir_js and
#                      @aztec/bb.js MUST be pinned to these exact versions
#
# Env:
#   CIRCUIT_DIR   default circuits/age_check
#   OUT_DIR       default build
#   SKIP_SMOKE=1  skip the proof generation/verification smoke test
#
# IMPORTANT — onchain verification needs the EVM target end-to-end:
#   bb's default proofs use a Poseidon2 transcript, which the Solidity verifier
#   cannot check. The vk, the Solidity verifier, and EVERY proof (including the
#   ones the frontend makes with bb.js) must be produced with the EVM/keccak
#   target, or proofs will verify locally and revert onchain. In bb.js that
#   means generateProof(witness, { verifierTarget: 'evm' }) (older bb.js:
#   { keccak: true }). The EVM target is the ZK variant — required here since
#   the circuit's private inputs (e.g. birthdate) must not leak via the proof.

set -euo pipefail

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
OUT_DIR="${OUT_DIR:-build}"

# Resolve OUT_DIR to an absolute path before we cd into the circuit.
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

cd "$CIRCUIT_DIR"

# Package name from Nargo.toml; nargo names target/<name>.json and
# target/<name>.gz after it.
PKG="$(sed -nE 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' Nargo.toml | head -n1)"
[[ -n "$PKG" ]] || { echo "error: could not read package name from Nargo.toml" >&2; exit 1; }

# bb's flag for "produce EVM-verifiable (keccak transcript) artifacts" changed
# across releases: current bb uses --verifier_target/-t evm, older 0.8x/1.x
# releases used --oracle_hash keccak. Detect which one this bb understands so
# the vk, verifier, and proofs are all built consistently.
if bb prove --help 2>&1 | grep -q -- 'verifier_target'; then
  EVM_FLAGS=(-t evm)
elif bb prove --help 2>&1 | grep -q -- 'oracle_hash'; then
  EVM_FLAGS=(--scheme ultra_honk --oracle_hash keccak)
else
  echo "error: this bb has neither --verifier_target nor --oracle_hash; unsupported version" >&2
  exit 1
fi

echo "==> Toolchain"
# Record exact versions; frontend packages must match these or the artifact /
# proofs will be incompatible.
{
  echo "nargo: $(nargo --version | tr '\n' ' ')"
  echo "bb:    $(bb --version)"
  echo "bb EVM flags: ${EVM_FLAGS[*]}"
} | tee "$OUT_DIR/toolchain.txt"

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

echo "==> Checking formatting"
# Produces nothing; fails CI if src/ isn't nargo-fmt clean.
nargo fmt --check

echo "==> Running circuit unit tests"
# Produces nothing; runs #[test] functions in src/ and fails on any failure.
nargo test

echo "==> Compiling circuit"
# Produces target/$PKG.json: the ACIR bytecode + ABI. This is the artifact the
# frontend loads (noir_js for witness generation, bb.js for proving).
nargo compile

echo "==> Writing verification key (EVM target)"
# Produces target/vk: the verification key for the keccak/ZK UltraHonk variant.
# Also written by a fresh CI run every time — never reuse a stale vk, it is
# tied to the exact compiled circuit.
bb write_vk -b "target/$PKG.json" -o target "${EVM_FLAGS[@]}"

echo "==> Generating Solidity verifier"
# Produces target/Verifier.sol: a self-contained HonkVerifier contract with the
# vk baked in, exposing verify(bytes proof, bytes32[] publicInputs).
bb write_solidity_verifier -k target/vk -o target/Verifier.sol "${EVM_FLAGS[@]}"

echo "==> Collecting artifacts into $OUT_DIR"
# Produces $OUT_DIR/{$PKG.json,vk,Verifier.sol}.
cp "target/$PKG.json" "$OUT_DIR/$PKG.json"
cp target/vk "$OUT_DIR/vk"
cp target/Verifier.sol "$OUT_DIR/Verifier.sol"

# Mainnet deployment note for the foundry repo: the generated verifier is large.
# Compile it with the optimizer on (foundry.toml: optimizer = true,
# optimizer_runs = 1 or low) — and via_ir = true if you hit "stack too deep" —
# and check `forge build --sizes` stays under the 24,576-byte EIP-170 limit.

# ---------------------------------------------------------------------------
# Smoke test: one proof from Prover.toml, verified against the same vk that
# the Solidity verifier was generated from.
# ---------------------------------------------------------------------------

if [[ "${SKIP_SMOKE:-0}" == "1" ]]; then
  echo "==> SKIP_SMOKE=1, skipping smoke test"
  exit 0
fi

echo "==> [smoke] Executing circuit with Prover.toml"
# Produces target/$PKG.gz: the solved witness for the Prover.toml inputs.
# Fails here if any constraint/assert in main.nr is unsatisfied.
nargo execute

echo "==> [smoke] Generating proof (EVM target)"
# Produces target/proof and target/public_inputs — the same bytes you'd pass to
# HonkVerifier.verify(proof, publicInputs) onchain.
bb prove -b "target/$PKG.json" -w "target/$PKG.gz" -o target "${EVM_FLAGS[@]}"

echo "==> [smoke] Verifying proof"
# Produces nothing; exits non-zero if the proof doesn't verify against target/vk
# (the vk embedded in Verifier.sol).
bb verify -k target/vk -p target/proof -i target/public_inputs "${EVM_FLAGS[@]}"

echo "==> Smoke test passed"
echo "Artifacts:"
echo "  frontend prover artifact: $OUT_DIR/$PKG.json"
echo "  Solidity verifier:        $OUT_DIR/Verifier.sol"
echo "  toolchain versions:       $OUT_DIR/toolchain.txt"
