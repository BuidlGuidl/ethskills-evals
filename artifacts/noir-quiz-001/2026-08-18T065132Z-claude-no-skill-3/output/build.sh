#!/usr/bin/env bash
#
# build.sh — circuit source -> frontend prover artifact + Solidity verifier.
#
# Run from the app repo root (the repo containing circuits/age_check/).
# Assumes nargo + bb are already installed and on PATH.
#
#   ./build.sh              # build + smoke test
#   SKIP_SMOKE=1 ./build.sh # build only (CI artifact job)
#
# Outputs land in dist/:
#   dist/age_check.json   -> commit to / bundle with the frontend (NoirJS + bb.js)
#   dist/HonkVerifier.sol -> drop into the foundry repo's src/
#   dist/vk               -> verification key (kept for debugging / reproducibility)

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CIRCUIT_DIR="circuits/age_check"   # nargo package root (Nargo.toml, src/, Prover.toml)
CIRCUIT_NAME="age_check"           # must match `name` in Nargo.toml
TARGET_DIR="${CIRCUIT_DIR}/target" # nargo/bb scratch dir
DIST_DIR="dist"                    # what we hand to the frontend / foundry repo

# Proving scheme. UltraHonk is the only scheme with a production Solidity verifier.
SCHEME="ultra_honk"

# CRITICAL for onchain verification: the Solidity verifier hashes its transcript
# with keccak256 (EVM-native), not the default Poseidon2. The vk and the proof
# must both be generated with --oracle_hash keccak or on-chain verify() reverts
# / returns false even though `bb verify` off-chain passes.
# The frontend must match this: `new UltraHonkBackend(bytecode).generateProof(witness, { keccak: true })`.
ORACLE_HASH="keccak"

# ---------------------------------------------------------------------------
# 0. Preflight — pin the toolchain versions into the CI log
# ---------------------------------------------------------------------------

# Prints the nargo version; a version bump here changes the ACIR bytecode.
nargo --version

# Prints the bb version; bb and nargo versions must be compatible (see the
# Noir release notes) or `bb write_vk` will reject the compiled ACIR.
bb --version

# Fails fast with a clear message instead of a confusing nargo error later.
test -f "${CIRCUIT_DIR}/Nargo.toml" || { echo "no Nargo.toml at ${CIRCUIT_DIR} — run from the app repo root"; exit 1; }

# Removes stale artifacts so CI never ships a verifier built from an old circuit.
rm -rf "${TARGET_DIR}" "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# ---------------------------------------------------------------------------
# 1. Compile the circuit
# ---------------------------------------------------------------------------

# Produces ${TARGET_DIR}/${CIRCUIT_NAME}.json — the compiled ACIR bytecode +
# ABI. THIS IS THE FRONTEND ARTIFACT: NoirJS loads it as the `circuit` object
# (`new Noir(circuit)` for witness generation, `circuit.bytecode` for
# `new UltraHonkBackend(...)`).
( cd "${CIRCUIT_DIR}" && nargo compile )

# Prints the gate count. Watch this — it drives both browser proving time and
# the mainnet verify() gas cost. A jump here after a circuit change is a smell.
bb gates --scheme "${SCHEME}" -b "${TARGET_DIR}/${CIRCUIT_NAME}.json"

# ---------------------------------------------------------------------------
# 2. Verification key + Solidity verifier
# ---------------------------------------------------------------------------

# Produces ${TARGET_DIR}/vk — the verification key, keccak flavour.
# Deterministic for a given (circuit, nargo, bb, oracle_hash) tuple, so the
# verifier contract below is reproducible from source.
bb write_vk \
  --scheme "${SCHEME}" \
  --oracle_hash "${ORACLE_HASH}" \
  -b "${TARGET_DIR}/${CIRCUIT_NAME}.json" \
  -o "${TARGET_DIR}"

