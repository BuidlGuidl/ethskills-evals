# Oracle design review

Using `slot0` from the Uniswap v3 WETH/USDC `0.05%` pool for health checks and liquidations is not defensible. The relevant question is not "how much capital sits in the pool?" but "how much does it cost to distort the spot price just long enough for our contract to read it?" On a concentrated-liquidity AMM, that temporary distortion is much cheaper than the teammate's writeup suggests.

## 1. Cost to push the read price 10%

Take the teammate's own premise: roughly `$200M` of active liquidity around the current price.

Near the current price in a v3 pool, the virtual reserves are:

- `x = L / sqrt(P)` of WETH
- `y = L * sqrt(P)` of USDC

So the total marked-to-market value at price `P` is:

- `x * P + y = 2 * L * sqrt(P)`

If that value is `$200M`, then:

- `L * sqrt(P) = $100M`

That is enough to price the 10% move without knowing the exact ETH price.

For a move from `P` to `P'`, Uniswap v3 requires:

- USDC in to move price up: `Δy = L * (sqrt(P') - sqrt(P))`
- WETH in to move price down: `Δx = L * (1/sqrt(P') - 1/sqrt(P))`

### Push WETH price up by 10%

Set `P' = 1.10 P`.

Then:

- `Δy = L * sqrt(P) * (sqrt(1.10) - 1)`
- `Δy = $100M * (1.0488088 - 1)`
- `Δy ≈ $4.88M`

So an attacker needs to swap in about **`$4.88M USDC`** to make our contract read WETH **10% too high**.

### Push WETH price down by 10%

Set `P' = 0.90 P`.

The WETH input, marked at the true market price, is:

- `Δx * P = L * sqrt(P) * (1/sqrt(0.90) - 1)`
- `Δx * P = $100M * (1.0540926 - 1)`
- `Δx * P ≈ $5.41M`

So an attacker needs to swap in about **`$5.41M` worth of WETH** to make our contract read WETH **10% too low**.

These are not "tens of millions." They are mid-single-digit millions, which is flash-loan scale on Ethereum mainnet.

## 2. What does the attacker actually lose?

If the attacker can:

1. borrow the manipulation capital,
2. move the pool price,
3. call our lending market while the manipulated spot is live,
4. unwind the manipulation,
5. repay the flash loan,

all in one transaction, then arbitrage bots do **not** protect us. Bots cannot intervene inside the attacker's transaction.

Without fees, a buy-then-sell back along the same AMM curve is nearly lossless. The real economic loss is mainly:

- the pool fee on the way in,
- the pool fee on the way out,
- flash-loan fee,
- gas.

For the `0.05%` pool:

### 10% upward manipulation

- first swap notional: about `$4.88M`
- unwind notional: about `$4.65M`
- total LP fees: about `0.05% * ($4.88M + $4.65M) ≈ $4.8k`

### 10% downward manipulation

- first swap notional: about `$5.41M`
- unwind notional: about `$5.13M`
- total LP fees: about `0.05% * ($5.41M + $5.13M) ≈ $5.3k`

Add flash-loan fees and gas and the attack is still in the **low thousands to low tens of thousands of dollars**, not millions.

That is the actual reason DEX spot reads are unsafe for lending: the attacker does not need to "hold" the bad price; they only need to make us observe it once.

## 3. What do they get for it?

### Overpricing collateral: direct bad-debt extraction

Suppose the attacker deposits the maximum allowed real collateral: **`$2.0M` of WETH**.

At the intended `85%` LTV cap, they should be able to borrow:

- `0.85 * $2.0M = $1.70M` USDC

If they first manipulate `slot0` so WETH reads **10% too high**, the protocol values the same collateral at:

- `$2.0M * 1.10 = $2.20M`

Then the protocol allows:

- `0.85 * $2.20M = $1.87M` USDC

Extra borrow enabled by the oracle error:

- `$1.87M - $1.70M = $170k`

So roughly **`$170,000`** of extra USDC can be extracted from one max-size position, against an attack cost on the order of **`$5k`** plus flash/gas costs.

After the manipulation is unwound, the position's true LTV is:

- `$1.87M / $2.0M = 93.5%`

which is already far above the intended `85%` threshold. That excess is exactly the protocol loss window the attacker created.

### Underpricing collateral: forced liquidation of healthy users

The same flaw also lets an attacker push WETH **10% too low** for one read and liquidate accounts that are actually healthy.

Example: a user at the legitimate cap has:

- collateral: `$2.0M`
- debt: `$1.70M`
- true LTV: `85%`

If the oracle reads collateral 10% low, the protocol sees:

- collateral value: `$1.80M`
- apparent LTV: `$1.70M / $1.80M = 94.44%`

That user becomes liquidatable even though the market never moved. The attacker then captures whatever liquidation incentive the protocol pays. Unless the liquidation bonus is unusually tiny, this is also comfortably profitable relative to a manipulation cost of only a few thousand dollars.

## 4. Recommendation

Do **not** price collateral from a Uniswap v3 spot read (`slot0`) for borrow, health, or liquidation logic.

For a mainnet WETH-backed USDC lending market, the standard design is:

- use a **manipulation-resistant push oracle** as the primary source, such as **Chainlink ETH/USD**;
- price debt with a compatible feed as well, such as **Chainlink USDC/USD**;
- normalize both to one internal unit before computing health.

If you want an on-chain market-based cross-check, use a **sufficiently long Uniswap v3 TWAP** only as a **sanity check / circuit breaker**, not as the price that directly triggers liquidations. A TWAP weakens, but does not eliminate, manipulation risk; a same-block `slot0` read provides essentially no protection.

## 5. What must be checked before using the price in health math?

Before a price enters a collateral or liquidation calculation, the contract should validate at least the following:

- **Positive answer**: reject zero or negative oracle answers.
- **Freshness**: require `updatedAt` to be within a per-feed max age derived from that feed's heartbeat plus a justified buffer. Do not use one global timeout for every asset.
- **Decimals normalization**: explicitly normalize token amounts and oracle answers. WETH has `18` decimals, USDC has `6`, and Chainlink feeds have their own decimals.
- **Consistent quote unit**: compare collateral and debt in the same unit, e.g. both in USD `1e18` fixed-point.
- **Round completeness / validity**: reject incomplete or obviously invalid oracle responses.
- **Deviation bounds / circuit breaker**: compare the primary oracle to an independent reference such as a Uniswap TWAP and pause or reject if deviation is too large.
- **Liquidation incentive bounds**: cap the liquidation bonus so a temporary oracle issue cannot overpay liquidators even when a position is legitimately under water.
- **Rounding direction**: choose conservative rounding in health checks so arithmetic does not create free borrowing capacity.

On Ethereum mainnet, sequencer-downtime checks are not relevant, but they would be mandatory on an L2 deployment.

## Bottom line

With the teammate's own `$200M` liquidity assumption, a 10% Uniswap v3 spot manipulation costs only about **`$4.9M` to `$5.4M` of temporary trade size** and only about **`$5k`** of round-trip LP fees, while it can unlock about **`$170k`** of extra borrow on a single max-size position or enable profitable liquidation of healthy users. That is an unacceptable oracle for a lending market.

Use a robust external oracle for health and liquidation decisions, and treat Uniswap only as a secondary sanity check, not the source of truth.
