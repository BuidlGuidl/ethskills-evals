#!/usr/bin/env bash
# Compile the vote circuit and regenerate the Solidity verifier from it.
# Re-run (and redeploy) whenever circuits/vote changes: the verifier embeds the VK.
set -euo pipefail
cd "$(dirname "$0")/.."
NARGO=${NARGO:-$(command -v nargo || echo ~/.nargo/bin/nargo)}
BB=${BB:-$(command -v bb || echo ~/.bb/bb)}

(cd circuits/vote && "$NARGO" test && "$NARGO" compile)
"$BB" write_vk -b circuits/vote/target/vote.json -o circuits/vote/target -t evm
"$BB" write_solidity_verifier -k circuits/vote/target/vk -o contracts/src/HonkVerifier.sol -t evm
