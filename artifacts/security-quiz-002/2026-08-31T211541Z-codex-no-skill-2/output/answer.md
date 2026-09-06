# Lending market oracle design review

Using `UniswapV3Pool.slot0()` from the live `WETH/USDC 0.05%` pool as the health-check price is not safe.

The key mistake in the writeup is treating the attacker as if they push price, wait for arbitrage, and then realize the loss. That is not how this attack is executed. If our contract reads `slot0` inside a transaction, the attacker can:

1. Flash-borrow capital.
2. Trade the pool to a manipulated spot price.
3. Call our borrow or liquidation path while our contract reads that manipulated `slot0`.
4. Trade back in the same transaction.
5. Repay the flash loan.

Arbitrage bots never get a chance to "drag it back" before our read if the manipulation and our read are in the same transaction. The attacker mostly pays pool fees and gas.

## 1. What it costs to move the read price by 10%

I will use the teammate's own depth assumption: about `$200M` total value in the pool, so roughly `$100M` of WETH and `$100M` of USDC around the current price. That assumption is actually charitable to the spot-oracle design; concentrated liquidity can make the real attack cheaper if not all TVL is active across the whole `10%` move.

For a constant-liquidity AMM around the current price:

- Let initial reserves be `(x, y)`, with price `P = y / x` in `USDC per WETH`.
- To move spot up by `10%`, the new price is `P' = 1.1 P`.
- With the usual AMM relation, the reserve ratio changes by the square root of price:
  - `x' = x / sqrt(1.1)`
  - `y' = y * sqrt(1.1)`

Since `sqrt(1.1) = 1.048808848...`:

- USDC needed in to move `WETH` price up `10%`:
  - `ΔUSDC = 100,000,000 * (sqrt(1.1) - 1)`
  - `ΔUSDC ~= $4.881M`
- WETH received out:
  - value `~= 100,000,000 * (1 - 1 / sqrt(1.1))`
  - `~= $4.654M` of WETH

On Uniswap v3 `0.05%`, doing this and then immediately reversing it costs approximately two swap fees:

- first leg fee: `0.05% * $4.883M ~= $2,442`
- reverse leg fee: `0.05% * $4.654M ~= $2,327`
- total direct trading loss: about **`$4.8k`**, plus gas and flash-loan fee

If the attacker instead pushes `WETH` price down `10%`:

- WETH sold in:
  - value `~= 100,000,000 * (1 / sqrt(0.9) - 1)`
  - `~= $5.409M`
- USDC received out:
  - `100,000,000 * (1 - sqrt(0.9))`
  - `~= $5.132M`
- round-trip fee loss: about **`$5.3k`**

So the real answer is:

- **Temporary capital needed:** about **`$5M`**, not "tens of millions"
- **Economic cost if done atomically:** about **`$5k`**, not "$5M burned"

Mainnet flash liquidity is more than enough for that temporary capital.

## 2. What the attacker gets

There are two obvious monetization paths.

### A. Overborrow by manipulating price up

Maximum collateral per position is `$2M` of WETH. Liquidation threshold is `85%`.

Without manipulation:

- max debt at threshold = `0.85 * $2,000,000 = $1,700,000`

With a `10%` inflated collateral price:

- protocol thinks collateral is worth `$2,200,000`
- max debt at threshold becomes `0.85 * $2,200,000 = $1,870,000`

Extra borrow enabled by the manipulated spot read:

- **`$1.87M - $1.70M = $170k`**

So about `$4.8k` of manipulation cost can buy about **`$170k` of extra debt capacity`** on a single max-size position.

Whether the protocol eventually realizes bad debt depends on liquidation rules, penalty, and subsequent price moves, but the borrow path is already economically attractive enough to attack.

### B. Force liquidations by manipulating price down

This is usually the cleaner attack because the attacker can earn liquidation bonus directly.

A borrower with:

- true collateral value: `$2.0M`
- true debt: `$1.6M`
- true LTV: `80%`

is healthy under an `85%` threshold.

If the attacker pushes the oracle price down `10%` just for our read:

- protocol thinks collateral is worth `$1.8M`
- apparent LTV becomes `$1.6M / $1.8M = 88.9%`

Now the position looks liquidatable even though it is healthy at the real market price.

If liquidation bonus is `5%`, liquidating `$1.6M` of debt yields roughly:

- collateral seized value: `1.05 * $1.6M = $1.68M`
- liquidator gross profit: **`$80k`**
- less manipulation cost: about **`$5.3k`**
- net before gas: about **`$74.7k`**

Even a much smaller liquidation bonus or a partial-liquidation cap still leaves plenty of room for profit. This is enough by itself to reject `slot0` spot as a health oracle.

## 3. Recommendation: what price to use

Use a **manipulation-resistant external oracle** for health calculations, not Uniswap spot.

For Ethereum mainnet WETH collateral, the standard choice is:

- **primary collateral oracle:** `Chainlink ETH / USD`
- **debt-side oracle:** `Chainlink USDC / USD` or an equally robust USD oracle for debt accounting

If you want a DEX-based cross-check, use a **Uniswap v3 TWAP**, not `slot0`, and use it only as:

- a sanity check against Chainlink, or
- a fallback under tightly defined conditions

Do not use `slot0` spot directly for borrow eligibility, liquidation eligibility, or health factor.

## 4. What must be checked before using the price in health

Before using the oracle answer in a health calculation, check at least all of the following:

1. **Round completeness**
   - `latestRoundData()` returned a completed round
   - `updatedAt != 0`
   - answer is present for the returned round

2. **Positive answer**
   - price must be strictly `> 0`

3. **Freshness / staleness bound**
   - `block.timestamp - updatedAt <= maxOracleDelay`
   - `maxOracleDelay` should be configured from the feed heartbeat with margin, not guessed ad hoc

4. **Decimals normalization**
   - normalize feed decimals correctly before combining with token amounts and LTV math
   - avoid overflow/underflow and precision loss in health calculations

5. **Sanity bounds versus a secondary source**
   - compare Chainlink against a sufficiently long Uniswap TWAP or another independent oracle
   - if divergence exceeds a configured threshold, pause or freeze sensitive actions rather than trusting either source blindly

6. **Borrow and liquidation fail-closed behavior**
   - if oracle checks fail, do not allow new borrows
   - for liquidations, choose an explicit policy; many protocols freeze liquidations too when the oracle is invalid, because a bad price can create false liquidations

7. **Debt asset pricing is also safe**
   - health is a ratio of collateral value to debt value
   - if you price WETH robustly but assume `USDC = $1` with no depeg handling, the system still has oracle risk

8. **Oracle unit consistency**
   - both collateral and debt must be expressed in the same unit before comparing against LTV thresholds

On Ethereum mainnet there is no L2 sequencer-uptime check to add, but the other checks still apply.

## Conclusion

Reading `slot0` from the Uniswap `WETH/USDC 0.05%` pool is not "our own reserve of truth"; it is a same-transaction manipulable spot price.

Using the teammate's own `$200M` liquidity assumption, moving the read price by `10%` only needs about **`$5M` of temporary capital** and costs only about **`$5k`** if the attacker manipulates and unwinds atomically. In return, they can get about **`$170k`** of extra borrow capacity on a max-size position, or can force profitable liquidations of otherwise healthy accounts.

For health calculations, use **Chainlink ETH/USD** for WETH collateral, price the debt side with an equally robust oracle, and enforce freshness, validity, normalization, and cross-check guards before trusting the result.
