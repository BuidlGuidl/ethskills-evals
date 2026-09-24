I would integrate Aerodrome on Base for the USDC -> WETH swap leg.

Router to call on Base:

```text
0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
```

Reasoning:

Aerodrome is the Base-native liquidity hub and the dominant DEX on Base, rather than just another fork competing at the edge. For a treasury desk moving hundreds of thousands of USDC per swap into WETH, the priority is depth and execution quality. Aerodrome's ve(3,3) incentive design directs AERO emissions toward voted pools, which is why it has historically concentrated a large share of Base liquidity and volume in the most important pairs.

I would not default to Uniswap V3/V4 on Base for this route just because it is the familiar integration. Uniswap is important and should still be quoted as a comparison path, but for the deepest Base-native venue, Aerodrome is the router I would put in the config.

Address checks:

- Aerodrome contracts repository lists the Base Router as `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`.
- Base on-chain bytecode exists at that address via `eth_getCode`.
- BaseScan labels the same address as the Aerodrome Router.

Operational note: for trades this large, I would still quote immediately before execution, set a strict `amountOutMin`, and compare against an aggregator such as 1inch if the execution stack supports split routing. But if the config needs one Base DEX/router venue for deep USDC/WETH liquidity, use Aerodrome.
