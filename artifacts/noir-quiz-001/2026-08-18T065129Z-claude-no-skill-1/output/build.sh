#!/usr/bin/env bash
#
# build.sh — circuit source -> (a) frontend prover artifact, (b) Solidity verifier.
#
# Run from the repo root of the app repo (the one containing circuits/age_check/).
# Assumes nargo + bb are already installed and on PATH.
#
#   ./build.sh              # full build + smoke test
#   SKIP_SMOKE=1 ./build.sh # build only (what CI runs for release artifacts)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CIRCUIT_DIR="circuits/age_check"   # nargo package root (Nargo.toml, src/main.nr, Prover.toml)
CIRCUIT_NAME="age_check"           # must match `name` in Nargo.toml -> names every target/ file
DIST_DIR="dist/age_check"          # frontend-consumable artifacts land here
CONTRACT_DIR="contracts"           # Solidity verifier lands here, copy into the foundry repo

# Proof system. UltraHonk is the Noir default and the only scheme with a
# maintained onchain verifier.
SCHEME="ultra_honk"

# ZK flavor. Plain UltraHonk is succinct but NOT zero-knowledge: the proof is a
# commitment to the witness and can leak information about it. For a privacy
# app publishing proofs to a public chain you want the ZK flavor. Costs a bit
# more gas and a slightly larger proof. Set ZK=0 only if the witness is public.
ZK=1

# Transcript hash. MUST be keccak for anything verified onchain — the Solidity
# verifier hashes the transcript with keccak256, so a proof built with the
# default poseidon oracle will fail verification on Ethereum.
# The same flag must be passed to write_vk, prove, AND verify.
ORACLE_HASH="keccak"

if [ "$ZK" = "1" ]; then ZK_FLAG=(--zk); else ZK_FLAG=(); fi

TARGET_DIR="${CIRCUIT_DIR}/target"

# ---------------------------------------------------------------------------
# 0. Toolchain provenance
# ---------------------------------------------------------------------------
# nargo and bb are version-locked to each other: bb rejects ACIR emitted by a
# nargo whose bytecode format it doesn't know. Print both so a failed CI run
# tells you immediately whether it's a version skew and not a circuit bug.
# Pin these in CI (noirup --version X / bbup --version Y) rather than tracking latest.
echo "=== toolchain ==="
nargo --version
bb --version
echo

# ---------------------------------------------------------------------------
# 1. Compile the circuit
# ---------------------------------------------------------------------------

rm -rf "${TARGET_DIR}"
# -> ${TARGET_DIR}/${CIRCUIT_NAME}.json : the compiled program. Contains the ACIR
#    bytecode (gzipped+base64), the ABI, and debug symbols. This single file is
#    the input to every step below and is also artifact (a).
( cd "${CIRCUIT_DIR}" && nargo compile )

# -> stdout only: gate count per function. Watch this number — it drives both
#    browser proving time and the verifier's onchain gas. Fails loudly if the
#    compiled artifact is malformed.
bb gates --scheme "${SCHEME}" -b "${TARGET_DIR}/${CIRCUIT_NAME}.json"

# ---------------------------------------------------------------------------
# 2. Artifact (a): what the frontend prover loads
# ---------------------------------------------------------------------------
# The browser bundle (@noir-lang/noir_js + @aztec/bb.js UltraHonkBackend) takes
# the compiled program JSON directly — it runs ACVM on the ACIR to produce the
# witness, then hands that to bb.js WASM to prove. No separate artifact needed.

mkdir -p "${DIST_DIR}"

# -> ${DIST_DIR}/${CIRCUIT_NAME}.json : the artifact the frontend imports.
#    Debug symbols stripped: they're ~most of the file size and unused at runtime.
jq '{noir_version, hash, abi, bytecode}' \
  "${TARGET_DIR}/${CIRCUIT_NAME}.json" > "${DIST_DIR}/${CIRCUIT_NAME}.json"

# ---------------------------------------------------------------------------
# 3. Verification key
# ---------------------------------------------------------------------------
# One VK serves both sides: it's baked into the Solidity verifier (step 4) and
# it's what `bb verify` checks against locally (step 6). Generating it once here
# guarantees the onchain verifier and the local smoke test agree.

# -> ${TARGET_DIR}/vk               : binary VK, input to the Solidity codegen
# -> ${TARGET_DIR}/vk_fields.json   : same VK as field elements (handy for JS)
bb write_vk \
  --scheme "${SCHEME}" \
  "${ZK_FLAG[@]}" \
  --oracle_hash "${ORACLE_HASH}" \
  --output_format bytes_and_fields \
  -b "${TARGET_DIR}/${CIRCUIT_NAME}.json" \
  -o "${TARGET_DIR}"

# -> ${DIST_DIR}/vk : ship the VK to the frontend too. bb.js can skip its own
#    VK derivation (a few seconds of WASM work on page load) if you pass this in.
cp "${TARGET_DIR}/vk" "${DIST_DIR}/vk"

