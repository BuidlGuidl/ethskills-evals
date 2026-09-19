#!/usr/bin/env bash
# End-to-end test of entry.ts on a local mainnet fork (anvil, Prague rules => EIP-7702 enabled).
# usage: FORK_URL=<mainnet rpc> scripts/fork-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
FORK_URL=${FORK_URL:-https://ethereum-rpc.publicnode.com}
R=http://127.0.0.1:8547
WETH=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
AUSDC=0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c

anvil --fork-url "$FORK_URL" --hardfork prague --port 8547 > /tmp/anvil-fork.log 2>&1 & ANVIL=$!
trap 'kill $ANVIL' EXIT
for _ in $(seq 1 60); do cast chain-id -r $R >/dev/null 2>&1 && break; sleep 1; done

newkey() { cast wallet new --json | node -e 'console.log(JSON.parse(require("fs").readFileSync(0))[0].private_key)'; }
# A fresh "user" EOA holding exactly 2 WETH + 0.1 ETH for gas, no approvals, no code.
mkuser() {
  local k; k=$(newkey); local a; a=$(cast wallet address "$k")
  cast rpc anvil_setBalance "$a" 0x29A2241AF62C0000 -r $R >/dev/null            # 3 ETH
  cast send $WETH "deposit()" --value 2ether --private-key "$k" -r $R >/dev/null
  cast rpc anvil_setBalance "$a" 0x16345785D8A0000 -r $R >/dev/null             # 0.1 ETH for gas
  echo "$k"
}
bal() { cast call "$1" 'balanceOf(address)(uint256)' "$2" -r $R | cut -d' ' -f1; }

DEPLOYER=$(newkey); cast rpc anvil_setBalance "$(cast wallet address $DEPLOYER)" 0xDE0B6B3A7640000 -r $R >/dev/null
RPC_URL=$R DEPLOYER_KEY=$DEPLOYER npx tsx entry.ts deploy-helper
HELPER=$(RPC_URL=$R npx tsx -e 'import("./entry.ts").then(m=>console.log(m.HELPER_ADDRESS))')

echo "=== 1. happy path"
U=$(mkuser); UA=$(cast wallet address "$U")
RPC_URL=$R PRIVATE_KEY=$U DRY_RUN=1 npx tsx entry.ts enter >/dev/null
[ "$(cast code "$UA" -r $R)" = "0x" ] && echo "dry run left account untouched: ok"
RPC_URL=$R PRIVATE_KEY=$U npx tsx entry.ts enter
echo "user code: $(cast code "$UA" -r $R)   WETH=$(bal $WETH "$UA") USDC=$(bal $USDC "$UA") aUSDC=$(bal $AUSDC "$UA")"
echo "helper holds WETH=$(bal $WETH "$HELPER") USDC=$(bal $USDC "$HELPER")"
echo "--- rerun with 0 WETH must refuse:"; RPC_URL=$R PRIVATE_KEY=$U npx tsx entry.ts enter || true
echo "--- revoke:"; RPC_URL=$R PRIVATE_KEY=$U npx tsx entry.ts revoke

echo "=== 2. atomicity: the swap succeeds but the Aave leg is forced to fail (USDC blacklists aEthUSDC)"
U2=$(mkuser); U2A=$(cast wallet address "$U2")
BL=$(cast call $USDC 'blacklister()(address)' -r $R)
cast rpc anvil_impersonateAccount "$BL" -r $R >/dev/null; cast rpc anvil_setBalance "$BL" 0xDE0B6B3A7640000 -r $R >/dev/null
echo "--- entry.ts refuses to broadcast (simulation fails):"
cast send $USDC 'blacklist(address)' $AUSDC --from "$BL" --unlocked -r $R >/dev/null
RPC_URL=$R PRIVATE_KEY=$U2 npx tsx entry.ts enter 2>&1 | tail -1 | cut -c1-160 || true
echo "--- forced broadcast anyway:"
RPC_URL=$R PRIVATE_KEY=$U2 npx tsx scripts/atomicity-check.ts
echo "after revert: code=$(cast code "$U2A" -r $R) WETH=$(bal $WETH "$U2A") USDC=$(bal $USDC "$U2A") aUSDC=$(bal $AUSDC "$U2A") allowance=$(cast call $WETH 'allowance(address,address)(uint256)' "$U2A" "$HELPER" -r $R)"
