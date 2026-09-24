I would integrate **Aerodrome on Base** for the direct DEX route.

Router to call on Base:

```text
0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
```

Reasoning:

- Aerodrome is the Base-native liquidity hub and the dominant DEX on Base, so it is the first direct venue I would wire for large USDC -> WETH swaps rather than defaulting to a mainnet-first venue.
- Its ve(3,3) incentives pull liquidity toward important Base pairs, which matters for treasury-sized trades where depth and slippage dominate gas cost.
- The router address above is the verified Aerodrome Router on Base and is also labeled as `Aerodrome: Router` on BaseScan.

For production execution, I would still quote immediately before sending the transaction and enforce a strict `amountOutMin`; for six-figure clips, stale routing assumptions can become expensive quickly.
