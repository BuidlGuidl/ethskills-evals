#!/usr/bin/env bash
# Sends a handful of tips from the default Anvil accounts so the feed has
# something in it on first load.
#
# Usage: ./scripts/seed-tips.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
DEPLOYMENT="$ROOT/contracts/deployments/$CHAIN_ID.json"

if [[ ! -f "$DEPLOYMENT" ]]; then
  echo "No deployment for chain $CHAIN_ID. Run ./scripts/deploy-local.sh first." >&2
  exit 1
fi

TIPJAR="$(jq -r .tipJar "$DEPLOYMENT")"
USDC="$(jq -r .usdc "$DEPLOYMENT")"

# key                                                                  name       message                          usdc
TIPS=(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d|ada|love the local dev setup|5"
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a|grace|first tip from the fork|12.5"
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6|linus|coffee is on me|3.25"
)

for ENTRY in "${TIPS[@]}"; do
  IFS='|' read -r KEY NAME MESSAGE AMOUNT <<< "$ENTRY"
  UNITS="$(cast to-wei "$AMOUNT" mwei)"
  SENDER="$(cast wallet address --private-key "$KEY")"

  USDC_ADDRESS="$USDC" RPC_URL="$RPC_URL" "$ROOT/scripts/fund-usdc.sh" "$SENDER" 10000 > /dev/null

  cast send "$USDC" "approve(address,uint256)" "$TIPJAR" "$UNITS" \
    --private-key "$KEY" --rpc-url "$RPC_URL" > /dev/null
  cast send "$TIPJAR" "tip(uint256,string,string)" "$UNITS" "$NAME" "$MESSAGE" \
    --private-key "$KEY" --rpc-url "$RPC_URL" > /dev/null

  echo "$NAME tipped $AMOUNT USDC"
done

TOTAL="$(cast call "$TIPJAR" "totalTipped()(uint256)" --rpc-url "$RPC_URL")"
COUNT="$(cast call "$TIPJAR" "tipCount()(uint256)" --rpc-url "$RPC_URL")"
echo "Jar now holds $(cast from-wei "${TOTAL%% *}" mwei) USDC across ${COUNT%% *} tips"
