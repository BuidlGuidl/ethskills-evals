#!/usr/bin/env bash
# End-to-end rehearsal on a local mainnet fork. Uses throwaway keys generated
# here at runtime — nothing is read from or written to the repo.
# Usage: FORK_URL=<mainnet rpc> scripts/fork-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${FORK_URL:?set FORK_URL to a mainnet RPC}"
R=http://127.0.0.1:8547
WETH=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

anvil --fork-url "$FORK_URL" --hardfork prague --port 8547 --silent & ANVIL=$!
trap 'kill $ANVIL' EXIT
until cast chain-id --rpc-url $R >/dev/null 2>&1; do sleep 0.5; done

forge build >/dev/null
PK=$(cast wallet new --json | jq -r '.[0].private_key'); A=$(cast wallet address "$PK")
DPK=$(cast wallet new --json | jq -r '.[0].private_key'); DA=$(cast wallet address "$DPK")
cast rpc anvil_setBalance "$DA" 0xDE0B6B3A7640000 --rpc-url $R >/dev/null
cast rpc anvil_setBalance "$A" 0x56BC75E2D63100000 --rpc-url $R >/dev/null
cast send $WETH "deposit()" --value 2ether --private-key "$PK" --rpc-url $R >/dev/null
cast rpc anvil_setBalance "$A" 0x2C68AF0BB140000 --rpc-url $R >/dev/null  # leave ~0.2 ETH for gas only
ENTRY=$(forge create src/WethToAaveEntry.sol:WethToAaveEntry --rpc-url $R --private-key "$DPK" --broadcast | awk '/Deployed to/ {print $3}')

export RPC_URL=$R ENTRY_CONTRACT=$ENTRY PRIVATE_KEY=$PK
echo yes | npx tsx entry.ts enter
echo yes | npx tsx entry.ts clear
npx tsx entry.ts status