# Produces ${TARGET_DIR}/Verifier.sol — a standalone `contract HonkVerifier`
# with the vk baked in as constants, exposing
# `verify(bytes calldata proof, bytes32[] calldata publicInputs) returns (bool)`.
# No constructor args, no external deps: drop it straight into foundry src/.
bb write_solidity_verifier \
  --scheme "${SCHEME}" \
  -k "${TARGET_DIR}/vk" \
  -o "${TARGET_DIR}/Verifier.sol"

# ---------------------------------------------------------------------------
# 3. Package
# ---------------------------------------------------------------------------

# The two deliverables, plus the vk so a failing onchain verify can be
# reproduced offline against the exact key that was compiled into the contract.
cp "${TARGET_DIR}/${CIRCUIT_NAME}.json" "${DIST_DIR}/${CIRCUIT_NAME}.json"
cp "${TARGET_DIR}/Verifier.sol"         "${DIST_DIR}/HonkVerifier.sol"
cp "${TARGET_DIR}/vk"                   "${DIST_DIR}/vk"

# Records the exact toolchain + a hash of each artifact, so the frontend bundle
# and the deployed verifier can be traced back to one build.
{
  echo "circuit:  ${CIRCUIT_NAME}"
  echo "scheme:   ${SCHEME} (oracle_hash=${ORACLE_HASH})"
  echo "nargo:    $(nargo --version | head -n1)"
  echo "bb:       $(bb --version)"
  shasum -a 256 "${DIST_DIR}/${CIRCUIT_NAME}.json" "${DIST_DIR}/HonkVerifier.sol" "${DIST_DIR}/vk"
} > "${DIST_DIR}/BUILD_INFO.txt"

echo "build ok -> ${DIST_DIR}/"

# ---------------------------------------------------------------------------
# 4. Smoke test — prove & verify once against Prover.toml
# ---------------------------------------------------------------------------
# Not needed to produce the artifacts; it proves the circuit is actually
# satisfiable and that the vk above verifies a real proof. Run it locally
# before wiring the frontend.

if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  echo "smoke test skipped (SKIP_SMOKE=1)"
  exit 0
fi

# Runs the circuit's own `#[test]` functions (if any). Cheap, catches broken
# constraints before we pay for a full proof.
( cd "${CIRCUIT_DIR}" && nargo test )

# Produces ${TARGET_DIR}/${CIRCUIT_NAME}.gz — the witness (all intermediate
# values) from the known-good inputs in ${CIRCUIT_DIR}/Prover.toml.
# This step alone fails if an assert in main.nr doesn't hold for those inputs.
( cd "${CIRCUIT_DIR}" && nargo execute )

# Produces ${TARGET_DIR}/proof and ${TARGET_DIR}/public_inputs.
# Same --oracle_hash as the vk, so this proof is byte-for-byte the shape the
# mainnet contract expects: `proof` -> the bytes arg, `public_inputs` -> the
# bytes32[] arg of HonkVerifier.verify().
bb prove \
  --scheme "${SCHEME}" \
  --oracle_hash "${ORACLE_HASH}" \
  -b "${TARGET_DIR}/${CIRCUIT_NAME}.json" \
  -w "${TARGET_DIR}/${CIRCUIT_NAME}.gz" \
  -o "${TARGET_DIR}"

# Exits non-zero if the proof doesn't verify under the vk we just shipped.
# Off-chain equivalent of the mainnet HonkVerifier.verify() call.
bb verify \
  --scheme "${SCHEME}" \
  --oracle_hash "${ORACLE_HASH}" \
  -k "${TARGET_DIR}/vk" \
  -p "${TARGET_DIR}/proof" \
  -i "${TARGET_DIR}/public_inputs"

# Keeps the sample proof around: paste it into a foundry test as the fixture
# that exercises HonkVerifier.verify() on the real contract.
cp "${TARGET_DIR}/proof"          "${DIST_DIR}/sample_proof"
cp "${TARGET_DIR}/public_inputs"  "${DIST_DIR}/sample_public_inputs"

echo "smoke test ok — proof verified against ${DIST_DIR}/vk"
