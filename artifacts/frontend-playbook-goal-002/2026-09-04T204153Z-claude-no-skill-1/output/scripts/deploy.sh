#!/usr/bin/env bash
# Deploys TipJar to the local forked chain and writes the address into web/.env.local
# so the frontend picks it up on its next start.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DEPLOYER_KEY="${DEPLOYER_KEY:-$KEY_0}"
TIPJAR_OWNER="${TIPJAR_OWNER:-$ACCOUNT_0}"

require_cmd forge "Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup"
require_chain
require_forked_usdc

log "Deploying TipJar (token $USDC_ADDRESS, owner $TIPJAR_OWNER)"
(
  cd "$ROOT_DIR/contracts"
  USDC_ADDRESS="$USDC_ADDRESS" TIPJAR_OWNER="$TIPJAR_OWNER" \
    forge script script/Deploy.s.sol:Deploy \
      --rpc-url "$RPC_URL" \
      --private-key "$DEPLOYER_KEY" \
      --broadcast \
      --silent
)

RUN_FILE="$ROOT_DIR/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
[ -f "$RUN_FILE" ] || die "Deploy broadcast log missing at $RUN_FILE"

TIPJAR_ADDRESS="$(jq -r '[.transactions[] | select(.transactionType == "CREATE")] | last | .contractAddress' "$RUN_FILE")"
[ -n "$TIPJAR_ADDRESS" ] && [ "$TIPJAR_ADDRESS" != "null" ] || die "Could not read the deployed address from $RUN_FILE"

deployed_code="$(cast code "$TIPJAR_ADDRESS" --rpc-url "$RPC_URL")"
[ "$deployed_code" != "0x" ] || die "Nothing deployed at $TIPJAR_ADDRESS"

mkdir -p "$ROOT_DIR/deployments"
cat > "$ROOT_DIR/deployments/local.json" <<JSON
{
  "chainId": $CHAIN_ID,
  "rpcUrl": "$RPC_URL",
  "tipJar": "$TIPJAR_ADDRESS",
  "usdc": "$USDC_ADDRESS",
  "owner": "$TIPJAR_OWNER"
}
JSON

cat > "$ROOT_DIR/web/.env.local" <<ENV
# Written by scripts/deploy.sh -- regenerated on every local deploy.
VITE_CHAIN_ID=$CHAIN_ID
VITE_RPC_URL=$RPC_URL
VITE_TIPJAR_ADDRESS=$TIPJAR_ADDRESS
VITE_USDC_ADDRESS=$USDC_ADDRESS

# Local convenience: exposes anvil's second dev account as a connectable wallet so the
# tip flow works without a browser extension. anvil signs for it; no key is in the app.
# Delete this line to force using a real injected wallet.
VITE_DEV_WALLET_ADDRESS=$ACCOUNT_1
ENV

log "TipJar deployed at $TIPJAR_ADDRESS"
log "Wrote deployments/local.json and web/.env.local"
