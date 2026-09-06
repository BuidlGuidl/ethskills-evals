Using `slot0` from the Uniswap v3 `WETH/USDC 0.05%` pool as the liquidation oracle is not safe for a `$2M` lending position. The relevant question is not "how much liquidity is in the pool?", but "how much does it cost to make *our contract* read the wrong price for one call, and what can be extracted before arbitrage corrects it?"

Assume the pool is roughly balanced at the true market price with about `$100M` of WETH and `$100M` of USDC on each side. For a first-pass economic estimate, model the active liquidity around the current tick as a constant-product curve:

- Let `x` be WETH reserves.
- Let `y` be USDC reserves.
- Spot price is `P = y / x`.
- To move the read price by a factor `r`, the post-trade reserves satisfy:
  - `x' = x / sqrt(r)`
  - `y' = y * sqrt(r)`

This gives the size of the manipulation trade.

## 1. Cost to push the read 10% high

If the protocol reads WETH `10%` too expensive, `r = 1.10`.

Required USDC pushed into the pool:

```text
net USDC in = y * (sqrt(1.10) - 1)
            = 100,000,000 * (1.048808848 - 1)
            = 4,880,885 USDC
```

Because the pool fee is `0.05%`, the gross input is:

```text
gross USDC in = 4,880,885 / 0.9995
              = 4,883,326 USDC
fee paid      = 2,442 USDC
```

WETH removed from the pool is worth, at the true external market price:

```text
value of WETH out = y * (1 - 1 / sqrt(1.10))
                  = 100,000,000 * (1 - 0.953462589)
                  = 4,653,741 USDC
```

If the attacker immediately dumps that WETH externally at the true market price, the manipulation loss is:

```text
4,883,326 - 4,653,741 = 229,585 USDC
```

So making the protocol read WETH `10%` too high costs about **`$230k`**, and only requires about **`$4.9M`** of temporary trade size. That temporary capital can be flash-borrowed.

## 2. Cost to push the read 10% low

For forced liquidations, the attacker wants WETH `10%` too cheap, so `r = 0.90`.

Required WETH sold into the pool, measured at the true market value:

```text
net WETH in (USD value) = y * (1 / sqrt(0.90) - 1)
                        = 100,000,000 * (1.054092553 - 1)
                        = 5,409,255 USDC of WETH
```

Including the `0.05%` fee:

```text
gross WETH in value = 5,409,255 / 0.9995
                     = 5,411,961 USDC
fee paid            = 2,706 USDC
```

USDC removed from the pool:

```text
USDC out = y * (1 - sqrt(0.90))
         = 100,000,000 * (1 - 0.948683298)
         = 5,131,670 USDC
```

Manipulation loss:

```text
5,411,961 - 5,131,670 = 280,291 USDC
```

So making the protocol read WETH `10%` too low costs about **`$280k`**, with about **`$5.4M`** of temporary trade size.

## 3. What does the attacker get?

Two obvious extraction paths exist.

### A. Borrow too much against overpriced collateral

At true price, the maximum debt against `$2M` of WETH at `85%` LTV is:

```text
2,000,000 * 0.85 = 1,700,000 USDC
```

If the oracle reads WETH `10%` too high, the protocol thinks the collateral is worth `$2.2M`, so it may allow:

```text
2,200,000 * 0.85 = 1,870,000 USDC
```

Extra debt extractable:

```text
1,870,000 - 1,700,000 = 170,000 USDC
```

Against one `$2M` position, a pure overborrow attack extracts about **`$170k`**. That alone does **not** cover the roughly **`$230k`** manipulation loss, so this path is borderline or negative on one position. It becomes more attractive if:

- the attacker can borrow against multiple accounts in the same manipulated read,
- the protocol has other design mistakes, or
- the attacker expects some of the bad debt to be socialized.

### B. Liquidate healthy accounts using an underpriced collateral read

At the true price, a maxed-out but healthy account has:

```text
collateral value = 2,000,000
debt             = 1,700,000
LTV              = 85%
```

If the oracle reads WETH `10%` low, the protocol thinks the collateral is worth only `$1.8M`, and sees:

```text
observed LTV = 1,700,000 / 1,800,000 = 94.44%
```

That account now appears liquidatable even though nothing real changed.

If a liquidator repays `R` USDC and receives collateral using the manipulated price plus liquidation bonus `b`, the *true* market value of collateral seized is:

