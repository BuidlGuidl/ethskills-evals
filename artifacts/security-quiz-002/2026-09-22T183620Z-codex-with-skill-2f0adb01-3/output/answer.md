# Design review: WETH collateral pricing

Do not use `slot0` from the Uniswap V3 WETH/USDC 0.05% pool as the lending oracle. It is a spot price, and the attacker only needs the wrong price to exist at the instant our contract reads it. They can make the swap, call our borrow/liquidation path, and unwind the swap in the same transaction or private bundle. Arbitrage bots cannot insert themselves between those internal calls.

## Manipulation cost

Assume, generously for the Uniswap argument, that the pool behaves like a $200M constant-product pool with $100M of WETH value and $100M of USDC value on each side. This is not exactly how V3 concentrated liquidity works, but it is a useful sanity check: it treats the quoted $200M as usable depth around the current price.

For a constant-product pool, moving the price by a factor `r` changes the relevant reserve by `sqrt(r)`.

To make WETH read 10% too expensive:

```text
effective USDC in = 100,000,000 * (sqrt(1.10) - 1)
                  = 4,880,885 USDC

gross USDC in at 5 bp fee = 4,880,885 / 0.9995
                          = 4,883,326 USDC
```

Then the attacker lets our contract read the inflated price and swaps back. The reverse leg is about $4,656,069 of WETH notional. With zero fee, the round trip mostly nets out. With the 0.05% fee, the permanent loss is only about:

```text
0.05% * 4,883,326 + 0.05% * 4,656,069 ~= $4,770
```

To make WETH read 10% too cheap:

```text
effective WETH value in = 100,000,000 * (1 / sqrt(0.90) - 1)
                        = 5,409,255 USD value

gross WETH value in at 5 bp fee = 5,409,255 / 0.9995
                                = 5,411,961 USD value
```

The reverse leg is about $5,134,237 of USDC notional, so the permanent round-trip loss is about:

```text
0.05% * 5,411,961 + 0.05% * 5,134,237 ~= $5,273
```

The capital needed intra-transaction is several million dollars of notional, but that can be flash-borrowed or sourced inside a bundle. The attack cost is not "tens of millions"; under this model it is roughly five thousand dollars plus gas and builder/searcher costs. If the real V3 active liquidity made the notional requirement $20M or $50M, the same point remains: the fee loss on a same-transaction round trip is roughly 10 bp of notional, not the full notional.

## What the attacker gets

The profitable direction is usually making WETH read too cheap and liquidating healthy borrowers.

Take the max position:

```text
true WETH collateral value = $2,000,000
liquidation threshold      = 85%
debt at threshold          = $1,700,000
```

If the oracle reads 10% low, the protocol thinks the collateral is worth only $1,800,000, so that same debt looks like:

```text
1,700,000 / 1,800,000 = 94.4% LTV
```

That account is liquidatable even though it is exactly at the intended threshold at the real market price. If liquidation seizes collateral using the manipulated oracle price, each $1 of USDC repaid buys `$1 / 0.90 = $1.111...` of true WETH value before any liquidation bonus.

For a $1.7M liquidation:

```text
0% bonus:  true WETH seized = 1,700,000 / 0.90        = $1,888,889
           profit before costs = $188,889

5% bonus:  true WETH seized = 1,700,000 * 1.05 / 0.90 = $1,983,333
           profit before costs = $283,333

10% bonus: requested seize value exceeds the $2M collateral cap
           repay to seize all collateral = 2,000,000 * 0.90 / 1.10 = $1,636,364
           profit before costs = $363,636
```

Close factors would scale this down, but even a 50% close factor leaves a 5% bonus liquidation around `$141k` gross profit against about `$5k` of oracle manipulation cost in the simplified pool model.

The other direction, making WETH read 10% too expensive, lets an attacker borrow more:

```text
oracle collateral value = $2,200,000
borrow allowed at 85%  = $1,870,000
proper borrow limit    = $1,700,000
extra USDC borrowed    = $170,000
true LTV after borrow  = 93.5%
```

That does not immediately create bad debt by itself because the attacker still posted $2M of WETH, but it removes most of the safety margin. The account reaches insolvency after only about a 6.5% real WETH drop, compared with 15% from an honest 85% LTV position.

## Recommendation

Price WETH collateral with a manipulation-resistant oracle, not Uniswap `slot0`.

For Ethereum mainnet WETH/USDC health checks, use Chainlink ETH/USD for WETH and Chainlink USDC/USD, or treat USDC as $1 only behind a USDC/USD depeg circuit breaker. A Uniswap V3 TWAP can be useful as a secondary sanity check, but the instantaneous pool price must not be the value that decides borrows or liquidations. If we use Uniswap data at all, use `observe()` over a meaningful window, e.g. 30 minutes or longer, with enough observation cardinality, not `slot0`.

Before a price enters the health calculation, check:

- The feed address, pair orientation, and decimals are the intended ones for mainnet.
- `answer > 0`, `updatedAt != 0`, and the round is complete.
- `block.timestamp - updatedAt` is within the configured heartbeat/grace period for that feed.
- The price is within configured sanity bounds and, ideally, not far from an independent source such as a Uniswap TWAP. Large deviation should pause new borrows and liquidations rather than liquidating at a suspicious price.
- Math handles WETH 18 decimals, USDC 6 decimals, and feed decimals explicitly. Use full-precision `mulDiv`; round collateral value down and debt value up.
- Health checks fail closed for borrow and liquidation when the oracle is stale, invalid, paused, or outside deviation bounds. Repayment should remain available.

The teammate's core mistake is comparing the attacker's temporary trade size to the protocol's risk. For a spot oracle, the attacker does not need to permanently move the market. They only need our contract to sample a bad price for one call, and the liquidation payoff on a $2M account can be tens or hundreds of thousands of dollars.
