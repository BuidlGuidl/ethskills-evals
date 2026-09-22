# Lending market oracle review

Do not use `slot0` from the Uniswap V3 WETH/USDC 0.05% pool as the lending
oracle. `slot0` is the price after the last swap. An attacker does not need to
keep the pool mispriced for a block, and arbitrage bots do not get to repair
the price between the attacker's swap and our contract's oracle read inside the
same transaction or bundle.

## Cost to move the spot price 10%

Use a generous model for the pool: assume the whole advertised `$200M` is useful
active depth around the current price, split as `$100M` of WETH and `$100M` of
USDC, and approximate the local Uniswap V3 range as constant product. Real V3
depth can be worse because total TVL is not the same as active liquidity at the
ticks we need to cross.

For a constant-product pool, moving price by a factor `r` changes reserves by
`sqrt(r)`.

To make WETH look 10% more expensive, `r = 1.10`:

```text
USDC net in = 100,000,000 * (sqrt(1.10) - 1)
            = 4,880,885 USDC

USDC gross in after 5 bp fee ~= 4,883,326 USDC
WETH received, at fair value ~= 4,653,741 USDC
```

The attacker then calls our lending contract while `slot0` is 10% high. After
that call, they swap the WETH back through the same pool. The price path is
mostly reversible; the real loss is basically the two pool fees plus gas. With
the 5 bp fee, the round-trip loss is about `$4,800`, not millions.

To make WETH look 10% cheaper, which is the liquidation direction:

```text
WETH gross in, at fair value ~= 5,411,961 USDC
USDC received ~= 5,131,670 USDC
round-trip loss after unwinding ~= 5,300 USDC, plus gas
```

So the attacker needs roughly `$5M` of flash-borrowed trading notional for one
transaction, but the economic cost of the temporary 10% oracle error is only
around `$5k` plus gas under this favorable-to-the-pool model. Arbitrage after
the transaction does not save us; the bad oracle read has already happened.

## What the attacker gets

A 10% low WETH price turns healthy positions near the 85% liquidation threshold
into liquidatable positions.

For a max-size position with `$2,000,000` of real WETH collateral:

```text
true liquidation threshold = 85% * 2,000,000 = 1,700,000 USDC debt

oracle value after 10% low price = 1,800,000
apparent liquidation threshold = 85% * 1,800,000 = 1,530,000 USDC debt
```

So any position with debt between `$1.53M` and `$1.70M` can be healthy at the
real market price and liquidatable at the manipulated price.

If the liquidation uses the manipulated oracle price to calculate collateral
seized, even with no explicit liquidation bonus the liquidator buys WETH at a
10% discount:

```text
true value seized per 1 USDC repaid = 1 / 0.90 = 1.111...
profit before fees = 11.11% of repaid debt
```

That is `$170k` of value on `$1.53M` repaid, or about `$189k` on `$1.70M`
repaid. If the protocol also has a 5% liquidation bonus, the profit becomes:

```text
profit = debt * ((1.05 / 0.90) - 1)
       = 16.67% of repaid debt
```

That is roughly `$255k` to `$283k` on these max-size positions, before gas and
before any close-factor cap. A close factor would scale the profit down, but it
also scales the required repay amount down; the oracle manipulation cost remains
only around `$5k`.

The high-price direction is also dangerous: a 10% inflated WETH price lets a
borrower take up to:

```text
extra debt = 10% * 85% * 2,000,000 = 170,000 USDC
```

more than the real collateral value supports. But the false-liquidation path is
already enough to reject `slot0`.

## Recommended pricing

Use Chainlink on Ethereum mainnet as the primary source for WETH collateral:

- Price WETH with the Chainlink ETH/USD feed.
- Price USDC debt with a USDC/USD feed, or have an explicit policy for treating
  USDC at par and pausing when USDC/USD is outside a tight band.
- Optionally compare the implied ETH/USDC price against a long-window Uniswap
  V3 TWAP or another independent source as a circuit breaker. Do not use
  Uniswap `slot0` as the value used for liquidations or borrowing.

A Uniswap TWAP can be useful as a secondary check or emergency fallback, but
only with a window long enough that sustaining manipulation across the window
costs more than the maximum value extractable from the protocol. A single-block
spot price has the wrong security property for lending.

## Checks before using the price in health calculations

Before a price can affect borrowing, withdrawals, or liquidations:

- The oracle answer must be positive and the round must be complete.
- `updatedAt` must be nonzero, not in the future, and no older than a configured
  max staleness bound based on the feed heartbeat plus a small grace period.
- Feed decimals and token decimals must be handled explicitly: WETH has 18
  decimals, USDC has 6, and Chainlink feeds have their own decimals.
- Calculations should use full-precision `mulDiv`-style math and fixed units so
  rounding cannot make an unhealthy account look healthy or vice versa.
- If ETH/USD and USDC/USD imply a price that deviates too far from a long-window
  DEX TWAP or another independent source, pause the action or use the
  conservative value according to protocol policy.
- If USDC/USD is outside the accepted band, pause new borrows and liquidations
  or switch to explicitly conservative pricing. Do not silently assume a depeg
  cannot happen.
- On oracle failure, fail closed for actions that can create bad debt or enable
  false liquidations.

The core point: Chainlink can be stale if we fail to check freshness, but
Uniswap `slot0` can be made freshly wrong exactly when our contract reads it.
For this market size, the attack costs thousands and can extract hundreds of
thousands. That is not an acceptable collateral oracle.