```text
true seized value = R * (1 + b) / 0.90
```

So the liquidator profit is:

```text
profit = R * ((1 + b) / 0.90 - 1)
```

Examples for a full `1.7M` USDC liquidation:

- With `0%` bonus: `1.7M * (1 / 0.90 - 1) = 188,889 USDC`
- With `5%` bonus: `1.7M * (1.05 / 0.90 - 1) = 283,333 USDC`
- With `10%` bonus: `1.7M * (1.10 / 0.90 - 1) = 377,778 USDC`

Compared with the manipulation cost of about `280,291 USDC`:

- `0%` bonus: attacker loses about `91k`
- `5%` bonus: attacker is already slightly profitable
- `10%` bonus: attacker clears about `97k`

Break-even bonus for liquidating a full `1.7M` debt position is:

```text
280,291 / 1,700,000 = 16.49%
((1 + b) / 0.90 - 1) = 16.49%
1 + b = 1.04841
b = 4.84%
```

So any liquidation bonus above about **`4.84%`** makes a single full-size forced liquidation profitable. Many lending markets use liquidation incentives in the `5%` to `10%` range.

It gets worse:

- the manipulation cost is paid once per transaction, but the attacker can liquidate multiple victim accounts while the oracle is bad,
- the capital for the manipulation can be flash-loaned,
- arbitrage bots do not protect you, because your contract reads the manipulated `slot0` *inside the attacker's transaction* before backrunners get a chance to restore the price.

That is why the teammate's "arbitrage will fix it in the same block" argument is not a defense. Same-block restoration happens **after** your contract has already accepted the bad price.

## 4. What we should use instead

For Ethereum mainnet WETH collateral, price it from a **Chainlink oracle**, not from Uniswap `slot0`.

Practical choices:

- Primary: `ETH / USD` Chainlink feed, treating `WETH == ETH`.
- If health is denominated in USDC terms, derive `WETH / USDC` as:

```text
WETH/USDC = (ETH/USD) / (USDC/USD)
```

- If you want an onchain market sanity check, use a **Uniswap v3 TWAP** over a meaningful window such as `30+ minutes`, but only as a secondary bound or circuit breaker, not as the primary liquidation price.

The right design principle is:

- use a manipulation-resistant oracle for state transitions that move value,
- optionally compare it against DEX TWAPs to detect feed failures,
- never use single-block DEX spot for borrow limits or liquidations.

## 5. What must be checked before using the price in health math

Before a price is consumed in a health calculation, the protocol should check at least:

1. **Freshness**
   - `updatedAt` must be recent enough for the asset and market.
   - If the feed is stale, do not allow new borrowing or liquidations off it.

2. **Positive, nonzero answer**
   - Reject `answer <= 0`.

3. **Decimals normalization**
   - Chainlink feeds, WETH, and USDC do not share decimals.
   - Normalize everything into a single fixed-point domain before computing LTV.

4. **Round completeness / validity**
   - Use `latestRoundData()` correctly.
   - Reject unset or obviously invalid rounds.

5. **Bounds / sanity checks**
   - Compare against a secondary source such as a Uniswap TWAP.
   - If deviation exceeds a threshold, pause sensitive actions or fall back conservatively.

6. **Conservative orientation**
   - For collateral, be conservative on value.
   - For debt, do not make assumptions that hide risk. If debt is accounted in USDC terms, explicitly define how USDC depeg risk is handled instead of silently assuming `$1` forever.

7. **Action gating on oracle failure**
   - Decide up front what happens if the oracle is stale, invalid, or out of bounds.
   - The usual safe default is: allow repayment and top-ups, block new borrowing, and block liquidations unless a separate emergency path is defined.

## Conclusion

Using Uniswap v3 `slot0` as the lending oracle is economically unsafe here. A `10%` misread is not a "tens of millions burned" event; it is roughly a **`$230k` to `$280k`** manipulation cost with only **`$4.9M` to `$5.4M`** of temporary swap size. That is within flash-loan range and can already be profitable against a single `$2M` account if liquidation incentives are normal market size, and even more profitable if multiple accounts can be hit in one transaction.

The collateral price should come from **Chainlink**, with freshness/validity/decimal checks, and ideally a secondary **Uniswap TWAP sanity check** or circuit breaker. Do not use `slot0` spot in any health, borrow, or liquidation path.
