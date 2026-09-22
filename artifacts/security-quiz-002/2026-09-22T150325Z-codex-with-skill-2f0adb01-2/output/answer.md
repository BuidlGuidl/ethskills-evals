# Design review: WETH collateral pricing

Do not use `slot0` from the Uniswap V3 WETH/USDC pool as the lending oracle.
The cost to make `slot0` read 10% away from fair value is not "tens of
millions lost". It is roughly the swap notional needed for a temporary move,
with the economic loss mostly limited to LP fees if the attacker restores the
price after our contract reads it.

## Attack cost

Take the teammate's favorable assumption: the pool has about $200M of active
liquidity around the current price, economically similar to about $100M of WETH
and $100M of USDC at the current price. Real Uniswap V3 liquidity can be thinner
than TVL across a 10% move, so this is already generous to the `slot0` design.

For a constant-liquidity AMM region:

- to move price up by a factor `r`, token1 input is `Y * (sqrt(r) - 1)`;
- to move price down by a factor `r`, token0 input value is `X * (1/sqrt(r) - 1)`;
- the round trip can be done inside one transaction around the vulnerable
  borrow/liquidation call, so arbitrage cannot intervene between the manipulation
  and our oracle read.

With `X = Y = $100M` and a 0.05% Uniswap fee:

- Push WETH/USD up 10%:
  - USDC effective input: `$100M * (sqrt(1.10) - 1) = $4.88M`.
  - Gross input including 5 bp fee: about `$4.883M`.
  - WETH received is worth about `$4.65M` at the original market price.
  - Restore after our oracle read by swapping back along the same curve.
  - Economic loss is approximately two 5 bp fees: about `$4.8k`, plus gas/MEV.

- Push WETH/USD down 10%:
  - WETH effective input value: `$100M * (1/sqrt(0.90) - 1) = $5.41M`.
  - Gross input including 5 bp fee: about `$5.412M`.
  - USDC received: about `$5.13M`.
  - Restore after our oracle read.
  - Economic loss is approximately two 5 bp fees: about `$5.3k`, plus gas/MEV.

The attacker needs access to several million dollars of temporary inventory or
flash liquidity, but they do not need to burn several million dollars. The
capital is returned in the same transaction. The actual cost is in the
thousands, not tens of millions.

The "arbitrage bots will fix it in the same block" argument does not save us.
Ethereum transactions are atomic. The attacker can:

1. swap to distort the pool price;
2. call our borrow or liquidation function while `slot0` is distorted;
3. swap back before the transaction ends.

No outside arbitrage bot can insert a trade between steps 1 and 2 inside the
same transaction.

## What the attacker gets

There are two directions.

### Pump WETH up 10%

If the attacker deposits `$2M` of WETH collateral, the true 85% borrow limit is:

`$2.0M * 85% = $1.70M`

With a manipulated price 10% high, our contract thinks the collateral is worth
`$2.2M`, so it allows:

`$2.2M * 85% = $1.87M`

That is `$170k` of extra USDC borrowing capacity. This is bad risk management,
but by itself it does not create immediate bad debt because the attacker still
has `$2M` of true collateral against `$1.87M` of debt. It can become bad debt if
the market moves down or if the protocol lets the attacker combine this with
other accounting weaknesses.

### Push WETH down 10%

This is the more direct extraction path.

A real max-LTV account with `$2M` of WETH and `$1.70M` debt is exactly at the
85% liquidation threshold. If the oracle reads WETH 10% low, our contract sees:

`$1.70M / ($2.0M * 90%) = 94.4% LTV`

So the account becomes liquidatable even though it is healthy at the market
price.

If a liquidator repays `R` USDC while the oracle price is 10% too low, the WETH
seized has true market value:

`R * (1 + liquidationBonus) / 0.90`

Profit before gas and AMM manipulation cost is:

`R * ((1 + liquidationBonus) / 0.90 - 1)`

Examples:

- With no liquidation bonus, profit is `11.1%` of the debt repaid.
- With a 5% liquidation bonus, profit is `16.7%` of the debt repaid.
- With a 10% liquidation bonus, profit is `22.2%` of the debt repaid, capped by
  the account's available collateral.

On a `$2M` collateral / `$1.70M` debt position:

- If the close factor allows repaying `$850k`, profit is about `$94k` with no
  bonus or about `$142k` with a 5% bonus.
- If the protocol permits a full liquidation, profit is about `$189k` with no
  bonus or about `$283k` with a 5% bonus.

Those profits dominate a roughly `$5k` manipulation cost. This is a profitable
false-liquidation attack against large accounts.

## Recommendation

Price WETH collateral from a robust oracle, not from a DEX spot price. On
Ethereum mainnet, the primary source should be Chainlink ETH/USD for WETH, with
USDC debt valued at 1 USD only under explicit USDC sanity assumptions. A
Uniswap V3 oracle can be useful as a long-window TWAP cross-check or circuit
breaker, but `slot0` must not be used for health calculations.

Before using a price in a borrow, withdrawal, or liquidation health calculation,
check at least:

- the feed address is the intended immutable/configured Chainlink ETH/USD feed;
- `latestRoundData()` returns a positive answer;
- the round is complete, with nonzero `updatedAt`;
- the answer is fresh: `block.timestamp - updatedAt <= maxStaleness`;
- decimals are handled explicitly: Chainlink feed decimals, WETH 18 decimals,
  and USDC 6 decimals must be normalized with checked fixed-point math;
- the price is within configured sanity bounds and, preferably, within an
  allowed deviation from an independent Uniswap V3 TWAP over a meaningful window
  such as 30 minutes or more;
- the same validated price snapshot is used consistently through the whole
  health calculation;
- if the oracle is stale, invalid, or outside deviation bounds, the market must
  fail closed for new borrows and liquidations rather than liquidating users from
  a bad price. Repayment and adding collateral should remain available.

The design goal is not "no external trust"; the DEX pool is also an external
market dependency, and its spot state is intentionally easy to change. The goal
is to make the cost of corrupting the health calculation exceed the value that
can be extracted. A `slot0` spot read fails that test by roughly two orders of
magnitude for the stated position sizes.
