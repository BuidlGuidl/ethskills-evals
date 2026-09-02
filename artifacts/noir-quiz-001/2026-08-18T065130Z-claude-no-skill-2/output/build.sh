#!/usr/bin/env bash
#
# build.sh — circuit source -> frontend prover artifact + Solidity verifier.
#
# Produces (in $DIST_DIR, default ./dist):
#   age_check.json      ACIR bytecode + ABI; what the frontend prover (noir_js + bb.js) loads
#   HonkVerifier.sol    Solidity verifier for the foundry repo (UltraHonk / keccak / ZK)
#   vk, vk_hash         verification key + its hash; vk_hash pins verifier <-> circuit
#   build-manifest.txt  tool versions + vk hash, so a deployment can be traced to a build
#   smoke/              proof + public inputs from Prover.toml (smoke-test section only)
#
# Verified against: nargo 1.0.0-beta.26, bb 5.1.0.
# Toolchain assumed installed (noirup / bbup).
#
# Usage:  ./build.sh                 # build + smoke test
#         SKIP_SMOKE=1 ./build.sh    # build only (CI artifact job)
#         ONLY_SMOKE=1 ./build.sh    # smoke test only (dev sanity check, reuses last build)

set -euo pipefail

CIRCUIT_DIR="${CIRCUIT_DIR:-circuits/age_check}"   # nargo package root (Nargo.toml, src/, Prover.toml)
DIST_DIR="${DIST_DIR:-dist}"                       # where CI collects artifacts
VERIFIER_TARGET=evm                                # bb preset: keccak transcript + ZK. MUST be identical
                                                   # for write_vk / prove / verify / write_solidity_verifier,
                                                   # and is what makes proofs verifiable by Solidity.
                                                   # (evm-no-zk exists but leaks witness info -> not for a privacy app.)
OPTIMIZED_VERIFIER="${OPTIMIZED_VERIFIER:-0}"      # 0 = stock bb verifier (~2.27M gas/verify, readable Solidity)
                                                   # 1 = bb --optimized verifier (~0.91M gas/verify, assembly-heavy)
                                                   # Measured on a 1-public-input circuit; both accept the same proof.

# Version pinning: vk bytes (and therefore the deployed verifier) are toolchain-dependent.
EXPECTED_NARGO="${EXPECTED_NARGO:-1.0.0-beta.26}"
EXPECTED_BB="${EXPECTED_BB:-5.1.0}"

cd "$(dirname "$0")"
REPO_ROOT="$PWD"
DIST="$REPO_ROOT/$DIST_DIR"

# Package name from Nargo.toml -> nargo names every output file after it (target/<pkg>.json, target/<pkg>.gz).
PKG="$(sed -n 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"\(.*\)".*/\1/p' "$CIRCUIT_DIR/Nargo.toml" | head -1)"
TARGET="$REPO_ROOT/$CIRCUIT_DIR/target"

# ---------------------------------------------------------------------------
# 0. Preflight — fail fast on toolchain drift rather than shipping a verifier
#    that does not match the vk the frontend proves against.
# ---------------------------------------------------------------------------
NARGO_VERSION="$(nargo --version | sed -n 's/^nargo version = //p')"   # e.g. 1.0.0-beta.26
BB_VERSION="$(bb --version)"                                          # e.g. 5.1.0
echo "nargo $NARGO_VERSION / bb $BB_VERSION"

if [ "${ALLOW_VERSION_DRIFT:-0}" != "1" ]; then
  [ "$NARGO_VERSION" = "$EXPECTED_NARGO" ] || { echo "FAIL: nargo $NARGO_VERSION != $EXPECTED_NARGO (noirup -v $EXPECTED_NARGO, or ALLOW_VERSION_DRIFT=1)"; exit 1; }
  [ "$BB_VERSION" = "$EXPECTED_BB" ]       || { echo "FAIL: bb $BB_VERSION != $EXPECTED_BB (bbup -v $EXPECTED_BB, or ALLOW_VERSION_DRIFT=1)"; exit 1; }
fi

cd "$REPO_ROOT/$CIRCUIT_DIR"

if [ "${ONLY_SMOKE:-0}" != "1" ]; then
mkdir -p "$DIST"

# ---------------------------------------------------------------------------
# 1. Compile the circuit
# ---------------------------------------------------------------------------

# -> target/<pkg>.json : ACIR bytecode + ABI + debug symbols.
#    THIS IS THE FRONTEND ARTIFACT — noir_js `new Noir(circuit)` / bb.js
#    `new UltraHonkBackend(circuit.bytecode)` consume this file directly.
#    --force: no incremental reuse in CI. --deny-warnings: a warning in a
#    constraint-writing language is a bug waiting to be deployed.
nargo compile --force --deny-warnings

# ---------------------------------------------------------------------------
# 2. Verification key (must precede the Solidity verifier — the contract is
#    literally this vk hardcoded as constants)
# ---------------------------------------------------------------------------

# -> target/vk       : UltraHonk verification key for the keccak/ZK (EVM) configuration
# -> target/vk_hash  : 32-byte hash of that vk; embedded in the verifier as VK_HASH
bb write_vk \
  -b "$TARGET/$PKG.json" \
  -o "$TARGET" \
  -t "$VERIFIER_TARGET"

# ---------------------------------------------------------------------------
# 3. Solidity verifier
# ---------------------------------------------------------------------------

