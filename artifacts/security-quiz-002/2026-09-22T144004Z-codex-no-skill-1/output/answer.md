# Design review: WETH collateral pricing

The proposed design should not use `slot0` from the Uniswap V3 WETH/USDC
0.05% pool as the lending oracle. `slot0` is a spot price, so the relevant
question is not "what does it cost to permanently move a $200M pool?" but
"what does it cost to make the pool report the wrong price for one call inside
one transaction?"

That cost is small.

## Manipulation cost

Assume, generously, that the full quoted $200M is active around the current
price and behaves like a constant-product pool with about $100M of WETH and
$100M of USDC value on the two sides.

To make WETH look 10% more expensive, the attacker swaps USDC into the pool.
For a constant-product pool:

```text
r = manipulated_price / true_price = 1.10
USDC sent into reserves = Y * (sqrt(r) - 1)
```

With `Y = $100M`:

```text
sqrt(1.10) = 1.048808848
USDC effective in = $100M * 0.048808848 = $4.8808848M
```

The 0.05% Uniswap fee means the gross input is:

```text
$4.8808848M / 0.9995 = about $4.8833265M
```

So the capital needed to push the displayed price up 10% is about $4.9M, not
tens of millions. More importantly, that capital can be flash-borrowed and is
not the economic loss.

The attacker can do this atomically:

```text
1. Flash-borrow USDC.
2. Swap USDC into WETH/USDC, pushing `slot0` up 10%.
3. Call our lending market while our contract reads the inflated `slot0`.
4. Swap back, restoring the pool price.
5. Repay the flash loan.
```

Arbitrage bots do not save us here. They cannot trade in the middle of the
attacker's transaction, and after the transaction the price can already be
restored.

The round-trip loss is basically the pool fees on the manipulation trades.
Using the same approximation:

```text
forward fee ~= $4.8808848M * 0.0005 / 0.9995 = $2,442
reverse fee ~= $4.6537411M * 0.0005 / 0.9995 = $2,328
total pool fee loss ~= $4,770
```

Add gas and any flash-loan fee, and this is still in the thousands or low tens
of thousands of dollars, not millions. If less than the full $200M is active
over the 10% price path, the attack is cheaper.

## What the attacker gets

For a max position with $2M of real WETH collateral and an 85% liquidation LTV:

```text
true max debt at 85% LTV = $2.0M * 0.85 = $1.70M
apparent collateral after +10% oracle manipulation = $2.0M * 1.10 = $2.20M
borrow allowed against manipulated price = $2.20M * 0.85 = $1.87M
extra debt capacity = $1.87M - $1.70M = $170,000
```

So the attacker can buy about $170k of extra borrowing capacity for a
manipulation that costs on the order of $5k plus transaction/flash-loan costs.
That is the wrong side of the trade for the protocol.

The opposite direction is also dangerous. If an attacker pushes the spot price
down 10%, healthy borrowers can become falsely liquidatable. The attacker's
profit is then the liquidation discount/bonus on the debt they repay. For
example, with a 5% liquidation bonus on a near-threshold $1.7M position, the
gross liquidation incentive is about:

```text
$1.7M * 5% = $85,000
```

Again, that is much larger than the cost of briefly moving a spot oracle.

## Recommendation

Use Chainlink as the primary price source for the health calculation, not
Uniswap V3 `slot0`.

For this market on Ethereum mainnet, price WETH collateral from the Chainlink
ETH/USD feed, and price USDC debt from the Chainlink USDC/USD feed or from $1
only if the system has an explicit USDC depeg circuit breaker. Derive the
WETH/USDC price from those validated values.

A Uniswap V3 price can be useful as a secondary sanity check, but it should be
a TWAP over a meaningful window, not `slot0`. It should never be the raw spot
price used directly for collateral valuation.

Before any price is used in a health calculation, check at least:

1. The oracle answer is positive.
2. The oracle round is complete and has a nonzero `updatedAt`.
3. `updatedAt` is not older than the market's configured max staleness.
4. Decimals are normalized correctly before multiplying by collateral or debt
   amounts.
5. The feed address, base asset, quote asset, and token ordering are exactly
   what the market expects.
6. The derived collateral price is within a configured deviation bound of an
   independent reference, such as a Uniswap V3 TWAP over a sufficiently long
   window. If the feeds disagree too much, pause borrowing/liquidation or use
   the conservative side.
7. For collateral, fail conservative: do not overvalue it. If combining a
   primary oracle and a TWAP bound, use the lower safe price for collateral and
   the higher safe price for debt.
8. If USDC/USD is materially below peg, value USDC debt at the higher/conservative
   amount for borrower health and stop assuming USDC is exactly $1.

The key point is that spot AMM liquidity protects traders from bad execution;
it does not protect a lending protocol that reads the spot price mid-transaction.
For lending health, the oracle must be hard to move at the exact instant of the
read, and the value must be checked for freshness, validity, units, and
cross-oracle sanity before it affects borrowing or liquidation.
