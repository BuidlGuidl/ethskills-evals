#!/usr/bin/env bash
# Compile the circuit and regenerate the Solidity verifier from it.
#
# Run this after ANY change to circuits/vote/src/main.nr. The verifier embeds a
# hash of the circuit's verification key, so a circuit change without a
# regenerated + redeployed verifier silently rejects every proof.
set -euo pipefail
cd "$(dirname "$0")/.."

pushd circuits/vote >/dev/null
nargo compile
nargo test
# -t evm == keccak transcript + ZK, the only target the Solidity verifier accepts.
bb write_vk -t evm -b target/dao_vote.json -o target/
bb write_solidity_verifier -k target/vk -o target/Verifier.sol
popd >/dev/null

cp circuits/vote/target/Verifier.sol src/verifiers/HonkVerifier.sol
forge build

echo "circuit + verifier rebuilt; regenerate proof fixtures with: npm run fixtures"
