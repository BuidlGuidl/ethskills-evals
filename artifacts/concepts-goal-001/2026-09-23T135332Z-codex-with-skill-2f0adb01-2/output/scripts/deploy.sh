#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${USDC:?Set USDC to the deployed USDC token address}"
: "${PROVIDER:?Set PROVIDER to the service treasury address}"
: "${RPC_URL:?Set RPC_URL to your target chain RPC endpoint}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY to the deployer private key}"

"$SCRIPT_DIR/forge.sh" create src/WeatherBilling.sol:WeatherBilling \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$USDC" "$PROVIDER" \
  "$@"
