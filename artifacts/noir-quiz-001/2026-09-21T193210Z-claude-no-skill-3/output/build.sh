#!/usr/bin/env bash
# build.sh — age_check circuit: Noir source -> frontend artifact + Solidity verifier.
#
# Usage:
#   ./build.sh               # CI build: artifact + vk + Verifier.sol
#   ./build.sh --smoke-test  # also prove + verify once using circuits/age_check/Prover.toml
#
# Toolchain (assumed installed): nargo (Noir) and bb (Barretenberg).
# These MUST be a matching pair, and the frontend's @noir-lang/noir_js and
# @aztec/bb.js versions MUST match them too. A vk/verifier built with one bb
# version will reject proofs made by a different one. Pin versions below.
#
# Proving system: UltraHonk. Onchain verification requires the keccak
# Fiat-Shamir transcript ("EVM target"). The vk, the Solidity verifier, AND
# every proof (CLI or bb.js in the browser) must be generated with the same
# target — otherwise the verifier contract rejects the proof.

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPO_ROOT="${REPO_ROOT:-$(pwd)}"
CIRCUIT_DIR="${CIRCUIT_DIR:-$REPO_ROOT/circuits/age_check}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/build/age_check}"

# Pin the toolchain. CI fails fast if the runner has something else installed.
# Set to "" to skip the check (local dev only).
EXPECTED_NARGO_VERSION="${EXPECTED_NARGO_VERSION:-}"   # e.g. "1.0.0-beta.9"
EXPECTED_BB_VERSION="${EXPECTED_BB_VERSION:-}"         # e.g. "0.87.0"

SMOKE_TEST=false
[[ "${1:-}" == "--smoke-test" ]] && SMOKE_TEST=true

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. Toolchain sanity
# ---------------------------------------------------------------------------
log "Toolchain"
command -v nargo >/dev/null || die "nargo not on PATH"
command -v bb    >/dev/null || die "bb not on PATH"

NARGO_VERSION="$(nargo --version | head -n1)"   # prints e.g. "nargo version = 1.0.0-beta.9"
BB_VERSION="$(bb --version | head -n1)"         # prints e.g. "0.87.0"
echo "nargo: $NARGO_VERSION"
echo "bb:    $BB_VERSION"
if [[ -n "$EXPECTED_NARGO_VERSION" && "$NARGO_VERSION" != *"$EXPECTED_NARGO_VERSION"* ]]; then
  die "nargo version mismatch (want $EXPECTED_NARGO_VERSION)"
fi
if [[ -n "$EXPECTED_BB_VERSION" && "$BB_VERSION" != *"$EXPECTED_BB_VERSION"* ]]; then
  die "bb version mismatch (want $EXPECTED_BB_VERSION)"
fi

# bb's CLI flags for the EVM target and ZK have changed across releases.
# Detect them once so vk, verifier and proofs are all built consistently.
BB_HELP="$(bb prove --help 2>&1 || true)"

# EVM target: keccak transcript, required by the Solidity verifier.
if grep -q -- '--verifier_target' <<<"$BB_HELP"; then
  EVM_FLAGS=(--verifier_target evm)          # newer bb
elif grep -q -- '--oracle_hash' <<<"$BB_HELP"; then
  EVM_FLAGS=(--oracle_hash keccak)           # bb ~0.8x
else
  die "this bb has neither --verifier_target nor --oracle_hash; cannot target EVM"
fi

# Zero-knowledge: this is a privacy app, so proofs MUST be ZK or they can leak
# information about the private witness (e.g. the birthdate). Newer bb is ZK by
# default (opt-out via --disable_zk); older bb needed --zk. Never pass --disable_zk.
ZK_FLAGS=()
if grep -q -- '--disable_zk' <<<"$BB_HELP"; then
  ZK_FLAGS=()                                # ZK is the default
elif grep -qE -- '(^|[[:space:]])--zk' <<<"$BB_HELP"; then
  ZK_FLAGS=(--zk)                            # older bb: opt in explicitly
else
  echo "WARNING: could not determine bb ZK flag; check that proofs are zero-knowledge" >&2
fi

BB_FLAGS=(-s ultra_honk "${EVM_FLAGS[@]}" ${ZK_FLAGS[@]+"${ZK_FLAGS[@]}"})
echo "bb flags: ${BB_FLAGS[*]}"

# ---------------------------------------------------------------------------
# 1. Compile the circuit -> frontend artifact
# ---------------------------------------------------------------------------
[[ -f "$CIRCUIT_DIR/Nargo.toml" ]] || die "no Nargo.toml in $CIRCUIT_DIR"

# nargo names outputs after the package name in Nargo.toml (expected: age_check).
PKG_NAME="$(sed -n 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"\(.*\)".*/\1/p' "$CIRCUIT_DIR/Nargo.toml" | head -n1)"
[[ -n "$PKG_NAME" ]] || die "could not read package name from Nargo.toml"
TARGET_DIR="$CIRCUIT_DIR/target"

log "Clean"
# Removes stale artifacts so nothing from a previous circuit version ships.
rm -rf "$TARGET_DIR" "$OUT_DIR"
mkdir -p "$OUT_DIR"

