# Lending Market Oracle Design Review

The proposed `slot0` spot read from the Uniswap v3 `WETH/USDC 0.05%` pool is not safe for collateral health checks or liquidations.

The reason is economic, not philosophical: the attacker does **not** need to leave the pool mispriced long enough for arbitrageurs to notice. They can:

1. flash-borrow capital,
2. trade the pool to a fake spot price,
3. call our lending contract while that fake price is live,
4. reverse the trade in the same transaction, and
5. repay the flash loan.

Arbitrage bots never get a turn if the manipulation and unwind happen atomically.

## 1. What it costs to move the read by 10%

Take the teammate's own premise: roughly `$200M` of liquidity/value in the pool.

As a first-order approximation, treat the active liquidity near the current price like a balanced constant-product pool with about:

- `$100M` of WETH
- `$100M` of USDC

Let the true price be `P = y / x`, where `x` is WETH reserve and `y` is USDC reserve.

For a constant-product pool, moving price by a factor `r` changes reserves to:

- `x' = x / sqrt(r)`
- `y' = y * sqrt(r)`

So the attack trade size is driven by `sqrt(r)`, not by the full headline TVL.

### Push WETH price up by 10%

Here `r = 1.10`, so:

- `sqrt(1.10) = 1.048808848`
- USDC in needed:
  `Delta_y = 100M * (sqrt(1.10) - 1) = about $4.88M`
- WETH received:
  `Delta_x value at true price = 100M * (1 - 1 / sqrt(1.10)) = about $4.65M`

So a 10% upward spot move is created with about **`$4.9M`** of transient capital, not "tens of millions".

If the attacker then immediately unwinds the manipulation themselves, the pool returns almost all of that value. The main deterministic loss is swap fees:

- first swap fee: `0.05% * $4.88M = about $2.44k`
- unwind fee: `0.05% * $4.65M = about $2.33k`
- total round-trip fee loss: about **`$4.8k`** plus gas

That is the key mistake in the teammate's argument: **deep liquidity does not make atomic spot manipulation expensive; it mainly determines the temporary notional the attacker must route through the pool.**

### Push WETH price down by 10%

Here `r = 0.90`, so:

- `sqrt(0.90) = 0.948683298`
- WETH in needed:
  `Delta_x value at true price = 100M * (1 / sqrt(0.90) - 1) = about $5.41M`
- USDC received:
  `Delta_y = 100M * (1 - sqrt(0.90)) = about $5.13M`

Round-trip fee loss is again only a few thousand dollars:

- first swap fee: about `$2.70k`
- unwind fee: about `$2.57k`
- total: about **`$5.3k`** plus gas

So in either direction, a 10% fake spot is cheap to create for one transaction.

## 2. What the attacker gets

### Case A: over-borrow against inflated collateral

For the stated max position:

- true collateral value: `$2.0M`
- liquidation threshold / max borrow LTV: `85%`
- correct max debt: `0.85 * $2.0M = $1.70M`

If the protocol reads collateral **10% too high**, it values that same collateral at `$2.20M` and permits:

- fake max debt: `0.85 * $2.20M = $1.87M`

Extra debt pulled out:

- **`$1.87M - $1.70M = $170k`**

So the attacker can spend about **`$4.8k`** in pool fees to extract about **`$170k`** of excess USDC debt from one max-sized position, then let the position become undercollateralized once the price snaps back.

That is a strongly profitable attack even before considering repeated use across multiple accounts if the protocol allows it.

### Case B: wrongful liquidation against depressed collateral

If the protocol reads collateral **10% too low**, a position sitting exactly at the intended threshold becomes:

- true LTV: `85%`
- observed LTV under a 10% lowball price:
  `1.70M / 1.80M = 94.44%`

That position now appears liquidatable even though it is healthy at the true market price.

The attacker can then capture the liquidation bonus / discount. The exact profit depends on protocol parameters such as:

- liquidation incentive
- close factor
- protocol liquidation fee

But the core point is unchanged: a 10% spot distortion is enough to flip healthy accounts into liquidation territory.

## 3. Recommendation: what to price collateral with

Do **not** price WETH collateral from a DEX spot read (`slot0`, reserves, balances, or instantaneous quote).

For Ethereum mainnet health checks and liquidations, use a manipulation-resistant oracle such as:

- **Chainlink `ETH / USD`** for WETH collateral
- **Chainlink `USDC / USD`** for debt, or a documented equivalent if the system intentionally hardcodes `$1` for USDC

Then compute health in one common unit, typically USD scaled to a fixed precision.

If you want an additional on-chain sanity check, use a **Uniswap TWAP** or another independent source only as a bound/check, not as the primary liquidation price.

## 4. What must be checked before using the price in health calculations

Before a feed is used, the contract should validate at least:

1. **Positive answer**
   The oracle price must be `> 0`.

2. **Freshness**
   `updatedAt` must be recent enough for that specific feed.
   This should be a per-feed maximum age based on the feed heartbeat plus a justified margin, not one global timeout.

3. **Decimals normalization**
   Normalize:
   - token decimals (`WETH = 18`, `USDC = 6`)
   - oracle decimals (for example many Chainlink USD feeds use `8`)
   Everything must be converted into one documented scale before comparing collateral value and debt value.

4. **Consistent quote basis**
   If collateral is valued in USD and debt is valued in USD, both sides must use the same unit and rounding convention.
   Do not compare an `ETH/USD` price on one side to a raw `USDC` amount on the other without normalization.

5. **Stale / invalid round handling**
   Reject incomplete or invalid oracle responses and define clear behavior when the feed is unavailable.

6. **Depeg handling for USDC**
   If debt is denominated in USDC, decide explicitly whether USDC is treated as:
   - exactly `$1`, or
   - priced from a feed

   Hardcoding `$1` is a separate risk decision. If USDC depegs, health calculations can become wrong in either direction.

7. **Safe rounding direction**
   Round in the protocol-safe direction:
   - round collateral value down
   - round debt value up

   That avoids granting borrowing power from arithmetic dust.

8. **Bounded liquidation economics**
   Even with a good oracle, liquidation incentive and close factor should be bounded so liquidations cannot over-seize value.

## Conclusion

Using Uniswap v3 `slot0` spot for WETH collateral pricing would let an attacker buy a 10% oracle distortion for roughly **`$5k`** in round-trip swap fees and turn that into roughly **`$170k`** of excess USDC borrowing on a single `$2M` position, or into profitable wrongful liquidations.

For this market, collateral should be priced with a manipulation-resistant oracle such as **Chainlink**, with strict checks for positivity, freshness, decimals, normalization, invalid responses, depeg assumptions, and conservative rounding before the price is used in any health or liquidation calculation.
