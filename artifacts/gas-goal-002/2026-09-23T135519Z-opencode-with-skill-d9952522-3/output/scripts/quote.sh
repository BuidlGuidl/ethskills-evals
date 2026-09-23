#!/usr/bin/env bash
# quote.sh - live cost model for the Base payout relayer (for finance).
#
# Re-prints the PLAN.md numbers with today's prices. No forking, no keys,
# read-only RPC calls. Every dollar figure below is computed, not remembered.
#
#   scripts/quote.sh                # 40,000 payments/day, batch of 100
#   PAYMENTS=25000 scripts/quote.sh # other volumes
#   GAS_STANDALONE=62647 GAS_BATCHED=30101 scripts/quote.sh  # override gas
#
# Gas defaults were measured on 2026-09-23 (see PLAN.md "Provenance"):
#   GAS_STANDALONE: one EOA->USDC transfer to a fresh recipient, Base fork
#   GAS_BATCHED   : per-payment cost of batchTransfer with N=100, Base fork
#   L1FEE_TX      : L1 data fee of a 68-byte transfer, read off live receipts
#   L1FEE_BATCH100: L1 data fee of a 100-item batchTransfer calldata (oracle)
set -euo pipefail

RPC=${RPC_URL:-https://mainnet.base.org}
ORACLE=0x420000000000000000000000000000000000000F
GAS_STANDALONE=${GAS_STANDALONE:-62647}
GAS_BATCHED=${GAS_BATCHED:-30101}
L1FEE_TX=${L1FEE_TX:-2894911032}        # wei, measured from receipts
L1FEE_BATCH100=${L1FEE_BATCH100:-101588076583} # wei, GasPriceOracle.getL1Fee
PAYMENTS=${PAYMENTS:-40000}
BATCH_SIZE=${BATCH_SIZE:-100}

command -v cast >/dev/null || { echo "cast not found" >&2; exit 1; }

BASE_FEE=$(cast base-fee --rpc-url "$RPC")            # wei
GAS_PRICE=$(cast gas-price --rpc-url "$RPC")          # wei (baseFee + suggested tip)
ETH_USD_C=$(curl -sf --max-time 10 'https://api.coinbase.com/v2/prices/ETH-USD/spot' | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]["amount"]; print(f"{float(d):.2f}")') \
  || ETH_USD_C=""
if [[ -z "$ETH_USD_C" ]]; then
  ETH_USD=$(cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "latestRoundData()" --rpc-url https://ethereum-rpc.publicnode.com \
    | awk 'NR==2 {printf "%.2f", $1/1e8}')
else
  ETH_USD="$ETH_USD_C"
fi

usd_per_gas() { python3 -c "print($1 * 1e-18 * $ETH_USD)"; }
usd_per_tx_l1() { python3 -c "print($1 * 1e-18 * $ETH_USD)"; }
line() { printf '  %-38s %s\n' "$1" "$2"; }

GWEI_BASE=$(python3 -c "print(f'{$BASE_FEE/1e9:.6f}')")
GWEI_SUGG=$(python3 -c "print(f'{$GAS_PRICE/1e9:.6f}')")
N_BATCHES=$(( (PAYMENTS + BATCH_SIZE - 1) / BATCH_SIZE ))
STRESS_GWEI=0.803 # measured on Base ~90 days before 2026-09-23; see PLAN.md

echo "==================================================================="
echo " Base relayer gas cost model - $(date -u +%Y-%m-%dT%H:%MZ)"
echo "==================================================================="
line "payments/day" "$PAYMENTS"
line "ETH/USD (live)" "\$${ETH_USD}"
line "Base base fee (live)" "${GWEI_BASE} gwei"
line "cast gas-price suggestion" "${GWEI_SUGG} gwei (baseFee + tip; conservative)"
line "effective price used below" "base fee (type-2 tx, tip ~0)"

python3 - "$PAYMENTS" "$GAS_STANDALONE" "$GAS_BATCHED" "$N_BATCHES" \
  "$BASE_FEE" "$ETH_USD" "$L1FEE_TX" "$L1FEE_BATCH100" "$STRESS_GWEI" > /tmp/quote_out.txt <<'EOF'
import sys
p, gs, gb, nb, bf, eu, l1t, l1b, sg = map(float, sys.argv[1:10])
cur = p*gs*bf*1e-18*eu + p*l1t*1e-18*eu
bat = p*gb*bf*1e-18*eu + nb*l1b*1e-18*eu
out = [
    f"{p*gs*bf*1e-18*eu:.2f}", f"{p*l1t*1e-18*eu:.2f}",
    f"{p*gb*bf*1e-18*eu:.2f}", f"{nb*l1b*1e-18*eu:.2f}",
    f"{cur:.2f}", f"{cur*30.4:.0f}", f"{cur*365:.0f}",
    f"{bat:.2f}", f"{bat*30.4:.0f}", f"{bat*365:.0f}",
    f"{(cur-bat)/p:.6f}", f"{cur-bat:.2f}", f"{(cur-bat)*30.4:.0f}", f"{(cur-bat)*365:.0f}",
    f"{p*gs*sg*1e-9*eu:.0f}", f"{p*gb*sg*1e-9*eu:.0f}", f"{p*(gs-gb)*sg*1e-9*eu:.0f}",
]
print("\n".join(out))
EOF
mapfile -t Q < /tmp/quote_out.txt
CUR_L2=${Q[0]}; CUR_L1=${Q[1]}; BAT_L2=${Q[2]}; BAT_L1=${Q[3]}
CUR_TOT=${Q[4]}; CUR_MO=${Q[5]}; CUR_YR=${Q[6]}
BAT_TOT=${Q[7]}; BAT_MO=${Q[8]}; BAT_YR=${Q[9]}
SAV_PP=${Q[10]}; SAV_DAY=${Q[11]}; SAV_MO=${Q[12]}; SAV_YR=${Q[13]}
CUR_S=${Q[14]}; BAT_S=${Q[15]}; SAV_S=${Q[16]}

echo
echo " TODAY - one transaction per payment ($GAS_STANDALONE gas + L1 data)"
line "L2 execution gas" "\$$CUR_L2 /day"
line "L1 data fee" "\$$CUR_L1 /day"
line "total (day / month / year)" "\$$CUR_TOT /day, \$$CUR_MO /mo, \$$CUR_YR /yr"

echo
echo " AFTER - RelayBatcher, $BATCH_SIZE per tx ($GAS_BATCHED gas/payment + L1 data)"
line "L2 execution gas" "\$$BAT_L2 /day"
line "L1 data fee" "\$$BAT_L1 /day"
line "total (day / month / year)" "\$$BAT_TOT /day, \$$BAT_MO /mo, \$$BAT_YR /yr"

echo
echo " SAVED (today's prices)"
line "per payment" "\$$SAV_PP"
line "per day / month / year" "\$$SAV_DAY /day, \$$SAV_MO /mo, \$$SAV_YR /yr"

echo
echo " STRESS - if Base gas returns to ${STRESS_GWEI} gwei (level measured ~90d ago)"
line "today's pattern" "\$$CUR_S /day (L2 execution only)"
line "batched" "\$$BAT_S /day"
line "saved" "\$$SAV_S /day at that price level"

echo
echo " All prices live via $RPC; L1 fees via GasPriceOracle receipts."
echo " Re-measure gas: see PLAN.md provenance (Base fork, real USDC)."
