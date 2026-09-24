# Oracle design review

The proposed `slot0` oracle is not safe for this lending market.

The important number is not "how much notional must pass through the pool"; it is the attacker's net cost after they move the spot price, make our contract read it, then unwind in the same transaction. Arbitrage bots do not get a chance to correct the price before our read because the read is inside the attacker's transaction.

## Cost to make `slot0` read 10% high or low

Assume the WETH/USDC 0.05% pool has `$200M` of immediately active, balanced liquidity around the current price. That is already the optimistic case for the protocol; inactive or out-of-range liquidity does not resist a spot move.

For a constant-product approximation, or for a Uniswap V3 range while the trade stays inside active liquidity, a price move by a factor `r` requires changing reserves by `sqrt(r)`.

For a 10% higher WETH price:

```text
r = 1.10
one-side active liquidity ~= $100,000,000
USDC input before fee ~= 100,000,000 * (sqrt(1.10) - 1)
                      ~= $4,880,885
USDC input including 5 bp fee ~= $4,883,326
```

The attacker receives about `$4,653,741` worth of WETH, our contract reads the manipulated high price, and then the attacker swaps the WETH back.

The round-trip loss is approximately the two 5 bp swap fees:

```text
net loss ~= 0.05% * ($4,883,326 + $4,653,741)
         ~= $4,769
```

The same order of magnitude applies for a 10% lower WETH price: about `$4.9M` temporary capital and about `$4.8k` round-trip fee loss, plus gas and MEV/tip costs.

That temporary `$4.9M` does not need to be the attacker's own capital. It can be flash-borrowed or routed atomically. The economic security of the oracle is therefore not "tens of millions"; it is roughly a few thousand dollars plus execution costs under the assumptions above.

## What the attacker gets

The profitable direction is usually to push WETH down, liquidate a healthy borrower using the bad price, then unwind the pool.

Consider a max-size account:

```text
true WETH collateral value = $2,000,000
debt at 85% LTV            = $1,700,000 USDC
```

If the attacker makes the oracle read 10% low, the protocol sees:

```text
oracle collateral value = $1,800,000
reported LTV            = 1,700,000 / 1,800,000
                        = 94.44%
```

So an account that is exactly healthy at the real market price becomes liquidatable.

If liquidation seizes collateral using the manipulated oracle price, then even with no liquidation bonus the attacker can repay `$1.7M` and receive:

```text
true collateral seized = 1,700,000 / 0.90
                       = $1,888,889
profit before oracle cost = $188,889
```

With a 5% liquidation bonus:

```text
true collateral seized = 1,700,000 * 1.05 / 0.90
                       = $1,983,333
profit before oracle cost = $283,333
```

If the bonus is high enough, the seizure is capped by the whole `$2M` collateral position, so the profit is capped near `$300,000` on this one account. Against that, the spot-oracle manipulation cost is about `$5,000` plus gas and priority fees. That is a very attractive trade.

Pushing WETH 10% high can also let a borrower take more USDC than they should. Against `$2M` of WETH collateral, the false borrow capacity is:

```text
true max debt at 85% LTV       = $2,000,000 * 0.85 = $1,700,000
manipulated max debt, 10% high = $2,200,000 * 0.85 = $1,870,000
extra borrow                   = $170,000
```

That direction is less clean as a fresh self-funded attack because `$1.87M` debt is still less than `$2M` of real collateral, but it can still create unhealthy positions, interfere with liquidations, and extract value depending on liquidation incentives and close-factor rules.

## Recommendation

Do not price collateral from Uniswap V3 `slot0`, reserves, balances, or a current spot quote for borrowing or liquidation decisions.

For WETH collateral on Ethereum mainnet, use a manipulation-resistant oracle such as Chainlink's ETH/USD feed, then combine it with the debt asset's feed if the protocol needs a WETH/USDC price rather than a WETH/USD price. If USDC is assumed to be `$1`, make that an explicit risk decision; otherwise use a USDC/USD feed as well and compute:

```text
WETH/USDC = ETH/USD / USDC/USD
```

A meaningful Uniswap V3 TWAP can be useful as a secondary sanity check, fallback, or circuit breaker, but it should not be a same-block `slot0` read. If a TWAP is used for a primary oracle, its window has to be long enough that manipulation cost exceeds the value at risk, and the protocol must accept that TWAPs lag during real market moves.

## Checks before using a price in health calculations

Before a price affects borrow capacity or liquidation, the protocol should check at least:

- The oracle answer is positive.
- The feed round is complete, not stale, and `updatedAt` is within a feed-specific maximum age based on the feed heartbeat plus a justified margin.
- The answer's decimals are handled explicitly and normalized with token decimals before comparing collateral and debt.
- The price pair is the intended pair and orientation; do not accidentally invert ETH/USD, USDC/USD, or token units.
- If using Chainlink, handle `answeredInRound`/round completeness according to the aggregator interface used by the installed version.
- Define behavior for sequencer downtime on L2s. On Ethereum mainnet this is not relevant, but the oracle library should not silently become unsafe if reused elsewhere.
- Reject or pause on obviously broken prices, such as zero, negative, or values outside configured sanity bounds.
- Liquidation math must use the same normalized price convention as borrow math.
- Liquidation incentives, close factors, and collateral seizure calculations must be capped so a bad or borderline price cannot seize more collateral than intended.
- Any liquidation swap must have a minimum output or other slippage protection; the oracle price is not a swap execution guarantee.

The core issue is atomicity: `slot0` tells us the price after the attacker's previous swap in the same transaction, not an economically final market price. Deep liquidity increases the temporary capital needed, but it does not make a spot read safe for a lending market with `$2M` positions.
