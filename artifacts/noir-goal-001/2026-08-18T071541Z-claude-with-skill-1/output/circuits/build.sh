#!/usr/bin/env bash
# Compile the circuit, write the verification key, and regenerate the Solidity verifier.
#
# `--verifier_target evm` is the whole ballgame: it selects keccak transcript hashing *and* ZK
# Honk. The proof settings here must match `{ verifierTarget: "evm" }` in scripts/lib/prove.mjs.
# Mismatch them and proofs verify fine offchain, then revert onchain with ProofLengthWrong or a
# bare sumcheck failure. (The older `--oracle_hash keccak` / `{ keccak: true }` pairing is not
# equivalent: in bb 5.x the CLI flag leaves ZK on while the bb.js flag turns it off.)
set -euo pipefail

cd "$(dirname "$0")/anon_vote"
ROOT="$(cd ../.. && pwd)"

echo "==> nargo compile"
nargo compile

echo "==> nargo test (Poseidon parity + circuit unit tests)"
nargo test

echo "==> bb write_vk"
bb write_vk --verifier_target evm -b target/anon_vote.json -o target/

echo "==> bb write_solidity_verifier"
bb write_solidity_verifier -k target/vk -o target/Verifier.sol

echo "==> installing verifier into the foundry project"
cp target/Verifier.sol "$ROOT/contracts/src/verifiers/HonkVerifier.sol"

echo "done. Next: npm run fixture && (cd contracts && forge test)"