log "Check + test"
# Type-checks the circuit (no output files; fails CI on errors).
(cd "$CIRCUIT_DIR" && nargo check)
# Runs any #[test] functions in src/ (no output files; fails CI on failing tests).
(cd "$CIRCUIT_DIR" && nargo test)

log "Compile"
# Produces target/<pkg>.json: ACIR bytecode + ABI + noir_version.
# THIS is the artifact the frontend loads (noir_js executes it to build the
# witness; bb.js proves it). Commit/publish it alongside the verifier.
(cd "$CIRCUIT_DIR" && nargo compile)
ARTIFACT="$TARGET_DIR/$PKG_NAME.json"
[[ -f "$ARTIFACT" ]] || die "expected artifact $ARTIFACT not found"
cp "$ARTIFACT" "$OUT_DIR/$PKG_NAME.json"

# Gate count, for tracking prover cost in the browser over time (stdout only).
bb gates -b "$ARTIFACT" "${BB_FLAGS[@]}" || true

# ---------------------------------------------------------------------------
# 2. Verification key + Solidity verifier
# ---------------------------------------------------------------------------
log "Verification key"
# Produces $OUT_DIR/vk: UltraHonk verification key for the EVM (keccak) target.
# Must be built with the same flags the proofs use.
bb write_vk -b "$ARTIFACT" -o "$OUT_DIR" "${BB_FLAGS[@]}"
[[ -f "$OUT_DIR/vk" ]] || die "vk not written"

log "Solidity verifier"
# Produces $OUT_DIR/Verifier.sol: HonkVerifier contract with the vk baked in.
# Drop into the foundry repo (e.g. src/verifiers/AgeCheckVerifier.sol).
# Entry point: verify(bytes calldata proof, bytes32[] calldata publicInputs).
# NOTE: the generated contract is large. For mainnet (EIP-170, 24KB limit)
# build it in foundry with optimizer enabled (optimizer = true, low
# optimizer_runs) and check `forge build --sizes` before deploying.
bb write_solidity_verifier -k "$OUT_DIR/vk" -o "$OUT_DIR/Verifier.sol" "${BB_FLAGS[@]}"
[[ -f "$OUT_DIR/Verifier.sol" ]] || die "Verifier.sol not written"

# Record exactly what produced these artifacts; the frontend's noir_js/bb.js
# versions must match this file.
cat > "$OUT_DIR/BUILD_INFO" <<EOF
package:  $PKG_NAME
nargo:    $NARGO_VERSION
bb:       $BB_VERSION
bb_flags: ${BB_FLAGS[*]}
git_sha:  $(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)
EOF

# sha256 of every deliverable, so the foundry repo / frontend can confirm they
# are using the artifact+verifier from the same build.
(cd "$OUT_DIR" && shasum -a 256 "$PKG_NAME.json" vk Verifier.sol > SHA256SUMS)

log "Build outputs in $OUT_DIR"
ls -l "$OUT_DIR"

# ---------------------------------------------------------------------------
# 3. Smoke test (optional): one proof from Prover.toml, verified with the vk
# ---------------------------------------------------------------------------
if [[ "$SMOKE_TEST" == true ]]; then
  [[ -f "$CIRCUIT_DIR/Prover.toml" ]] || die "no Prover.toml in $CIRCUIT_DIR"
  SMOKE_DIR="$OUT_DIR/smoke"
  mkdir -p "$SMOKE_DIR"

  log "Smoke test: execute"
  # Solves the circuit with the Prover.toml inputs. Produces target/<pkg>.gz
  # (compressed witness). Fails here if the inputs don't satisfy the constraints.
  (cd "$CIRCUIT_DIR" && nargo execute)
  WITNESS="$TARGET_DIR/$PKG_NAME.gz"
  [[ -f "$WITNESS" ]] || die "expected witness $WITNESS not found"

  log "Smoke test: prove"
  # Produces $SMOKE_DIR/proof and $SMOKE_DIR/public_inputs, using the SAME
  # EVM/ZK flags as the vk and Verifier.sol (so this proof is exactly what the
  # onchain verifier expects). The frontend must use the equivalent bb.js
  # options (keccak / EVM target) for its proofs to verify onchain.
  bb prove -b "$ARTIFACT" -w "$WITNESS" -o "$SMOKE_DIR" "${BB_FLAGS[@]}"
  [[ -f "$SMOKE_DIR/proof" ]] || die "proof not written"

  log "Smoke test: verify"
  # Verifies the proof against the vk from step 2 (no output files; non-zero
  # exit on failure). Passing here means the vk the Solidity verifier embeds
  # accepts proofs for these inputs.
  if [[ -f "$SMOKE_DIR/public_inputs" ]]; then
    bb verify -k "$OUT_DIR/vk" -p "$SMOKE_DIR/proof" -i "$SMOKE_DIR/public_inputs" "${BB_FLAGS[@]}"
  else
    bb verify -k "$OUT_DIR/vk" -p "$SMOKE_DIR/proof" "${BB_FLAGS[@]}"   # older bb: public inputs inside proof
  fi

  log "Smoke test passed"
  # Proof/public inputs are left in $SMOKE_DIR so they can be copied into a
  # foundry test fixture to exercise Verifier.sol's verify() onchain-style.
  # Don't publish them: they're derived from test inputs, not real user data,
  # but keep the habit of never shipping witnesses (target/*.gz).
fi