# ---------------------------------------------------------------------------
# 4. Artifact (b): the Solidity verifier
# ---------------------------------------------------------------------------

mkdir -p "${CONTRACT_DIR}"

# -> ${CONTRACT_DIR}/Verifier.sol : a standalone `contract HonkVerifier` with the
#    VK hardcoded as constants. Copy this file into the foundry repo's src/ and
#    call verify(bytes calldata proof, bytes32[] calldata publicInputs)
#    -> bool. It has no imports and no constructor args.
#
#    Regenerate and redeploy whenever src/main.nr changes: the VK is committed to
#    the circuit, so an old verifier will reject proofs from a new circuit.
bb write_solidity_verifier \
  --scheme "${SCHEME}" \
  "${ZK_FLAG[@]}" \
  -k "${TARGET_DIR}/vk" \
  -o "${CONTRACT_DIR}/Verifier.sol"

# Mainnet has a 24576-byte EIP-170 limit on deployed bytecode and Honk verifiers
# are big. Warn early — in the foundry repo build it with the optimizer on
# (solc --optimize --optimize-runs 200, ideally --via-ir).
echo "Verifier.sol source size: $(wc -c < "${CONTRACT_DIR}/Verifier.sol") bytes (check deployed size against the 24576-byte EIP-170 limit after solc --optimize)"

echo
echo "build complete:"
echo "  frontend : ${DIST_DIR}/${CIRCUIT_NAME}.json, ${DIST_DIR}/vk"
echo "  solidity : ${CONTRACT_DIR}/Verifier.sol"
echo

# ---------------------------------------------------------------------------
# Smoke test — prove and verify once against Prover.toml
# ---------------------------------------------------------------------------
# Not part of the release artifacts. This is the local sanity check: does the
# circuit actually satisfy its own known-good inputs, and does a proof built
# with mainnet settings verify? Run this before wiring up the frontend.

if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  echo "SKIP_SMOKE=1 — stopping before smoke test."
  exit 0
fi

echo "=== smoke test ==="

# -> ${TARGET_DIR}/${CIRCUIT_NAME}.gz : the witness — every wire value in the
#    circuit, solved from ${CIRCUIT_DIR}/Prover.toml.
#    This is the first real check: it fails here if an assert in main.nr doesn't
#    hold for those inputs, which is the fastest way to catch a broken circuit.
#    (Prover.toml is read from the package root, hence the subshell.)
( cd "${CIRCUIT_DIR}" && nargo execute )

# -> ${TARGET_DIR}/proof                     : the proof bytes, what you pass to
#                                              HonkVerifier.verify as `proof`
# -> ${TARGET_DIR}/public_inputs             : the public inputs, split out of
#                                              the proof; `publicInputs` arg
# -> ${TARGET_DIR}/proof_fields.json
# -> ${TARGET_DIR}/public_inputs_fields.json : field-element forms, for JS tests
#
# Flags must match step 3's write_vk exactly (same scheme, same ZK flavor, same
# oracle hash) or verification fails for reasons unrelated to the circuit.
bb prove \
  --scheme "${SCHEME}" \
  "${ZK_FLAG[@]}" \
  --oracle_hash "${ORACLE_HASH}" \
  --output_format bytes_and_fields \
  -b "${TARGET_DIR}/${CIRCUIT_NAME}.json" \
  -w "${TARGET_DIR}/${CIRCUIT_NAME}.gz" \
  -o "${TARGET_DIR}"

# -> exit 0 on success, nonzero on failure. This is the actual assertion of the
#    smoke test: `set -e` aborts the script if the proof doesn't verify.
#    Verifies against the same VK the Solidity contract embeds, so passing here
#    means the onchain verifier will accept this proof too.
bb verify \
  --scheme "${SCHEME}" \
  "${ZK_FLAG[@]}" \
  --oracle_hash "${ORACLE_HASH}" \
  -k "${TARGET_DIR}/vk" \
  -p "${TARGET_DIR}/proof" \
  -i "${TARGET_DIR}/public_inputs" \
  -b "${TARGET_DIR}/${CIRCUIT_NAME}.json"

# -> ${TARGET_DIR}/calldata.txt : the same proof rendered as the two arguments
#    HonkVerifier.verify takes. Paste into a foundry test to confirm the
#    deployed verifier accepts a real proof, without standing up the frontend:
#      assertTrue(verifier.verify(hex"<proof>", publicInputs));
{
  printf 'proof (bytes):\n0x%s\n\n' "$(xxd -p -c 0 < "${TARGET_DIR}/proof")"
  printf 'publicInputs (bytes32[]):\n'
  jq -r '["0x" + .[]] | @json' "${TARGET_DIR}/public_inputs_fields.json" 2>/dev/null \
    || echo "(no public inputs)"
} > "${TARGET_DIR}/calldata.txt"

echo
echo "smoke test passed — circuit satisfies Prover.toml and the proof verifies against the shipped VK."
echo "foundry calldata: ${TARGET_DIR}/calldata.txt"
