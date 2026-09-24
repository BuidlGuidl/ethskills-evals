# Lending market oracle review

Do not use `slot0` from the Uniswap V3 WETH/USDC 0.05% pool as the lending
oracle. It is an instantaneous spot price, so the attacker does not have to
leave the pool mispriced for arbitrageurs. They can:

1. swap against the pool to move `slot0`,
2. call our borrow or liquidation function while `slot0` is wrong,
3. swap back in the same transaction or bundle.

Arbitrage bots do not get a free chance to fix the price between steps 1 and 2.
The relevant cost is the attacker's atomic round-trip loss, not the notional
amount required to move the pool.

## Manipulation cost

Use a generous model for the pool: assume the quoted `$200M` is real available
constant-product depth around the current price, split as `$100M` of WETH value
and `$100M` of USDC. A real V3 pool can be thinner than this at the relevant
ticks, so this is not a worst case for us.

For a constant-product pool, moving price by a factor `r` requires changing the
reserve by the square root of that factor:

```text
effective quote token in = Y * (sqrt(r) - 1)
sent quote token in     = effective_in / (1 - fee)
```

For a 10% upward WETH price manipulation, `r = 1.10`, `Y = $100M`, and the
Uniswap fee is `0.05% = 0.0005`:

```text
effective USDC in = 100,000,000 * (sqrt(1.10) - 1)
                  = 4,880,885 USDC

USDC sent         = 4,880,885 / 0.9995
                  = 4,883,326 USDC
```

The attacker receives WETH worth about:

```text
100,000,000 * (1 - 1 / sqrt(1.10)) = $4,653,741
```

If they stopped here, they would be down roughly `$229k` mark-to-market. But
they do not need to stop here. After our contract reads the bad price, they sell
the WETH back into the pool. The round trip returns about `$4,878,558`, so the
net manipulation cost is:

```text
4,883,326 - 4,878,558 = $4,769
```

A 10% downward price move is similar. If "10% away" means price becomes `0.90`
of fair value, the attacker needs about `$5.41M` of temporary WETH value and
burns about `$5.3k` on the round trip.

So the correct order of magnitude is:

```text
temporary capital or flash liquidity: about $5M
economic cost if unwound atomically:  about $5k plus gas/MEV bribe
```

That is nowhere close to "tens of millions lost for nothing."

## What the attacker gets

For a maximum-size position with `$2M` of true WETH collateral and an 85% LTV
liquidation threshold:

```text
true collateral value       = $2,000,000
true 85% debt limit         = $1,700,000
collateral value at +10%    = $2,200,000
apparent 85% debt limit     = $1,870,000
extra borrowing capacity    = $170,000
```

That does not automatically mean risk-free profit if the protocol can liquidate
the position after the price normalizes, but it shows the accounting error from
one manipulated read is far larger than the roughly `$5k` manipulation cost.

The cleaner direct profit is malicious liquidation using a 10% low collateral
price. A healthy account at true 76.5% LTV appears to be at 85% LTV:

```text
1,530,000 debt / (2,000,000 collateral * 0.90 oracle price) = 85%
```

If the attacker can liquidate that account while the oracle is 10% low, then
even with no liquidation bonus they repay `$1.53M` and seize collateral that is
worth `$1.70M` at the real market price:

```text
profit before manipulation cost = 1,530,000 / 0.90 - 1,530,000
                                = $170,000
```

With a liquidation bonus `b`, the profit on repaid debt `D` is:

```text
profit = D * ((1 + b) / 0.90 - 1)
```

At a common 5% bonus and `D = $1.53M`, that is about `$255k` before gas and the
roughly `$5k` oracle manipulation cost. If the account is already near the true
85% threshold with `$1.70M` debt, the same 5% bonus is about `$283k`, capped by
the available `$2M` collateral.

One manipulated `slot0` read can therefore pay for itself many times over, and
the payoff can scale further if the transaction liquidates multiple positions
while the price is distorted.

## Recommendation

Price WETH collateral with Chainlink, not Uniswap spot:

```text
WETH/USDC price = ETH/USD Chainlink price / USDC/USD Chainlink price
```

Using ETH/USD for WETH is appropriate because WETH is redeemable 1:1 for ETH.
Use USDC/USD instead of blindly assuming USDC is `$1` unless the protocol has an
explicit depeg policy. A Uniswap V3 TWAP can be useful as a sanity check or
circuit breaker, but `slot0` should not be an input to solvency or liquidation
decisions.

If Chainlink is invalid or stale, fail closed: pause new borrows, withdrawals
that reduce health, and liquidations that depend on that price. Do not fall
back to a spot DEX price.

## Checks before using the price

Before the price is used in a health calculation:

- Read the correct feed addresses for Ethereum mainnet and the intended assets.
- Require each feed answer to be positive.
- Require each round to be complete, with a nonzero `updatedAt`.
- Require `block.timestamp - updatedAt` to be within the feed's heartbeat plus a
  small grace period.
- Normalize feed decimals and token decimals explicitly: WETH has 18 decimals,
  USDC has 6 decimals, and Chainlink feeds often have 8 decimals.
- Use full-precision `mulDiv` style math and round conservatively for the action:
  do not let truncation overvalue collateral.
- Check USDC/USD for depeg if the system denominates debt in USDC.
- Add protocol-level circuit breakers: reject or pause if the price is outside
  configured bounds, moves more than a configured amount since the last accepted
  price, or diverges too far from an independent TWAP/reference price.
- Make the liquidation path use the same validated oracle rules as the borrow
  path, so liquidators cannot choose a weaker pricing route.

The core rule is simple: a health calculation needs a price that cannot be moved
inside the same transaction that consumes it. `slot0` fails that requirement.
