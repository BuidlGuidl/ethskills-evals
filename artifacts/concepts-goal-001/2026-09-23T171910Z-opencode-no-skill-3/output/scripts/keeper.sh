#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${RPC_URL:?RPC_URL is not set}"
: "${PRIVATE_KEY:?PRIVATE_KEY is not set}"
: "${BILLING_ADDRESS:?BILLING_ADDRESS is not set}"

FILE=${1:-subscribers.txt}
BATCH=${KEEPER_BATCH_SIZE:-50}

if [ ! -s "$FILE" ]; then
  echo "nothing to settle"
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
grep -vE '^[[:space:]]*$|^#' "$FILE" > "$TMP/addresses.txt" || true

split -l "$BATCH" "$TMP/addresses.txt" "$TMP/batch-"

for chunk in "$TMP"/batch-*; do
  addrs=$(paste -sd, "$chunk")
  echo "settling batch: $addrs"
  cast send "$BILLING_ADDRESS" "settleMany(address[])" "[$addrs]" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
done
