# Design review: WETH collateral pricing

Do not use `slot0` from the Uniswap V3 WETH/USDC 0.05% pool as the lending oracle.
`slot0` is the current spot price after the last swap. An attacker can make it say
almost anything for the duration of one transaction, call our market while it is
wrong, and then trade the pool back.

## Cost to make the read 10% wrong

Assume the quoted "$200M of liquidity" means roughly $200M of value at spot, or
about $100M WETH value and $100M USDC value. A constant-product approximation is
good enough for sizing; the exact V3 math is the same sqrt-price shape inside the
active ticks.

To move the WETH/USDC price down 10%, the new price is:

```text
P1 = 0.9 * P0
sqrt(P1 / P0) = sqrt(0.9) = 0.948683
```

With $100M of WETH-side depth and $100M of USDC-side depth:

```text
WETH value sold into the pool ~= 100M * (1 / sqrt(0.9) - 1)
                              ~= $5.41M

USDC received from the pool   ~= 100M * (1 - sqrt(0.9))
                              ~= $5.13M
```

If the attacker simply walks away and lets arbitrage restore the pool, the mark
to market loss is about:

```text
$5.41M - $5.13M = $278k
```

plus the 0.05% pool fee, about $2.7k for that leg.

But that is not the realistic attack cost. The realistic transaction is:

```text
1. Flash borrow WETH/USDC.
2. Swap against the Uniswap pool to move spot by 10%.
3. Call our market; our contract reads the manipulated slot0 price.
4. Execute the borrow/liquidation.
5. Swap back to restore the pool.
6. Repay the flash loan.
```

Arbitrage bots cannot "drag it back" before our read if the read is in the same
transaction after the attacker's swap. After our read, the damage is already
done. The attacker can also be the arbitrageur by including the restoring swap.

On the same $200M-depth approximation, the round-trip persistent cost is mostly
fees:

```text
0.05% * ($5.41M + $5.13M) ~= $5.3k
```

plus gas, flash-loan fee, and whatever MEV/private-orderflow cost is needed. If
the real V3 active liquidity makes the trade size larger, the conclusion scales
linearly: even a $30M move costs roughly 0.10% round trip in pool fees, or about
$30k, not $30M of economic loss.

## What the attacker gets

The dangerous direction for existing accounts is pushing the WETH price down.
Our health check would undervalue collateral.

A position with true collateral value `C` and debt `D` is liquidatable when:

```text
D / oracleCollateralValue >= 85%
```

If the oracle price is pushed 10% low, the health check sees `0.9C`, so it
liquidates when:

```text
D / (0.9C) >= 0.85
D / C >= 0.765
```

So every account whose real LTV is between 76.5% and 85% can be made liquidatable
even though it is healthy at the true market price.

For a max-size account with $2M of real WETH collateral:

```text
Real LTV 80%:
  debt = $1.60M
  apparent collateral value = $1.80M
  apparent LTV = 88.9%
```

If liquidation seizes collateral using the manipulated price, then even with no
explicit liquidation bonus the liquidator buys WETH at a 10% discount to market:

```text
profit ~= repaidDebt * (1 / 0.9 - 1)
       ~= 11.11% of repaid debt
```

On $1.60M of repaid debt, that is about $178k. With a 5% liquidation bonus:

```text
profit ~= repaidDebt * (1.05 / 0.9 - 1)
       ~= 16.67% of repaid debt
       ~= $267k on $1.60M
```

This is much larger than a roughly $5k to $30k manipulation round trip. The
attacker does not need to beat the whole Uniswap pool; they only need the spot
price to be wrong at the instant our contract reads it.

The opposite direction is also bad for new borrowing. If WETH is pushed 10% high,
$2M of collateral appears to be $2.2M, so an 85% threshold allows:

```text
0.85 * $2.2M = $1.87M of USDC debt
```

The real 85% limit on $2M is $1.70M, so the bad spot price creates $170k of
extra borrowing capacity on one max-size account.

## What to use instead

Use a manipulation-resistant oracle as the primary price, e.g. Chainlink ETH/USD
for WETH and Chainlink USDC/USD for the debt asset, combined as:

```text
WETH price in USDC = ETH/USD price / USDC/USD price
```

If we want an on-chain market-price check, use a Uniswap V3 TWAP over a meaningful
window as a sanity check or fallback input, not `slot0`. The TWAP window must be
long enough that moving it by 10% costs more than the value available from the
attack. For this market size, that means thinking in tens of minutes or more,
not the current block.

## Checks before using a price in health math

Before any borrow, withdraw, or liquidation health calculation:

- Reject non-positive oracle answers.
- Reject incomplete rounds: `updatedAt == 0`, missing round data, or stale round
  metadata. If using Chainlink `AggregatorV3Interface`, also reject
  `answeredInRound < roundId` where applicable.
- Enforce a max age based on the feed heartbeat and our risk tolerance. A stale
  Chainlink price should pause new borrowing and liquidations, not fall back to
  Uniswap spot.
- Normalize decimals explicitly: oracle decimals, WETH 18 decimals, and USDC 6
  decimals. Round collateral value down and debt value up.
- Check the price against an independent bounded source, such as a sufficiently
  long Uniswap TWAP. If the deviation is too large, fail closed or enter a
  guarded mode that permits repayment and adding collateral but blocks new risk
  and liquidations.
- If using a TWAP source at all, verify the pool, observation cardinality, TWAP
  window, and harmonic mean liquidity floor. Never silently fall back to `slot0`.
- Cap liquidation seize amounts to the borrower's actual collateral and make the
  liquidation path use the same validated price as the health check.

The core rule is: spot AMM prices are execution prices, not lending oracle
prices. Chainlink staleness is a condition we can check and handle. Same-block
spot manipulation is a condition that makes the health calculation itself
adversarial.
