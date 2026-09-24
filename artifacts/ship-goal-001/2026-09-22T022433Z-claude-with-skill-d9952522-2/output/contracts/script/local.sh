#!/usr/bin/env bash
# Deploys a mock USDC and Toolshed to a local anvil, then prints the env vars the
# app needs. Run `anvil` in another terminal first.
#
#   cd contracts && ./script/local.sh
#
# anvil account 0 is the steward; accounts 1-3 are seeded as members, matching
# the neighbours in app/src/server/seed.ts.
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
# anvil's deterministic account 0.
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

STEWARD=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
MEMBERS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,0x90F79bf6EB2c4f870365E785982E1f101E93b906

cd "$(dirname "$0")/.."

echo "Deploying mock USDC..."
USDC=$(forge create test/mocks/MockUSDC.sol:MockUSDC \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" --broadcast --json \
  | grep -o '"deployedTo": *"0x[0-9a-fA-F]\{40\}"' | grep -o '0x[0-9a-fA-F]\{40\}')
echo "  USDC: $USDC"

echo "Deploying Toolshed..."
DEPLOY_JSON=$(STEWARD_ADDRESS="$STEWARD" USDC_ADDRESS="$USDC" INITIAL_MEMBERS="$MEMBERS" \
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" --broadcast --json 2>/dev/null)

TOOLSHED=$(echo "$DEPLOY_JSON" | grep -o '"contract_address":"0x[0-9a-fA-F]\{40\}"' \
  | grep -o '0x[0-9a-fA-F]\{40\}' | head -1)
# The block Toolshed landed in — the indexer must start here, not at the head,
# or it misses the MemberSet events from the constructor.
BLOCK=$(echo "$DEPLOY_JSON" | grep -o '"block_number":[0-9]*' | grep -o '[0-9]*' | head -1)

echo "  Toolshed: $TOOLSHED"
echo
echo "Add to app/.env.local:"
echo "  NEXT_PUBLIC_CHAIN_ID=31337"
echo "  NEXT_PUBLIC_RPC_URL=$RPC_URL"
echo "  NEXT_PUBLIC_TOOLSHED_ADDRESS=$TOOLSHED"
echo "  NEXT_PUBLIC_USDC_ADDRESS=$USDC"
echo "  NEXT_PUBLIC_DEPLOY_BLOCK=$BLOCK"
