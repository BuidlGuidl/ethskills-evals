#!/usr/bin/env bash
# Compile the circuit and regenerate the Solidity verifier from its EVM-target VK.
# Needs nargo 1.0.0-rc.2 and bb 5.2.0 (same version as @aztec/bb.js in package.json).
set -euo pipefail
cd "$(dirname "$0")/../circuits/vote"
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"
nargo test
nargo compile
bb write_vk -b target/vote.json -o target -t evm
bb write_solidity_verifier -k target/vk -o ../../contracts/HonkVerifier.sol -t evm
