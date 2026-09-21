#!/usr/bin/env bash
# Build pipeline for the age_check Noir circuit.
#
#   ./build.sh           production build: circuit artifact + VK + Solidity verifier
#   ./build.sh --smoke   production build, then a local prove/verify against Prover.toml
#
# Target: Ethereum mainnet. Every bb command uses `--oracle_hash keccak` so the
# VK, the generated verifier, and any proof agree on the transcript hash the EVM
# verifier expects. The frontend must match with `generateProof(witness, { keccak: true })`.
#
# Assumes nargo and bb are installed (bb installed via `bbup` so it matches nargo),
# and that the frontend's @aztec/bb.js version equals `bb --version` exactly.

set -euo pipefail

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
OUT_DIR="${OUT_DIR:-build}"   # hand-off directory for CI to publish/copy from
SMOKE=0
[[ "${1:-}" == "--smoke" ]] && SMOKE=1

cd "$CIRCUIT_DIR"

# Artifacts are named after [package].name in Nargo.toml, not the directory.
PKG="$(sed -n 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' Nargo.toml | head -n1)"
[[ -n "$PKG" ]] || { echo "could not read package name from Nargo.toml" >&2; exit 1; }

# Record toolchain versions in the CI log — a nargo/bb/bb.js mismatch is the
# most common cause of "proof verifies locally but not onchain".
nargo --version
bb --version

# ---------------------------------------------------------------------------
# Production build
# ---------------------------------------------------------------------------

# Start clean so stale artifacts from a previous circuit version can't leak through.
rm -rf target

# Compile the circuit (fetches git dependencies from Nargo.toml on first run).
# Produces: target/$PKG.json — ACIR bytecode + ABI. This is (a), the artifact
# the frontend loads into `new Noir(circuit)` / `new UltraHonkBackend(circuit.bytecode, ...)`.
nargo compile

# Derive the verification key from the compiled circuit.
# Produces: target/vk — consumed by write_solidity_verifier and bb verify.
bb write_vk --oracle_hash keccak -b "target/$PKG.json" -o target/

# Generate the onchain verifier from the VK.
# Produces: target/HonkVerifier.sol — (b), a standalone contract. Deploy it on its
# own and pass its address to the app contract's constructor. Requires
# pragma >=0.8.21 and evm_version = "cancun" in foundry.toml; enable the optimizer
# (optimizer = true, optimizer_runs = 200) or it may exceed the 24KB EIP-170 limit,
# which mainnet enforces (anvil --code-size-limit is for local testing only).
bb write_solidity_verifier -k target/vk -o target/HonkVerifier.sol

# Stage the hand-off artifacts in one predictable place.
# Produces: $OUT_DIR/$PKG.json      -> copy to frontend public/circuits/ (fetch() at runtime)
#           $OUT_DIR/HonkVerifier.sol -> copy to foundry repo src/verifiers/
#           $OUT_DIR/vk               -> kept for debugging / offchain verification
cd - >/dev/null
mkdir -p "$OUT_DIR"
cp "$CIRCUIT_DIR/target/$PKG.json"         "$OUT_DIR/$PKG.json"
cp "$CIRCUIT_DIR/target/HonkVerifier.sol"  "$OUT_DIR/HonkVerifier.sol"
cp "$CIRCUIT_DIR/target/vk"                "$OUT_DIR/vk"
echo "build ok: $OUT_DIR/$PKG.json, $OUT_DIR/HonkVerifier.sol"

[[ "$SMOKE" == 1 ]] || exit 0

# ---------------------------------------------------------------------------
# Local smoke test (optional — NOT part of the production build).
# Proves and verifies once against the known-good Prover.toml inputs.
# Not needed in CI for deploy; the frontend generates real proofs in the browser.
# ---------------------------------------------------------------------------

cd "$CIRCUIT_DIR"

# Execute the circuit with Prover.toml inputs; fails here if any assert is violated.
# Produces: target/$PKG.gz — the solved witness.
nargo execute

# Generate an UltraHonk proof from the bytecode + witness (keccak transcript, same as the VK).
# Produces: target/proof and target/public_inputs.
bb prove --oracle_hash keccak -b "target/$PKG.json" -w "target/$PKG.gz" -o target/

# Verify the proof against the VK and public inputs; non-zero exit on failure.
bb verify --oracle_hash keccak -p target/proof -k target/vk -i target/public_inputs

echo "smoke test ok: proof for Prover.toml verified against target/vk"
