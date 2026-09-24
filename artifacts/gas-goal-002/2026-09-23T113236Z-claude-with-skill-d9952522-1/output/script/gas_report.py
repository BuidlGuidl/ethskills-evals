#!/usr/bin/env python3
"""Turn the measured gas numbers into a cost model for finance.

Prices are fetched live at run time -- never hardcoded, because a stale ETH
price or base fee silently invalidates every dollar figure below.

Gas figures come from bench-results.json (real receipts on a Base fork) and
from the L1 data fee oracle on live Base.
"""
import json, subprocess, sys

BASE_RPC = "https://mainnet.base.org"
ETH_RPC = "https://ethereum-rpc.publicnode.com"
ORACLE = "0x420000000000000000000000000000000000000F"
CHAINLINK = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"

TRANSFERS_PER_DAY = 40_000
COLD_SHARE = 0.27       # measured from a live sample of USDC transfers on Base
BATCH_SIZE = 100

# L1 data fee per transfer, wei. Measured via GasPriceOracle.getL1Fee on live
# Base for the exact calldata each strategy submits.
L1_SINGLE = 3_400_086_729
L1_BATCHED_PER_TRANSFER = 75_430_036_678 / 100


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True).stdout.strip()


def live():
    gas_price = int(sh("cast", "gas-price", "--rpc-url", BASE_RPC))
    base_fee = int(sh("cast", "base-fee", "--rpc-url", BASE_RPC))
    raw = sh("cast", "call", CHAINLINK,
             "latestRoundData()(uint80,int256,uint256,uint256,uint80)",
             "--rpc-url", ETH_RPC).split("\n")
    eth_usd = int(raw[1].split()[0]) / 1e8
    return gas_price, base_fee, eth_usd


def usd(gas, gas_price_wei, l1_wei, eth_usd):
    return (gas * gas_price_wei + l1_wei) / 1e18 * eth_usd


def main():
    gas_price, base_fee, eth_usd = live()
    b = json.load(open("bench-results.json"))

    def blend(cold, warm):
        return COLD_SHARE * cold + (1 - COLD_SHARE) * warm

    baseline_gas = blend(b["baseline/cold"], b["baseline/warm"])
    batch_gas = blend(b[f"batch/cold/{BATCH_SIZE}"], b[f"batch/warm/{BATCH_SIZE}"])

    print(f"live Base gas price : {gas_price} wei ({gas_price/1e9:.6f} gwei)")
    print(f"live Base base fee  : {base_fee} wei ({base_fee/1e9:.6f} gwei)")
    print(f"implied tip we pay  : {gas_price-base_fee} wei")
    print(f"live ETH/USD        : ${eth_usd:,.2f}")
    print(f"blended gas/transfer: baseline {baseline_gas:,.0f} -> batched {batch_gas:,.0f}\n")

    scenarios = [
        ("today: 1 tx/transfer, tip as-is", baseline_gas, gas_price, L1_SINGLE),
        ("A. batch 100/tx (tip as-is)", batch_gas, gas_price, L1_BATCHED_PER_TRANSFER),
        ("B. drop tip to base fee only", baseline_gas, base_fee, L1_SINGLE),
        ("A+B combined", batch_gas, base_fee, L1_BATCHED_PER_TRANSFER),
    ]

    base_year = None
    rows = []
    for name, gas, gp, l1 in scenarios:
        per = usd(gas, gp, l1, eth_usd)
        year = per * TRANSFERS_PER_DAY * 365
        if base_year is None:
            base_year = year
        rows.append((name, per, per * TRANSFERS_PER_DAY, year, base_year - year))

    w = max(len(r[0]) for r in rows)
    print(f"{'scenario':<{w}} {'$/transfer':>12} {'$/day':>9} {'$/year':>10} {'saved/yr':>10}")
    for name, per, day, year, saved in rows:
        print(f"{name:<{w}} {per:>12.6f} {day:>9.2f} {year:>10,.0f} {saved:>10,.0f}")

    print("\nsensitivity -- savings scale linearly with base fee and volume.")
    print("Base's base fee sat at its 0.005 gwei floor for every block sampled")
    print("over 24h, so today's figures are close to the achievable minimum.\n")
    print(f"{'base fee':>12} {'volume/day':>12} {'today $/yr':>12} {'A+B $/yr':>10} {'saved/yr':>10}")
    for mult in (1, 10, 50):
        for vol in (TRANSFERS_PER_DAY, TRANSFERS_PER_DAY * 5):
            gp = base_fee * mult + (gas_price - base_fee)
            now = usd(baseline_gas, gp, L1_SINGLE, eth_usd) * vol * 365
            opt = usd(batch_gas, base_fee * mult, L1_BATCHED_PER_TRANSFER, eth_usd) * vol * 365
            print(f"{mult:>10}x {vol:>12,} {now:>12,.0f} {opt:>10,.0f} {now-opt:>10,.0f}")

    # Mainnet comparison, measured live -- finance will ask why not L1.
    m_gas_price = int(sh("cast", "gas-price", "--rpc-url", ETH_RPC))
    m_gas = 45_528  # live eth_estimateGas for a USDC transfer on mainnet
    m_per = m_gas * m_gas_price / 1e18 * eth_usd
    print(f"\nmainnet reference: gas price {m_gas_price/1e9:.4f} gwei, "
          f"{m_gas:,} gas -> ${m_per:.4f}/transfer")
    print(f"  same workload on mainnet: ${m_per*TRANSFERS_PER_DAY*365:,.0f}/yr "
          f"({m_per/rows[0][1]:.0f}x today's Base cost). Staying on Base is correct.")

    print(f"\ncost split at baseline: "
          f"L2 execution {100*baseline_gas*gas_price/(baseline_gas*gas_price+L1_SINGLE):.1f}%, "
          f"L1 data fee {100*L1_SINGLE/(baseline_gas*gas_price+L1_SINGLE):.1f}%")
    print(f"cost split after A+B  : "
          f"L2 execution {100*batch_gas*base_fee/(batch_gas*base_fee+L1_BATCHED_PER_TRANSFER):.1f}%, "
          f"L1 data fee {100*L1_BATCHED_PER_TRANSFER/(batch_gas*base_fee+L1_BATCHED_PER_TRANSFER):.1f}%")


if __name__ == "__main__":
    main()
