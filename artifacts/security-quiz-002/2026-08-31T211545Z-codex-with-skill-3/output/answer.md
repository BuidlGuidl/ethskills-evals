# Oracle Design Review

The teammate's argument is wrong on the point that matters most: our contract reads the price **during the attacker's transaction**, before arbitrage has any chance to restore it. Same-block arbitrage only helps after we have already consumed the manipulated price.

## 1. What does a 10% spot manipulation actually cost?

Assume, generously for the defender, that the Uniswap V3 WETH/USDC 0.05% pool behaves like a constant-product pool with about:

- `$100M` of WETH
- `$100M` of USDC

That is already a best-case simplification. In V3, manipulation cost depends on **active in-range liquidity at the current tick**, not headline TVL. If only part of the `$200M` is active near the current price, the attack is cheaper than the numbers below.

Let `r` be the manipulated price divided by the true price.

For a constant-product pool with equal-value reserves `Y = $100M` on each side:

- To push the WETH price **down** to `r = 0.9`, the attacker sells WETH into the pool.
- To push the WETH price **up** to `r = 1.1`, the attacker buys WETH from the pool.

### 10% down move

Using the standard constant-product relations:

- USDC the attacker receives:
  - `Y * (1 - sqrt(0.9))`
  - `100,000,000 * (1 - 0.948683...)`
  - about **$5.13M**
- True-market value of the WETH they must put in:
  - `Y * (1 / sqrt(0.9) - 1)`
  - `100,000,000 * (1.054093... - 1)`
  - about **$5.41M**

So the attacker's immediate economic loss is about:

- `$5.41M - $5.13M = $277.6k`

Pool fee on the swap is only another:

- `0.05% * $5.41M = about $2.7k`

So a 10% downward spot manipulation costs roughly **$280k**, not "tens of millions."

### 10% up move

- USDC the attacker must spend:
  - `Y * (sqrt(1.1) - 1)`
  - about **$4.88M**
- True-market value of the WETH they receive:
  - `Y * (1 - 1 / sqrt(1.1))`
  - about **$4.65M**

Immediate loss:

- `$4.88M - $4.65M = $227.1k`

Pool fee:

- `0.05% * $4.88M = about $2.4k`

So a 10% upward spot manipulation costs roughly **$230k**.

### Why this is the right order of magnitude

For small-to-medium spot moves, manipulation cost is roughly proportional to the pool depth that is actually active at the current price. If only half as much liquidity is active, the loss is about half as large. That is why "the pool has $200M in it" is not the relevant safety metric.

## 2. What does the attacker get?

There are two obvious monetization paths.

### A. Overprice WETH, then overborrow USDC

If a position can hold up to `$2M` of WETH collateral and is allowed up to `85%` LTV:

- True maximum safe debt at the true price:
  - `0.85 * $2.0M = $1.70M`
- If the oracle is manipulated **10% high**, the protocol thinks the collateral is worth `$2.20M`
- Borrow limit becomes:
  - `0.85 * $2.20M = $1.87M`

Extra borrow capacity created by the manipulation:

- `$1.87M - $1.70M = $170k`

Against the optimistic pool-depth assumptions above, the cost to create that 10% overpricing is about **$230k**, so for a single `$2M` position this is not obviously profitable by itself.

But that is not a defense:

- if there are multiple positions to open,
- if the active liquidity is lower than the headline `$200M`,
- if MEV / backrunning lets the attacker recover part of the move,
- or if the protocol has any other path to monetize a transient overvaluation,

the economics get much better for the attacker.

Also, protocols should not accept "the first exploit is only maybe unprofitable" as an oracle security model.

### B. Underprice WETH, then force liquidations

This is often the cleaner attack.

If WETH is read **10% low**, then a position that is actually healthy up to:

- `85% * 0.9 = 76.5%`

becomes liquidatable on-chain.

So every account with a true LTV between **76.5% and 85%** can be falsely liquidated.

The liquidator's real economic edge is amplified by the bad oracle. If the protocol offers a liquidation bonus `b`, then buying collateral at an oracle price that is 10% too low gives an effective real discount of:

- `(1 + b) / 0.9 - 1`

Examples:

- `b = 5%`  -> real edge is about **16.7%**
- `b = 8%`  -> real edge is **20.0%**
- `b = 10%` -> real edge is about **22.2%**

On a large account, that is easily hundreds of thousands of dollars of extractable value. This is the more dangerous direction because the attacker does not need to leave with bad debt; they can realize profit directly through liquidation.

## 3. Recommendation

Do **not** price WETH collateral from Uniswap V3 `slot0` spot price.

Use:

- **Primary oracle:** Chainlink ETH/USD (WETH is just wrapped ETH)
- **Optional secondary check:** Uniswap V3 **TWAP** over a meaningful window, e.g. `30m` to `1h`, only as a sanity check or fallback policy

For health checks and liquidations on mainnet, the primary price should come from a manipulation-resistant oracle, not a synchronous DEX spot read.

If you want an on-chain market-based cross-check, use Uniswap V3 `observe()` and derive a TWAP. Do not use `slot0.sqrtPriceX96` directly.

## 4. What must be checked before using the price in health logic?

Before a collateral price enters LTV / health / liquidation math, check at least:

1. **Price is positive**
   - Reject `<= 0`.

2. **Feed is fresh enough**
   - Enforce `block.timestamp - updatedAt <= maxAge`.
   - `maxAge` should be tighter than your risk tolerance and the feed heartbeat.

3. **Round is complete**
   - Do not use incomplete oracle data.
   - In practice, validate the Chainlink round fields your integration relies on and use the proxy feed as intended.

4. **Decimals are normalized**
   - Chainlink feeds are commonly `8` decimals; WETH is `18`; USDC is `6`.
   - Normalize before health math.

5. **Conservative rounding**
   - Round collateral value down.
   - Round debt value up.

6. **Sanity bounds / deviation checks**
   - Compare Chainlink against a secondary source such as a Uniswap TWAP.
   - If deviation exceeds a threshold, pause new borrowing and possibly liquidations until resolved.

7. **Fallback behavior is explicit**
   - Decide in advance what happens if the oracle is stale or deviates too much:
   - revert,
   - freeze borrows,
   - freeze liquidations,
   - or fall back to another conservative source.
   - Do not improvise inside the failure path.

8. **Debt-side pricing is handled consistently**
   - Health is a ratio of collateral value to debt value in the same unit.
   - If you treat USDC as `$1`, that is a protocol choice; if you do not, then validate the USDC/USD price with the same rigor.

## Conclusion

Using Uniswap V3 `slot0` spot price for a lending-market collateral oracle is unsafe.

Even under defender-friendly assumptions, moving the read price by 10% only costs on the order of **$230k to $280k**, because the attacker only needs the price to be wrong **at the instant our contract reads it**. In return they can create false liquidations or temporary over-borrow capacity. For a lending market, that is not an acceptable oracle design.

Price WETH collateral with **Chainlink ETH/USD**, gate it with **freshness, positivity, decimal normalization, and deviation checks**, and use a **Uniswap TWAP only as a secondary sanity check or fallback**, never as the primary synchronous spot read.
