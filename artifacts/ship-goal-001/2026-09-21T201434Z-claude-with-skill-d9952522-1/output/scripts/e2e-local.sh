#!/usr/bin/env bash
#
# End-to-end smoke test on a local anvil chain.
#
# Deploys a mock USDC and Toolshed, runs one full loan that comes back two days
# late, then runs the indexer over the result and checks that the offchain
# track record reflects what happened onchain.
#
# This is the same sequence as the post-deploy verification in the README, just
# against a throwaway chain. Run it before you touch a testnet.
#
#   anvil &
#   ./scripts/e2e-local.sh
#
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Anvil's deterministic accounts.
OWNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BORROWER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
BORROWER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

cd "$ROOT/contracts"

say "1/7  Deploying a mock USDC"
USDC=$(forge create test/mocks/MockUSDC.sol:MockUSDC \
  --rpc-url "$RPC" --private-key "$OWNER_KEY" --broadcast --json | python3 -c 'import sys,json;print(json.load(sys.stdin)["deployedTo"])')
echo "     usdc     $USDC"

say "2/7  Deploying Toolshed"
DEPLOY_BLOCK=$(cast block-number --rpc-url "$RPC")
SHED=$(USDC_ADDRESS="$USDC" forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC" --private-key "$OWNER_KEY" --broadcast --json 2>/dev/null \
  | grep -o '"toolshed":"[^"]*"' | head -1 | cut -d'"' -f4) || true

if [ -z "${SHED:-}" ]; then
  # Fall back to reading the address out of the broadcast artifact.
  SHED=$(python3 -c "
import json,glob
f=sorted(glob.glob('broadcast/Deploy.s.sol/*/run-latest.json'))[-1]
d=json.load(open(f))
print([t for t in d['transactions'] if t['transactionType']=='CREATE'][-1]['contractAddress'])
")
fi
echo "     toolshed $SHED"

say "3/7  Funding the borrower with 500 USDC"
cast send "$USDC" "mint(address,uint256)" "$BORROWER" 500000000 \
  --rpc-url "$RPC" --private-key "$OWNER_KEY" >/dev/null
cast send "$USDC" "approve(address,uint256)" "$SHED" 500000000 \
  --rpc-url "$RPC" --private-key "$BORROWER_KEY" >/dev/null

say "4/7  Borrower requests a 4-day loan: \$60 deposit, \$2/day late fee"
LISTING_REF=$(cast keccak "demo-listing")
cast send "$SHED" "request(address,bytes32,uint96,uint96,uint32)" \
  "$OWNER" "$LISTING_REF" 60000000 2000000 4 \
  --rpc-url "$RPC" --private-key "$BORROWER_KEY" >/dev/null
echo "     escrow holds $(cast call "$USDC" "balanceOf(address)(uint256)" "$SHED" --rpc-url "$RPC")"

say "5/7  Owner hands the tool over, then time passes: 2 days late"
cast send "$SHED" "approve(uint256)" 1 --rpc-url "$RPC" --private-key "$OWNER_KEY" >/dev/null
cast rpc evm_increaseTime $((6 * 86400)) --rpc-url "$RPC" >/dev/null
cast rpc evm_mine --rpc-url "$RPC" >/dev/null

QUOTE=$(cast call "$SHED" "quoteLateFee(uint256,uint64)(uint256,uint256)" 1 "$(cast block latest -f timestamp --rpc-url "$RPC")" --rpc-url "$RPC")
echo "     contract quotes: $QUOTE  (fee, days late)"

say "6/7  Owner confirms the return; the deposit splits"
cast send "$SHED" "confirmReturn(uint256)" 1 --rpc-url "$RPC" --private-key "$OWNER_KEY" >/dev/null
echo "     owner    $(cast call "$USDC" "balanceOf(address)(uint256)" "$OWNER" --rpc-url "$RPC")  (expected 4000000 = \$4 late fee)"
echo "     borrower $(cast call "$USDC" "balanceOf(address)(uint256)" "$BORROWER" --rpc-url "$RPC")  (expected 496000000 = \$500 - \$4)"
echo "     escrow   $(cast call "$USDC" "balanceOf(address)(uint256)" "$SHED" --rpc-url "$RPC")  (expected 0)"

say "7/7  Indexing the chain and reading back the track record"
cd "$ROOT/web"
rm -f /tmp/toolshed-e2e.db*

TOOLSHED_DB_PATH=/tmp/toolshed-e2e.db \
NEXT_PUBLIC_CHAIN=foundry \
NEXT_PUBLIC_RPC_URL="$RPC" \
NEXT_PUBLIC_TOOLSHED_ADDRESS="$SHED" \
TOOLSHED_DEPLOY_BLOCK="$DEPLOY_BLOCK" \
INDEXER_CONFIRMATIONS=0 \
npx tsx scripts/e2e-check.ts

say "PASS  onchain settlement and the offchain track record agree."
