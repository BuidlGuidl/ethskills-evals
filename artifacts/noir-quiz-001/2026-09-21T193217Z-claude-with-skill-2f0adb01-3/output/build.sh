#!/usr/bin/env bash
#
# build.sh — Noir circuit build for the age_check privacy app.
#
# Produces:
#   (a) dist/frontend/age_check.json  — compiled circuit artifact loaded by NoirJS
#   (b) dist/contracts/HonkVerifier.sol — Solidity verifier for the foundry repo
#
# Usage:
#   ./build.sh                # production build only (what CI runs)
#   ./build.sh --smoke-test   # build, then prove + verify one proof from Prover.toml
#
# Toolchain (nargo + bb) is assumed installed. bb must be the version bbup
# paired with this nargo, and the frontend's @aztec/bb.js must be pinned to
# the exact same version as `bb` (recorded in dist/TOOLCHAIN_VERSIONS).
#
# Proving/verification is done by `bb`, not nargo — `nargo prove` / `nargo verify`
# no longer exist.

set -euo pipefail

SMOKE_TEST=0
[[ "${1:-}" == "--smoke-test" ]] && SMOKE_TEST=1

# --- Paths -------------------------------------------------------------------
# Run from the app repo root. Override if your layout differs.
CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
DIST_DIR="${DIST_DIR:-dist}"
FRONTEND_OUT="$DIST_DIR/frontend"   # copy/sync into frontend/public/circuits/
CONTRACTS_OUT="$DIST_DIR/contracts" # copy into <foundry-repo>/src/verifiers/

cd "$CIRCUIT_DIR"

# Artifact names derive from [package].name in Nargo.toml (expected: age_check).
CIRCUIT_NAME="$(sed -n 's/^name *= *"\(.*\)"/\1/p' Nargo.toml | head -n1)"
[[ -n "$CIRCUIT_NAME" ]] || { echo "error: could not read package name from Nargo.toml" >&2; exit 1; }
TARGET="target"
ARTIFACT="$TARGET/$CIRCUIT_NAME.json"

# --- Toolchain sanity --------------------------------------------------------
# Prints versions to the CI log; fails fast if either tool is missing.
NARGO_VERSION="$(nargo --version)"
BB_VERSION="$(bb --version)"
echo "nargo: $NARGO_VERSION"
echo "bb:    $BB_VERSION"

# --- Production build --------------------------------------------------------

# Start from a clean target/ so no stale artifact/vk/verifier can leak through.
rm -rf "$TARGET"

# 1. Compile the circuit.
#    Produces: target/<name>.json — ACIR bytecode + ABI. This is the artifact
#    the frontend prover loads (new Noir(circuit), new UltraHonkBackend(circuit.bytecode, ...)).
#    Also fetches git dependencies declared in Nargo.toml (e.g. poseidon).
nargo compile

# 2. Generate the verification key from the compiled circuit.
#    Produces: target/vk
#    --oracle_hash keccak is REQUIRED for an EVM verifier; every bb command
#    below and the frontend's generateProof(witness, { keccak: true }) must match it.
bb write_vk --oracle_hash keccak -b "$ARTIFACT" -o "$TARGET/"

# 3. Generate the Solidity verifier from the VK.
#    Produces: target/Verifier.sol (contract HonkVerifier).
#    Requires pragma solidity >=0.8.21 and evm_version = "cancun" in foundry.toml.
bb write_solidity_verifier -k "$TARGET/vk" -o "$TARGET/Verifier.sol"

# 4. Stage hand-off artifacts at stable paths (no ad-hoc copying downstream).
cd - >/dev/null
mkdir -p "$FRONTEND_OUT" "$CONTRACTS_OUT"

#    Produces: dist/frontend/<name>.json — serve from frontend/public/circuits/ and fetch() it.
cp "$CIRCUIT_DIR/$ARTIFACT" "$FRONTEND_OUT/$CIRCUIT_NAME.json"

#    Produces: dist/contracts/HonkVerifier.sol — drop into <foundry-repo>/src/verifiers/.
#    Deploy it as its own contract and pass its address to the app contract's constructor.
cp "$CIRCUIT_DIR/$TARGET/Verifier.sol" "$CONTRACTS_OUT/HonkVerifier.sol"

#    Produces: dist/contracts/vk — kept alongside the verifier for traceability.
cp "$CIRCUIT_DIR/$TARGET/vk" "$CONTRACTS_OUT/vk"

#    Produces: dist/TOOLCHAIN_VERSIONS — frontend must pin @aztec/bb.js to this bb version,
#    otherwise proof serialization differs and onchain verification fails.
printf 'nargo: %s\nbb: %s\n' "$NARGO_VERSION" "$BB_VERSION" > "$DIST_DIR/TOOLCHAIN_VERSIONS"

#    Produces: dist/SHA256SUMS — lets the frontend and foundry repos confirm they
#    consumed artifacts from the same build (circuit JSON and verifier must match).
( cd "$DIST_DIR" && shasum -a 256 "frontend/$CIRCUIT_NAME.json" contracts/HonkVerifier.sol contracts/vk > SHA256SUMS )

echo "Build complete:"
echo "  frontend artifact: $FRONTEND_OUT/$CIRCUIT_NAME.json"
echo "  solidity verifier: $CONTRACTS_OUT/HonkVerifier.sol"

# Mainnet note: the generated HonkVerifier can exceed the 24KB EIP-170 limit.
# The foundry repo must build it with optimizer = true (optimizer_runs = 200)
# and check `forge build --sizes`. --code-size-limit is for anvil only; mainnet
# enforces 24KB.

[[ "$SMOKE_TEST" == 1 ]] || exit 0

# --- Local smoke test (optional; not part of the production build) ---------
# Generates and verifies one proof from the known-good Prover.toml inputs,
# using the same keccak oracle hash as the Solidity verifier.

cd "$CIRCUIT_DIR"

# 5. Execute the circuit against Prover.toml; fails here if any assert is violated.
#    Produces: target/<name>.gz — the solved witness.
nargo execute

# 6. Generate an UltraHonk proof from the artifact + witness.
#    Produces: target/proof and target/public_inputs.
bb prove --oracle_hash keccak -b "$ARTIFACT" -w "$TARGET/$CIRCUIT_NAME.gz" -o "$TARGET/"

# 7. Verify the proof against the same VK the Solidity verifier was generated from.
#    Produces: no file — exits non-zero (failing the script) if the proof is invalid.
bb verify --oracle_hash keccak -p "$TARGET/proof" -k "$TARGET/vk" -i "$TARGET/public_inputs"

echo "Smoke test passed: proof from Prover.toml verifies against target/vk."
