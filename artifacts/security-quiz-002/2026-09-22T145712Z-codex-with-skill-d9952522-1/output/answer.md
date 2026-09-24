# Design review: WETH collateral pricing

Do not use `slot0` from the Uniswap V3 WETH/USDC 0.05% pool as the lending
oracle. The relevant cost is not the gross swap size needed to move the pool.
It is the net cost after the attacker moves the spot price, makes our contract
read it, then unwinds the swap atomically in the same transaction.

## Cost to make `slot0` read 10% wrong

Assume the teammate's premise is true and the pool has about $200M of usable
balanced depth around the current price, so about $100M on each side. In a V3
range, moving price by a factor `r` uses the same square-root price math:

- to move WETH up 10%, `r = 1.10` and `sqrt(r) = 1.048808848`
- 0.05% pool fee means `f = 0.0005`
- USDC needed after fee is `100M * (sqrt(r) - 1) = $4.8809M`
- gross USDC in is `$4.8809M / (1 - f) = $4.8833M`
- WETH received has true market value `100M * (1 - 1/sqrt(r)) = $4.6537M`

At that point our contract reads `slot0` and sees WETH priced 10% too high.
The attacker then sells the WETH back into the same pool before the transaction
ends. That recovers about `$4.8786M` USDC.

So the round-trip cost is approximately:

```text
$4.8833M gross USDC in
-$4.8786M USDC recovered
= $4.8k net cost, plus gas
```

Moving the price 10% down is similar. The attacker sells about `$5.412M` of
WETH notional into the pool, receives about `$5.132M` USDC, lets our contract
read the depressed price, then buys back. The net round-trip cost is about
`$5.3k`, plus gas.

These numbers scale roughly linearly with the active liquidity actually crossed.
If the relevant V3 tick liquidity is twice as deep, the cost is about twice as
large. If it is half as deep, the cost is half as large. The important point is
that even accepting the $200M premise, the cost is thousands of dollars, not
tens of millions. The tens of millions figure confuses temporary swap notional
with economic loss.

Arbitrage bots do not save us here. The manipulation, oracle read, borrow or
liquidation, and unwind can all happen inside one transaction. No external bot
can trade in the middle of that transaction and make our read honest.

## What the attacker gets

For a borrower, a 10% high WETH price directly increases borrowing power.

With `$2M` of true WETH collateral and an 85% LTV limit:

```text
true max debt       = $2.0M * 85%       = $1.700M
manipulated value   = $2.0M * 110%      = $2.200M
manipulated max debt= $2.2M * 85%       = $1.870M
extra USDC borrowed = $1.870M - $1.700M = $170k
```

So a borrower can spend roughly `$5k` to extract about `$170k` of extra USDC
against one max-size position. After the unwind, the position is at 93.5% true
LTV, but the attacker has already taken the extra debt. Whether that becomes
bad debt depends on liquidation bonus, slippage, fees, and price movement, but
the oracle manipulation has already removed a large part of the protocol's
safety margin.

For a liquidator, a 10% low WETH price makes healthy accounts liquidatable.
The threshold becomes:

```text
D / (0.9 * V) >= 85%
D / V >= 76.5%
```

So any account above 76.5% true LTV can be liquidated even though it is healthy
at the real market price. For a max-size position with `$2M` true collateral and
`$1.7M` debt, if liquidation seizes collateral using the manipulated oracle
price, then even with no liquidation bonus:

```text
USDC repaid                 = $1.700M
oracle-priced collateral    = $1.700M
true value seized at -10% px= $1.700M / 0.9 = $1.889M
profit before costs         = $188.9k
```

With a 5% liquidation bonus, that becomes:

```text
$1.700M * 1.05 / 0.9 - $1.700M = $283.3k
```

With a 10% bonus, the liquidator would be capped by the account's collateral and
could take essentially the whole `$2M`, profiting about `$300k` before the
roughly `$5k` manipulation cost and gas.

## Recommended pricing

Use a manipulation-resistant oracle, not a DEX spot read. For this market, the
primary price should be Chainlink ETH/USD for WETH collateral. Since the debt is
USDC, either:

- compute both sides in USD using ETH/USD for collateral and USDC/USD for debt,
  or
- compute WETH/USDC as `ETH/USD / USDC/USD`.

The USDC policy should be explicit. For lender-conservative health checks, it
is often safer to value USDC debt at `max(USDC/USD, $1)` so a USDC depeg does
not make debt look artificially small.

A Uniswap V3 TWAP over a meaningful window can be useful as a secondary sanity
check or circuit breaker, but not `slot0`, and not as the sole oracle for a
high-value lending market.

## Checks before using the price

Before a price enters a health calculation:

- require the oracle answer to be positive
- require `updatedAt != 0`
- require the answer to be fresh using a per-feed max age based on that feed's
  heartbeat plus a justified margin
- check every feed used in the calculation, not just ETH/USD
- handle feed decimals explicitly
- handle token decimals explicitly: WETH has 18 decimals, USDC has 6
- normalize to one documented unit before comparing collateral and debt
- use full-precision multiplication/division
- round collateral value down and debt value up
- define fail-closed behavior for stale, reverted, zero, or nonsensical oracle
  data, such as disabling new borrows and liquidations or entering a guarded
  pause
- on Ethereum mainnet there is no L2 sequencer check, but if this market is ever
  deployed to an L2, add the Chainlink sequencer uptime check and grace period

The design choice is not "Chainlink stale risk versus our own on-chain truth."
A current Uniswap spot price is not truth for a lending protocol. It is an
attacker-controlled value for the duration of a transaction. Chainlink can be
stale, so we must check freshness. `slot0` can be made wrong exactly when we
read it, so it should not be used for collateral health or liquidation logic.