# -> target/HonkVerifier.sol : `contract HonkVerifier`, pragma ^0.8.27, exposing
#    verify(bytes proof, bytes32[] publicInputs) returns (bool).
#    Constructor takes no args — the vk is compiled in, so ANY circuit change
#    requires regenerating AND redeploying this contract.
if [ "$OPTIMIZED_VERIFIER" = "1" ]; then
  bb write_solidity_verifier -k "$TARGET/vk" -o "$TARGET/HonkVerifier.sol" -t "$VERIFIER_TARGET" --optimized
else
  bb write_solidity_verifier -k "$TARGET/vk" -o "$TARGET/HonkVerifier.sol" -t "$VERIFIER_TARGET"
fi

# ---------------------------------------------------------------------------
# 4. Collect artifacts
# ---------------------------------------------------------------------------

# -> dist/age_check.json   : ship to the frontend (bundle it or serve it; bb.js major
#                            version in package.json must match the bb CLI above)
# -> dist/HonkVerifier.sol : drop into the foundry repo's src/ and deploy
# -> dist/vk, dist/vk_hash : reference copies; vk_hash identifies the circuit onchain
cp "$TARGET/$PKG.json"        "$DIST/$PKG.json"
cp "$TARGET/HonkVerifier.sol" "$DIST/HonkVerifier.sol"
cp "$TARGET/vk"               "$DIST/vk"
cp "$TARGET/vk_hash"          "$DIST/vk_hash"

VK_HASH="0x$(od -An -v -tx1 "$TARGET/vk_hash" | tr -d ' \n')"

# Cross-check: the VK_HASH constant baked into the contract must equal the vk we
# just wrote. Guards against a stale .sol being copied over a fresh vk.
if grep -q "VK_HASH" "$DIST/HonkVerifier.sol"; then
  grep -q "$VK_HASH" "$DIST/HonkVerifier.sol" \
    || { echo "FAIL: HonkVerifier.sol VK_HASH != target/vk_hash ($VK_HASH)"; exit 1; }
fi

# -> dist/build-manifest.txt : what produced these bytes. Record the vk hash with
#    every mainnet deployment so a deployed verifier can be traced back to a commit.
cat > "$DIST/build-manifest.txt" <<EOF
package         = $PKG
nargo           = $NARGO_VERSION
bb              = $BB_VERSION
verifier_target = $VERIFIER_TARGET
optimized       = $OPTIMIZED_VERIFIER
vk_hash         = $VK_HASH
git_commit      = $(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)
EOF

echo "build ok -> $DIST_DIR/{$PKG.json,HonkVerifier.sol,vk,vk_hash,build-manifest.txt}"
fi  # end build

# ---------------------------------------------------------------------------
# 5. Smoke test — prove and verify one real proof from Prover.toml.
#    Run this before wiring the frontend: it exercises the exact prove/verify
#    configuration the browser and the contract will use.
# ---------------------------------------------------------------------------
[ "${SKIP_SMOKE:-0}" = "1" ] && { echo "smoke skipped"; exit 0; }

SMOKE="$DIST/smoke"
mkdir -p "$SMOKE"

# Runs the #[test] functions in src/main.nr. Cheapest failure signal — a broken
# constraint shows up here in milliseconds instead of after a 30s proof.
nargo test

# -> target/<pkg>.gz : witness (all wire values) solved from Prover.toml inputs.
#    Fails here = the known-good inputs no longer satisfy the circuit.
nargo execute

# -> target/proof          : UltraHonk ZK proof, keccak transcript; the exact bytes
#                            passed as `bytes proof` to HonkVerifier.verify
# -> target/public_inputs  : public inputs, 32 bytes per field, in ABI order;
#                            these become the `bytes32[] publicInputs` argument
#    -k pins the proof to the same vk the deployed verifier was generated from.
bb prove \
  -b "$TARGET/$PKG.json" \
  -w "$TARGET/$PKG.gz" \
  -k "$TARGET/vk" \
  -o "$TARGET" \
  -t "$VERIFIER_TARGET"

# Native verification with the same vk/target the contract uses. Prints
# "Proof verified successfully"; non-zero exit = the proof is invalid.
bb verify \
  -k "$TARGET/vk" \
  -p "$TARGET/proof" \
  -i "$TARGET/public_inputs" \
  -t "$VERIFIER_TARGET"

# -> dist/smoke/proof.hex / public_inputs.json : same proof in hex/field form,
#    ready to paste into a foundry test as a fixture:
#      bytes memory proof = vm.parseBytes(vm.readLine("smoke/proof.hex"));  // readLine: strips \n
#      assertTrue(verifier.verify(proof, publicInputs));                     // needs fs_permissions in foundry.toml
cp "$TARGET/proof" "$TARGET/public_inputs" "$SMOKE/"
printf '0x%s\n' "$(od -An -v -tx1 "$TARGET/proof" | tr -d ' \n')" > "$SMOKE/proof.hex"
bb prove \
  -b "$TARGET/$PKG.json" \
  -w "$TARGET/$PKG.gz" \
  -k "$TARGET/vk" \
  -o "$SMOKE" \
  -t "$VERIFIER_TARGET" \
  --output_format json   # -> dist/smoke/{proof,public_inputs}.json (0x-prefixed field arrays)

echo "smoke ok — proof verifies against $DIST_DIR/vk (fixture in $DIST_DIR/smoke/)"
