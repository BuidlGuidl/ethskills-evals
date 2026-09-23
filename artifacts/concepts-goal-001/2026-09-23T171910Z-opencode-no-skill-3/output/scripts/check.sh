#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${RPC_URL:?RPC_URL is not set}"
: "${BILLING_ADDRESS:?BILLING_ADDRESS is not set}"

if [ $# -ne 1 ]; then
  echo "usage: scripts/check.sh <customer-address>"
  exit 1
fi

cast call "$BILLING_ADDRESS" "isSubscribed(address)(bool)" "$1" --rpc-url "$RPC_URL"
cast call "$BILLING_ADDRESS" "getSubscription(address)(uint8,uint64,uint16,uint256)" "$1" --rpc-url "$RPC_URL"
