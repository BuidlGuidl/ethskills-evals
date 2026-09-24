#!/usr/bin/env bash
#
# build.sh — circuit source -> frontend prover artifact + onchain Solidity verifier
#
# Expects the standard nargo layout (run from the app repo root, or set CIRCUIT_DIR):
#   circuits/age_check/Nargo.toml
#   circuits/age_check/src/main.nr
#   circuits/age_check/Prover.toml   (known-good inputs, smoke test only)
#
# Outputs (in $OUT_DIR, default ./build):
#   age_check.json      compiled ACIR + ABI; the frontend loads this into NoirJS
#   HonkVerifier.sol    UltraHonk verifier for Ethereum mainnet; drop into the foundry repo
#   vk                  verification key the verifier was generated from (kept for audit/diffing)
#
# Toolchain is assumed installed and pinned (noirup -v <ver>, bbup -v <ver>).
# The frontend's @aztec/bb.js MUST be the exact same version as `bb` here, or its
# proofs will not verify against this contract.
#
# Env:
#   CIRCUIT_DIR   path to the circuit package   (default: circuits/age_check)
#   OUT_DIR       where to put deliverables      (default: build)
#   SKIP_SMOKE=1  skip the prove/verify smoke test

set -euo pipefail

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"
OUT_DIR="${OUT_DIR:-build}"

# One target for VK, verifier, prove and verify. "evm" = keccak transcript + ZK,
# which is what the generated Solidity verifier checks. Mixing targets (e.g. a
# default/poseidon proof or an evm-no-zk proof) yields proofs the contract rejects.
VERIFIER_TARGET="evm"

# Package name from Nargo.toml; nargo names the artifact target/<name>.json.
PKG="$(sed -nE 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$CIRCUIT_DIR/Nargo.toml" | head -n1)"
[ -n "$PKG" ] || { echo "error: could not read package name from $CIRCUIT_DIR/Nargo.toml" >&2; exit 1; }

TARGET="$CIRCUIT_DIR/target"
CIRCUIT_JSON="$TARGET/$PKG.json"
VK_DIR="$TARGET/vk"

mkdir -p "$OUT_DIR"

# ---------------------------------------------------------------------------
# 0. Record toolchain versions in the CI log (bb.js in the frontend must match bb).
# ---------------------------------------------------------------------------
echo "nargo: $(nargo --version | head -n1)"
echo "bb:    $(bb --version)"

# ---------------------------------------------------------------------------
# 1. Compile the circuit.
#    Produces: $TARGET/$PKG.json — ACIR bytecode + ABI.
#    This is (a): the artifact the frontend feeds to `new Noir(circuit)` and
#    `new UltraHonkBackend(circuit.bytecode, api)` for in-browser proving.
# ---------------------------------------------------------------------------
( cd "$CIRCUIT_DIR" && nargo compile )
cp "$CIRCUIT_JSON" "$OUT_DIR/$PKG.json"

# ---------------------------------------------------------------------------
# 2. Generate the verification key for the EVM target.
#    Produces: $VK_DIR/vk (and $VK_DIR/vk_hash).
# ---------------------------------------------------------------------------
bb write_vk -b "$CIRCUIT_JSON" -o "$VK_DIR" --verifier_target "$VERIFIER_TARGET"
cp "$VK_DIR/vk" "$OUT_DIR/vk"

# ---------------------------------------------------------------------------
# 3. Generate the Solidity verifier from that VK.
#    Produces: $OUT_DIR/HonkVerifier.sol — this is (b).
#    Foundry side: needs pragma >=0.8.27, so set solc_version = '0.8.27' (or newer),
#    evm_version = 'cancun', and optimizer = true in foundry.toml, otherwise the
#    contract exceeds the 24KB mainnet code-size limit.
#    Read the generated verify(bytes proof, bytes32[] publicInputs) signature and
#    pass public inputs in the same order as the circuit's `pub` params.
# ---------------------------------------------------------------------------
bb write_solidity_verifier -k "$VK_DIR/vk" -o "$OUT_DIR/HonkVerifier.sol" --verifier_target "$VERIFIER_TARGET"

echo "built: $OUT_DIR/$PKG.json, $OUT_DIR/HonkVerifier.sol"

# ===========================================================================
# Smoke test — one real prove + verify against Prover.toml.
# Run this before wiring the frontend: it proves the circuit is satisfiable with
# the known-good inputs and that proofs verify against the exact VK the Solidity
# verifier was generated from.
# ===========================================================================
if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  echo "smoke test skipped (SKIP_SMOKE=1)"
  exit 0
fi

PROOF_DIR="$TARGET/proof"

# 4. Solve the circuit with Prover.toml inputs (also runs every assert).
#    Produces: $TARGET/$PKG.gz — the compressed witness.
( cd "$CIRCUIT_DIR" && nargo execute )

# 5. Prove with the same target as the VK/verifier.
#    Produces: $PROOF_DIR/proof and $PROOF_DIR/public_inputs
#    (same serialization the frontend gets from generateProof(w, { verifierTarget: "evm" })).
bb prove -b "$CIRCUIT_JSON" -w "$TARGET/$PKG.gz" -o "$PROOF_DIR" --verifier_target "$VERIFIER_TARGET"

# 6. Verify the proof against the VK that HonkVerifier.sol was built from.
#    Produces: exit 0 on success; non-zero fails the script (set -e).
bb verify -k "$VK_DIR/vk" -p "$PROOF_DIR/proof" -i "$PROOF_DIR/public_inputs" --verifier_target "$VERIFIER_TARGET"

echo "smoke test passed: proof verified ($PROOF_DIR/proof)"
