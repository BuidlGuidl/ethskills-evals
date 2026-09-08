#!/usr/bin/env bash
# Sends a few tips from the dev accounts so the feed has something to render.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DEPLOYMENT="$ROOT_DIR/deployments/local.json"
[ -f "$DEPLOYMENT" ] || die "No deployment found. Run: npm run deploy"
TIPJAR_ADDRESS="${TIPJAR_ADDRESS:-$(jq -r .tipJar "$DEPLOYMENT")}"

require_chain

send_tip() {
  local key="$1" amount_usdc="$2" message="$3"
  local units=$((amount_usdc * 1000000))

  cast send "$USDC_ADDRESS" "approve(address,uint256)" "$TIPJAR_ADDRESS" "$units" \
    --private-key "$key" --rpc-url "$RPC_URL" >/dev/null
  cast send "$TIPJAR_ADDRESS" "tip(uint256,string)" "$units" "$message" \
    --private-key "$key" --rpc-url "$RPC_URL" >/dev/null
  log "tipped $amount_usdc USDC -- \"$message\""
}

send_tip "$KEY_1" 5 "gm! loving the newsletter"
send_tip "$KEY_2" 25 "this saved me a whole afternoon, thank you"
send_tip "$KEY_1" 1 "coffee money"

count="$(cast call "$TIPJAR_ADDRESS" "tipCount()(uint256)" --rpc-url "$RPC_URL" | cut -d' ' -f1)"
total="$(cast call "$TIPJAR_ADDRESS" "totalTipped()(uint256)" --rpc-url "$RPC_URL" | cut -d' ' -f1)"
log "feed now has $count tips totalling $(cast to-unit "$total" mwei) USDC"
