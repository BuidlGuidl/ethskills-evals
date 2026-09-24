# Recommendation

Integrate **Aerodrome Slipstream** for the Base USDC -> WETH swap leg.

Router to put in config:

```text
0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

This is Aerodrome's **Slipstream SwapRouter** on Base.

Why this route:

- Aerodrome is the native liquidity hub on Base, and the current Base DEX volume tables show **Aerodrome Slipstream** as the largest Base DEX venue by a wide margin. TopOfBase/DefiLlama data on Sep. 22, 2026 showed Aerodrome Slipstream at about 50% of Base DEX volume, versus about 20% for Uniswap V3.
- For a large USDC -> WETH flow, the relevant liquidity is concentrated liquidity, not just older v2-style constant-product pools. Aerodrome's live pool list includes active WETH/USDC concentrated pools, and Slipstream is the Aerodrome concentrated-liquidity venue.
- Aerodrome's official security/contracts page lists the Slipstream `SwapRouter` at `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`, which is the router I would call for the direct concentrated-liquidity swap path.

I would still quote/simulate each treasury order and enforce `amountOutMinimum`; for hundreds of thousands of USDC, execution should be split/TWAPed if the live quote shows too much price impact. But as the primary on-chain Base venue to integrate for deep USDC/WETH liquidity, I would start with Aerodrome Slipstream.

Sources checked:

- Aerodrome official contract list: https://aerodrome-finance.app/security/
- Base DEX volume ranking: https://topofbase.com/rankings/dex
- Aerodrome pool/liquidity docs: https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
