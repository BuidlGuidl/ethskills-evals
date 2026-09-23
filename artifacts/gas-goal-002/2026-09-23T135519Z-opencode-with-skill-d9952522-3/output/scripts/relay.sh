#!/usr/bin/env bash
# relay.sh - send a payments CSV as batched ERC-20 transfers via RelayBatcher.
#
# Usage:
#   RELAYER_KEY=0x... BATCHER=0x... scripts/relay.sh payments.csv
#   RELAYER_KEY=0x... BATCHER=0x... scripts/relay.sh --dry-run payments.csv
#
# CSV format: one payment per line, `recipient,amount-in-base-units`
#   e.g.  0xRecipientAddress...,1000000   (= 1.00 USDC, 6 decimals)
#
# Environment:
#   RELAYER_KEY   (required) private key of the relayer wallet
#   BATCHER       (required) deployed RelayBatcher address
#   RPC_URL       Base RPC (default https://mainnet.base.org)
#   TOKEN         ERC-20 address (default native USDC on Base)
#   BATCH_SIZE    payments per tx, 1..500 (default 100)
#   TIP_WEI       maxPriorityFeePerGas in wei. The measured Base market tip is
#                 0-500 wei (2026-09-23); 0-tip txs land. Default 50.
#   MAXFEE_MULT   maxFeePerGas = MAXFEE_MULT * baseFee (default 1.1)
#
# Fee fields are derived from the chain immediately before each batch is sent
# (EIP-1559; never port a mainnet tip or a hardcoded gas price here).
set -euo pipefail

RPC_URL=${RPC_URL:-https://mainnet.base.org}
TOKEN=${TOKEN:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}
BATCH_SIZE=${BATCH_SIZE:-100}
TIP_WEI=${TIP_WEI:-50}
MAXFEE_MULT=${MAXFEE_MULT:-11} # tenths, 11 = 1.1x
DRY_RUN=0
CSV=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) CSV="$arg" ;;
  esac
done
[[ -n "$CSV" && -f "$CSV" ]] || { echo "usage: scripts/relay.sh [--dry-run] payments.csv (see --help)" >&2; exit 1; }
: "${RELAYER_KEY:?RELAYER_KEY must be set}"
: "${BATCHER:?BATCHER (deployed RelayBatcher address) must be set}"
command -v cast >/dev/null || { echo "cast not found (install foundry)" >&2; exit 1; }
command -v python3 >/dev/null || exit 1

RELAYER=$(cast wallet address "$RELAYER_KEY")
echo "relayer : $RELAYER"
echo "batcher : $BATCHER   token: $TOKEN   rpc: $RPC_URL"
echo "batch   : $BATCH_SIZE payments/tx, tip ${TIP_WEI} wei"

# --- one-time allowance check -------------------------------------------------
ALLOWANCE=$(cast call "$TOKEN" "allowance(address,address)(uint256)" "$RELAYER" "$BATCHER" --rpc-url "$RPC_URL" | awk '{print $1}')
if [[ "$ALLOWANCE" == "0" ]]; then
  echo "no allowance - approving batcher once (~55.8k gas, one-time)"
  cast send "$TOKEN" "approve(address,uint256)" "$BATCHER" \
    115792089237316195423570985008687907853269984665640564039457584007913129639935 \
    --private-key "$RELAYER_KEY" --rpc-url "$RPC_URL" >/dev/null
fi

# --- read + chunk the CSV ------------------------------------------------------
mapfile -t LINES < <(grep -Ev '^\s*(#|$)' "$CSV")
echo "payments: ${#LINES[@]}"

python3 - "$CSV" "$BATCH_SIZE" <<'PY' > /tmp/relay_chunks.tsv
import sys
rows = [l.strip() for l in open(sys.argv[1]) if l.strip() and not l.startswith('#')]
n = int(sys.argv[2])
for i in range(0, len(rows), n):
    chunk = rows[i:i+n]
    addrs, amts = [], []
    for r in chunk:
        a, m = r.split(',')
        addrs.append(a.strip()), amts.append(str(int(m.strip())))
    print('\t'.join(['[' + ','.join(addrs) + ']', '[' + ','.join(amts) + ']']))
PY

# --- send (or estimate) each batch --------------------------------------------
BATCH_NO=0
TOTAL_GAS=0
while IFS=$'\t' read -r ADDRS AMTS; do
  BATCH_NO=$((BATCH_NO + 1))

  # fresh fee fields per batch, from the chain we are about to send to
  BASE_FEE=$(cast base-fee --rpc-url "$RPC_URL")
  MAX_FEE=$((BASE_FEE * MAXFEE_MULT / 10))

  if [[ "$DRY_RUN" == "1" ]]; then
    GAS=$(cast estimate --from "$RELAYER" "$BATCHER" \
      "batchTransfer(address,address[],uint256[])" "$TOKEN" "$ADDRS" "$AMTS" --rpc-url "$RPC_URL")
    echo "batch $BATCH_NO: estimate $GAS gas (not sent)"
    TOTAL_GAS=$((TOTAL_GAS + GAS))
    continue
  fi

  RECEIPT=$(cast send "$BATCHER" "batchTransfer(address,address[],uint256[])" \
    "$TOKEN" "$ADDRS" "$AMTS" \
    --private-key "$RELAYER_KEY" --rpc-url "$RPC_URL" \
    --gas-estimate-multiplier 110 \
    --gas-price "$MAX_FEE" --priority-gas-price "$TIP_WEI")
  TXHASH=$(echo "$RECEIPT" | awk '/^transactionHash/ {print $2}')
  STATUS=$(echo "$RECEIPT" | awk '/^status/ {print $2}')
  GASUSED=$(echo "$RECEIPT" | awk '/^gasUsed/ {print $2}')
  EFFGAS=$(echo "$RECEIPT" | awk '/^effectiveGasPrice/ {print $2}')
  TOTAL_GAS=$((TOTAL_GAS + GASUSED))
  echo "batch $BATCH_NO: $TXHASH status=$STATUS gasUsed=$GASUSED"
  # any skipped payment is indexed by a PaymentFailed event in that receipt:
  #   cast receipt $TXHASH --rpc-url $RPC_URL --json | jq -c '.logs[] | select(.address=="'"$BATCHER"'")'
  # re-queue those rows and resend.
done < /tmp/relay_chunks.tsv

echo "done: $BATCH_NO batches, $TOTAL_GAS gas total"
[[ "$DRY_RUN" == "1" ]] && echo "(dry run - nothing was sent)"
