#!/usr/bin/env bash
set -euo pipefail

: "${RPC_URL:?Set RPC_URL to the target chain RPC endpoint.}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY to the deployer private key.}"
: "${USDC_ADDRESS:?Set USDC_ADDRESS to the canonical USDC contract on the target chain.}"
: "${OWNER_ADDRESS:?Set OWNER_ADDRESS to the address that will own billing administration.}"
: "${TREASURY_ADDRESS:?Set TREASURY_ADDRESS to the address that receives earned revenue.}"

FOUNDRY_HOME="${FOUNDRY_HOME:-$PWD/.foundry-home}"
FOUNDRY_CACHE_HOME="${XDG_CACHE_HOME:-$PWD/.foundry-cache}"
mkdir -p "$FOUNDRY_HOME" "$FOUNDRY_CACHE_HOME"

HOME="$FOUNDRY_HOME" XDG_CACHE_HOME="$FOUNDRY_CACHE_HOME" \
  forge create src/UsdSubscriptionVault.sol:UsdSubscriptionVault \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$USDC_ADDRESS" "$OWNER_ADDRESS" "$TREASURY_ADDRESS"
