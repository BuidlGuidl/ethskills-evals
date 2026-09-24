Recommendation: integrate 1inch Aggregation Router V6 on Base.

Router address for config:

```text
0x111111125421cA6dc452d289314280a0f8842A65
```

Why: for treasury-sized USDC -> WETH swaps, I would not hard-wire a single AMM pool as the only execution venue. Current Base liquidity for this pair is fragmented: Aerodrome Slipstream is the dominant high-volume Base-native DEX route, while the deepest single WETH/USDC pool I found today is on Uniswap V3, and PancakeSwap also has meaningful flow. An aggregation router can route or split through the venue that is best for the exact order size at execution time, which is what matters for hundreds of thousands of USDC where price impact can dominate small fee differences.

I verified the address against the local addresses skill and checked that it has deployed bytecode on Base. 1inch's docs also use this AggregationRouterV6 address, and BaseScan labels it as "1inch: Aggregation Router V6".

Operational note: use the 1inch quote/swap API or your own quoting layer to generate calldata, set a strict minimum-out / slippage bound, and re-quote immediately before signing. If policy requires a single DEX-only adapter instead of an aggregator, do not assume one static venue forever; run live size quotes between Uniswap V3 and Aerodrome Slipstream for the configured notional.

Sources checked:
- Local verified address book: 1inch Aggregation Router V6 on Base.
- 1inch docs: https://business.1inch.com/portal/documentation/apis/swap/classic-swap/quick-start
- BaseScan: https://basescan.org/address/0x111111125421cA6dc452d289314280a0f8842A65
- Base DEX volume context: https://defillama.com/dexs/chains/Base
- Pair-level liquidity sanity checks: https://dexscreener.com/base/0x6c561b446416e1a00e8e93e221854d6ea4171372 and https://dexscreener.com/base/0x3fe04a59ebd38cf06080a6f60a98d124eb59392a
