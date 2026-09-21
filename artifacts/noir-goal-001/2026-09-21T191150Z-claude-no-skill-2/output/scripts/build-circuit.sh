#!/usr/bin/env bash
# Compile the Noir circuit and regenerate the Solidity verifier from it.
# Re-run whenever circuits/vote changes; commit the regenerated verifier.
set -euo pipefail
cd "$(dirname "$0")/.."
NARGO=${NARGO:-$(command -v nargo || echo ~/.nargo/bin/nargo)}
BB=${BB:-$(command -v bb || echo ~/.bb/bb)}

(cd circuits/vote && "$NARGO" test && "$NARGO" compile)
# -t evm = keccak transcript + ZK. The ZK variant matters here: the non-ZK
# flavour does not hide the witness (i.e. the member's secret / tree position).
"$BB" write_vk -b circuits/vote/target/vote.json -o circuits/vote/target -t evm
"$BB" write_solidity_verifier -k circuits/vote/target/vk -o contracts/verifier/HonkVerifier.sol -t evm
echo "wrote contracts/verifier/HonkVerifier.sol"
