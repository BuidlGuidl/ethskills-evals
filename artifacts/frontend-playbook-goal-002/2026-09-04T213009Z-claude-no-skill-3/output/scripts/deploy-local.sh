#!/usr/bin/env bash
# Deploys TipJar to the local chain, funds the default Anvil accounts with USDC
# and points the front end at the fresh address.
#
# Usage: ./scripts/anvil.sh   (in another terminal)
#        ./scripts/deploy-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
# Anvil's first prefunded account.
PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
FUND_AMOUNT="${FUND_AMOUNT:-10000}"

if ! cast chain-id --rpc-url "$RPC_URL" > /dev/null 2>&1; then
  echo "No chain at $RPC_URL. Start one first with ./scripts/anvil.sh" >&2
  exit 1
fi

cd "$ROOT/contracts"
PRIVATE_KEY="$PRIVATE_KEY" forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vv

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
DEPLOYMENT="$ROOT/contracts/deployments/$CHAIN_ID.json"
TIPJAR="$(jq -r .tipJar "$DEPLOYMENT")"
USDC="$(jq -r .usdc "$DEPLOYMENT")"
BLOCK="$(jq -r .blockNumber "$DEPLOYMENT")"

# Hand out test USDC so the tip form is usable straight away.
cd "$ROOT"
for ACCOUNT in \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; do
  if [[ "$(cast code "$USDC" --rpc-url "$RPC_URL")" == "0x" ]]; then break; fi
  USDC_ADDRESS="$USDC" RPC_URL="$RPC_URL" ./scripts/fund-usdc.sh "$ACCOUNT" "$FUND_AMOUNT" || true
done

ENV_FILE="$ROOT/web/.env.local"
cat > "$ENV_FILE" <<ENV
# Written by scripts/deploy-local.sh - safe to regenerate.
VITE_TIPJAR_ADDRESS=$TIPJAR
VITE_USDC_ADDRESS=$USDC
VITE_TIPJAR_DEPLOY_BLOCK=$BLOCK
VITE_LOCAL_RPC_URL=$RPC_URL
VITE_LOCAL_CHAIN_ID=$CHAIN_ID

# Uncomment to transact as Anvil account #0 without installing a browser wallet.
# VITE_DEV_WALLET=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ENV

echo
echo "TipJar deployed at $TIPJAR (chain $CHAIN_ID)"
echo "Wrote $ENV_FILE"
