#!/usr/bin/env bash
# Compiles the circuit, regenerates the Solidity verifier from its verification
# key, and refreshes the proof fixture the Solidity tests replay.
# Run this after any change under circuits/.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== nargo test =="
(cd circuits/vote && nargo test)

echo "== nargo compile =="
(cd circuits/vote && nargo compile)

echo "== verification key + Solidity verifier =="
(cd circuits/vote && bb write_vk -b target/vote.json -o target/vk -t evm)
bb write_solidity_verifier -k circuits/vote/target/vk/vk -t evm -o src/verifiers/HonkVerifier.sol

echo "== proof fixture for the Solidity tests =="
env -u NODE_OPTIONS node scripts/make-test-fixture.js

echo "== forge test =="
forge test
