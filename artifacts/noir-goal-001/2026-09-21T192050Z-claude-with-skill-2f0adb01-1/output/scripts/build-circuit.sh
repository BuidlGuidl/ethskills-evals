#!/usr/bin/env bash
# Compile the vote circuit, derive its verification key and regenerate the
# Solidity verifier. Re-run whenever circuits/vote/src changes, then redeploy.
set -euo pipefail
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUIT="$ROOT/circuits/vote"

cd "$CIRCUIT"
nargo test
nargo compile

# `-t evm` = keccak transcript + zero-knowledge flavour. The ZK flavour matters
# here: the non-ZK variant does not formally hide the private witness.
bb write_vk -t evm -b target/vote.json -o target/
bb write_solidity_verifier -t evm -k target/vk -o "$ROOT/contracts/src/verifier/HonkVerifier.sol"

echo "circuit artifact: $CIRCUIT/target/vote.json"
echo "verifier:         contracts/src/verifier/HonkVerifier.sol"
