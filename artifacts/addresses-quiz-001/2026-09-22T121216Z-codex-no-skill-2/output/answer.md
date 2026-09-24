# Recommendation

Integrate **Uniswap on Base**, calling the **Uniswap Universal Router**:

```text
0x6fF5693b99212Da76ad316178A184AB56D299b43
```

# Why

For this swap leg, I would optimize for the actual route we care about:
**USDC -> WETH on Base**, not just broad DEX brand share.

As of 2026-09-22, the deepest direct Base WETH/USDC venue I found is the
Uniswap v3 0.3% pool:

```text
Pool: 0x6c561B446416E1A00E8E93E221854d6eA4171372
Venue: Uniswap v3 on Base
Pair: WETH / USDC 0.3%
Liquidity: about $145M
24h volume: about $104M
```

That is materially deeper than the Aerodrome WETH/USDC pools visible in the
same pass: the largest Aerodrome Slipstream WETH/USDC pools were around
$8M each, with another classic volatile pool around $7M. Aerodrome is the
native liquidity hub of Base and has very strong aggregate Base volume, but
for treasury-sized USDC -> WETH swaps, the direct Uniswap v3 WETH/USDC depth
is the more important signal.

The router address above comes from Uniswap's official Base deployments page,
which lists `UniversalRouter` as the current preferred ERC20 swap entrypoint
on Base. I would generate calldata with Uniswap routing/quoting off-chain,
execute through the Universal Router, and enforce tight `amountOutMin`
controls. For hundreds-of-thousands-sized trades, I would still quote against
Aerodrome and aggregators at execution time and split orders when needed, but
if the config needs one on-chain router, I would put Uniswap's Universal Router
there.

# Sources

- Uniswap Base deployments:
  https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments
- GeckoTerminal Uniswap v3 Base WETH/USDC 0.3% pool:
  https://www.geckoterminal.com/base/pools/0x6c561b446416e1a00e8e93e221854d6ea4171372
- Aerodrome official contract/liquidity pages:
  https://aerodrome-finance.app/security/
  https://aerodrome-finance.app/liquidity/
