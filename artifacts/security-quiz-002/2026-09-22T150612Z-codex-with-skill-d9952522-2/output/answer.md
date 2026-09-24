# Lending market oracle design review

Do not use the Uniswap V3 WETH/USDC `slot0` spot price for collateral valuation.
The relevant cost is not "how many dollars have to pass through the pool"; it is
the attacker's settled loss after they move the spot price, make our contract read
it, and unwind the move in the same transaction.

## Manipulation cost

Take the teammate's rough pool-size number at face value and model the active
liquidity like a constant-product pool with about $100M of WETH on one side and
$100M of USDC on the other. That is not exactly how Uniswap V3 liquidity is
represented, but it is a good way to see the order of magnitude. If the real
V3 active liquidity requires more notional, the same conclusion still holds
because the attacker recovers almost all of the notional when unwinding.

To push the WETH/USDC spot price up by 10%:

- Target price ratio: `P' / P = 1.10`.
- Reserve movement needed: `sqrt(1.10) - 1 = 4.88%`.
- With a $100M USDC side, the effective USDC added to the pool is about
  `$100M * 4.88% = $4.88M`.
- At the 0.05% fee tier, the attacker pays about `$4.883M` USDC in and receives
  about `$4.654M` of WETH at the original market price.

If the attacker simply left the pool there for arbitrageurs, they would lose the
price-impact/slippage to the market. But they do not need to leave it there. The
attack transaction can be:

1. flash-borrow the needed USDC/WETH;
2. swap in the Uniswap pool until `slot0` is 10% high;
3. call our lending market, which reads the manipulated `slot0`;
4. swap back, restoring the pool price; and
5. repay the flash loan.

No arbitrage bot gets to trade between steps 2 and 3 because they happen inside
one transaction. By the end of the transaction the pool can be back at the market
price, so the durable cost is essentially the two swap fees plus gas.

With the rough $200M-pool model:

- First-leg fee: about `0.05% * $4.883M = $2.4k`.
- Second-leg fee: about `0.05% * $4.654M = $2.3k`.
- Total settled manipulation cost: about `$4.8k`, plus gas and flash-loan fees.

Pushing the price down by 10% is similar. The reserve movement is a little larger:

- `1 / sqrt(0.90) - 1 = 5.41%`.
- Effective WETH sold is about `$5.41M`.
- Round-trip fees are about `$5.3k`, plus gas and flash-loan fees.

Even if the exact Uniswap V3 active liquidity means the notional trade is not
$5M but "tens of millions", that still is not the attack cost. At a 0.05% fee
tier, a reversible two-leg manipulation costs roughly:

`2 * 0.05% * trade notional = 0.10% * trade notional`

So a $20M temporary displacement costs roughly $20k in pool fees, and a $50M
temporary displacement costs roughly $50k. That is the security budget we should
compare against the lending-market payoff, not the temporary capital routed
through the pool.

## Attacker payoff

The market allows positions with up to $2M of WETH collateral and liquidates at
85% LTV.

If the attacker pushes the WETH price 10% high, their $2M of real collateral is
read as `$2M * 1.10 = $2.2M`. At an 85% borrow threshold:

- honest maximum debt: `$2.0M * 85% = $1.70M`;
- manipulated maximum debt: `$2.2M * 85% = $1.87M`;
- extra USDC borrow: `$170k`.

After the transaction unwinds the Uniswap price, the position has $1.87M of USDC
debt against $2M of real collateral, or 93.5% true LTV. The attacker has extracted
about $170k more USDC than the collateral should support. Against a manipulation
cost on the order of $5k to tens of thousands of dollars, that is a profitable
attack before even considering repeated positions or composability.

The opposite direction is also bad. If the attacker pushes WETH 10% low, then any
account with true LTV above `85% * 90% = 76.5%` can be made to look liquidatable.
For a $2M collateral account, that means a healthy account with, for example,
$1.60M of USDC debt is actually at 80% LTV, but appears to be at:

`$1.60M / ($2.0M * 0.90) = 88.9% LTV`

The attacker's payoff is the liquidation incentive on the debt they are allowed
to repay, capped by close-factor and collateral-seizure rules. With a 5% bonus,
liquidating $1.6M of debt is worth about $80k before costs; with a 10% bonus, it
is about $160k. If the protocol allows a large close factor, this again clears
the manipulation cost comfortably.

## Recommendation

Use a manipulation-resistant oracle for health calculations. On Ethereum mainnet,
the normal design is Chainlink ETH/USD for WETH collateral, with explicit handling
of the USDC side. If the protocol accounts debt in USD, use the ETH/USD feed and
state that USDC debt is treated at par, with depeg controls. If the protocol needs
a WETH/USDC exchange rate, derive it from fresh ETH/USD and USDC/USD feeds:

`WETH per debt-unit value = ETH/USD / USDC/USD`

A Uniswap TWAP can be useful as a secondary sanity check or circuit breaker, but
not `slot0`. A same-block spot read is exactly the thing flash liquidity is good
at manipulating.

Before any oracle value is used in a health calculation, check at least:

- the oracle answer is positive;
- `updatedAt` is nonzero and no older than a feed-specific max age based on that
  feed's heartbeat plus a small justified margin;
- feed decimals and token decimals are handled explicitly, with all values
  normalized to one documented scale;
- arithmetic uses full-precision multiplication/division, rounds collateral value
  down, and rounds debt value up;
- the feed address is the intended production feed for Ethereum mainnet;
- if using both ETH/USD and USDC/USD, both feeds pass freshness and positivity
  checks in the same calculation;
- the protocol has a stated policy for USDC depeg or oracle outage, such as
  pausing new borrows and possibly liquidations rather than falling back to an
  unsafe spot price;
- any optional DEX TWAP sanity check has a meaningful window and causes a pause
  or conservative bound when it deviates too far from the primary feed; and
- liquidation bonus, close factor, and swap minimum outputs are bounded so that
  oracle edge cases do not turn into outsized value extraction.

The teammate's argument treats temporary trade size as if it were irreversible
loss. For a `slot0` read inside an attacker-controlled transaction, the actual
loss is mainly round-trip fees. That is far smaller than the value available from
over-borrowing or false liquidations in a $2M-collateral market.
