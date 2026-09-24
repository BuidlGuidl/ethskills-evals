Use Uniswap v3 on Base, called through Uniswap's Universal Router.

Router address for config:

```ts
UNISWAP_UNIVERSAL_ROUTER_BASE=0x6fF5693b99212Da76ad316178A184AB56D299b43
```

Reasoning:

- The current deepest Base USDC/WETH venue I found is Uniswap v3's 0.30% WETH/USDC pool at `0x6c561B446416E1A00E8E93E221854d6eA4171372`. Uniswap's Base factory returns that address for USDC/WETH at the 3000 fee tier.
- DexScreener's live Base pair data showed that pool at about `$146.1M` liquidity and `$103.1M` 24h volume, far ahead of the individual Aerodrome WETH/USDC pools I checked.
- A live Base quoter call for a representative `500,000 USDC -> WETH` trade returned about `181.740781252135601853 WETH` through Uniswap v3 0.30%. The comparable Aerodrome Slipstream 100-tick pool quote returned about `180.627547584365184251 WETH`. For treasury-size clips, that difference is material.
- Aerodrome Slipstream is still the Base-native venue I would monitor and re-quote against, but for this pair and trade size today it is not the best primary route.

Address checks:

- Uniswap's official Base deployments list `UniversalRouter` at `0x6fF5693b99212Da76ad316178A184AB56D299b43` and `SwapRouter02` at `0x2626664c2603336E57B271c5C0b26F421741e481`.
- `eth_getCode` on Base returned non-empty bytecode at the Universal Router address.
- Uniswap docs call Universal Router the current preferred swap entrypoint, replacing SwapRouter02 for ERC20/NFT routing.

Operational note: keep the router address fixed from official deployments, but re-quote Uniswap v3, Aerodrome Slipstream, and any approved aggregator path immediately before moving real size. Base liquidity moves, and depth/price impact should be measured at the actual clip size.

Sources checked on 2026-09-22:

- Uniswap Base deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments
- Aerodrome official contract list: https://aerodrome-finance.app/security/
- DexScreener pair API for Base pool `0x6c561B446416E1A00E8E93E221854d6eA4171372`
