#!/usr/bin/env bash
set -euo pipefail

: "${RPC_URL:?set RPC_URL}"
: "${KEEPER_PRIVATE_KEY:?set KEEPER_PRIVATE_KEY}"
: "${BILLING_ADDRESS:?set BILLING_ADDRESS}"

FILE=${1:-customers.txt}
CHUNK_SIZE=${CHUNK_SIZE:-150}

if [[ ! -f "$FILE" ]]; then
  echo "address file $FILE not found"
  exit 1
fi

mapfile -t customers < <(grep -E '^0x[0-9a-fA-F]{40}$' "$FILE")

total=${#customers[@]}
if (( total == 0 )); then
  echo "no customer addresses found in $FILE"
  exit 0
fi

echo "settling $total customer(s) in chunks of $CHUNK_SIZE"

for (( start = 0; start < total; start += CHUNK_SIZE )); do
  chunk=("${customers[@]:start:CHUNK_SIZE}")
  args=$(IFS=,; echo "${chunk[*]}")
  cast send "$BILLING_ADDRESS" \
    "settleMany(address[])" \
    "[${args}]" \
    --rpc-url "$RPC_URL" \
    --private-key "$KEEPER_PRIVATE_KEY"
done

echo "keeper run complete"
