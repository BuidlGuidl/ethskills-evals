#!/usr/bin/env bash
# Build the age_check Noir circuit into:
#   (a) the compiled circuit artifact the frontend prover (NoirJS + bb.js) loads
#   (b) a Solidity verifier contract for Ethereum mainnet (drop into the foundry repo)
# then smoke-test one real prove + verify against Prover.toml.
#
# Usage:  ./build.sh              # build + smoke test
#         SKIP_SMOKE=1 ./build.sh # build only
#
# Assumes nargo and bb are already installed (noirup -v <ver>; bbup -v <ver>).
# The frontend's @aztec/bb.js must be pinned to the exact `bb --version` printed
# below, or the proofs it produces will not verify against this verifier.
set -euo pipefail

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
OUT_DIR="${OUT_DIR:-build}"

# Every bb step uses the same verifier target. "evm" = keccak transcript + ZK,
# which is what the Solidity verifier checks. Proofs made for any other target
# (default/poseidon2, or evm-no-zk) are rejected onchain.
VERIFIER_TARGET="evm"

cd "$CIRCUIT_DIR"

# Artifact names come from the package name in Nargo.toml, not the directory.
PKG="$(sed -n 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"\(.*\)".*/\1/p' Nargo.toml | head -n1)"
[ -n "$PKG" ] || { echo "could not read package name from Nargo.toml" >&2; exit 1; }

ARTIFACT="target/${PKG}.json"
WITNESS="target/${PKG}.gz"
VK_DIR="target/vk"
PROOF_DIR="target/proof"

# Record toolchain versions in the CI log (bb.js must match bb exactly).
nargo --version
bb --version

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

# Clean slate so stale artifacts from a previous circuit version never ship.
rm -rf target

# Compile the circuit.
# Produces: target/<pkg>.json — ACIR bytecode + ABI. This is artifact (a):
# the frontend does `new Noir(circuit)` and
# `new UltraHonkBackend(circuit.bytecode, api)` with it.
nargo compile

# Derive the verification key for the EVM target.
# Produces: target/vk/vk (and target/vk/vk_hash). Feeds the Solidity verifier.
mkdir -p "$VK_DIR"
bb write_vk -b "$ARTIFACT" -o "$VK_DIR" --verifier_target "$VERIFIER_TARGET"

# Generate the Solidity verifier from that VK.
# Produces: target/HonkVerifier.sol — artifact (b). Requires
# pragma >=0.8.27 and evm_version = "cancun" in foundry.toml, and must be built
# with the optimizer on or it exceeds the 24KB contract size limit.
bb write_solidity_verifier -k "$VK_DIR/vk" -o target/HonkVerifier.sol \
  --verifier_target "$VERIFIER_TARGET"

# ---------------------------------------------------------------------------
# Smoke test: one real proof from Prover.toml, verified with the same VK the
# Solidity verifier was generated from.
# ---------------------------------------------------------------------------
if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  # Execute the circuit on the known-good inputs. Fails here if any
  # constraint/assert is violated by Prover.toml.
  # Produces: target/<pkg>.gz — the solved witness.
  nargo execute

  # Prove with the same target as the verifier.
  # Produces: target/proof/proof and target/proof/public_inputs.
  mkdir -p "$PROOF_DIR"
  bb prove -b "$ARTIFACT" -w "$WITNESS" -k "$VK_DIR/vk" -o "$PROOF_DIR" \
    --verifier_target "$VERIFIER_TARGET"

  # Verify offchain against the VK behind HonkVerifier.sol.
  # Produces: exit code 0 on a valid proof; non-zero fails the script.
  bb verify -k "$VK_DIR/vk" -p "$PROOF_DIR/proof" -i "$PROOF_DIR/public_inputs" \
    --verifier_target "$VERIFIER_TARGET"

  echo "smoke test: proof verified"
fi

# ---------------------------------------------------------------------------
# Collect deliverables
# ---------------------------------------------------------------------------
cd - >/dev/null
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# (a) frontend prover artifact
cp "$CIRCUIT_DIR/$ARTIFACT" "$OUT_DIR/${PKG}.json"
# (b) Solidity verifier for the foundry repo (e.g. src/verifiers/)
cp "$CIRCUIT_DIR/target/HonkVerifier.sol" "$OUT_DIR/HonkVerifier.sol"
# VK kept alongside so the verifier's provenance can be checked later.
cp "$CIRCUIT_DIR/$VK_DIR/vk" "$OUT_DIR/vk"

echo "built: $OUT_DIR/${PKG}.json, $OUT_DIR/HonkVerifier.sol"
