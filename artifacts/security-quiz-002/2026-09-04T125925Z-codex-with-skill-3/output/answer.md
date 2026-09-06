# Lending Market Oracle Review

The proposed design should **not** use a Uniswap v3 `slot0` spot read for collateral pricing.

For a lending protocol, the relevant question is not "how much money sits in the pool?" but:

1. How much capital must an attacker control at the instant of the read?
2. What is their **net cost after they unwind inside the same transaction**?
3. How much value can they extract from the lending market before the transaction ends?

## 1. What it costs to move the Uniswap spot price by 10%

Using the canonical Ethereum mainnet Uniswap v3 WETH/USDC 0.05% pool
`0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`, at block `25904155` on
2026-09-04, the pool returned:

- `slot0.sqrtPriceX96 = 1600854769972945626724027866330374`
- `liquidity() = 4442570639482791316`

For this pool, token0 is USDC and token1 is WETH. From Uniswap v3 math:

- `sqrtP = sqrtPriceX96 / 2^96`
- virtual USDC reserve in the active range: `x = L / sqrtP`
- virtual WETH reserve in the active range: `y = L * sqrtP`

That gives approximately:

- spot price: `1 WETH = 2449.38 USDC`
- active virtual reserves: `219.87M USDC` and `89,764.93 WETH`

So the teammate's "$200M of liquidity" intuition is directionally right, but it does **not** imply safety for a spot-oracle read.

To make the oracle read WETH **10% more expensive** than the real market price, the attacker pushes the pool from `P` to `1.1P` for the instant of the read.

With constant in-range liquidity, moving the price by 10% requires roughly:

- net USDC sent into the pool: `10.7315M USDC`
- WETH received from the pool: `4,177.43 WETH`

Because the pool fee is only `0.05%`, the attacker can do this with a flash loan and then unwind the trade in the same transaction immediately after your contract reads the manipulated price.

The critical point: **their economic cost is not $10.7M**. That is just the temporary capital they route through the pool.

If they round-trip the manipulation in one transaction, the pool state comes back, and their loss is mostly just the two swap fees:

- fee on the pump leg: about `5,368 USDC`
- fee on the unwind leg: about `5,119 USDC`
- total round-trip cost: about **`$10.5k`**

The same order of magnitude applies for a 10% downward manipulation:

- temporary inventory routed: about `4,855.61 WETH` / `11.283M USDC`
- round-trip fee cost: about **`$11.6k`**

So the real answer is:

- **capital needed at the instant of attack:** about `~$11M`
- **net attack cost after same-tx unwind:** about `~$10k-$12k`

That is nowhere near "tens of millions burned for nothing."

## 2. What they get for it

With a max position of `$2,000,000` WETH collateral and liquidation threshold `85%`:

- honest max borrow = `2,000,000 * 0.85 = 1,700,000 USDC`

If the attacker makes your contract read collateral at **+10%**:

- fake collateral value = `$2,200,000`
- fake max borrow = `2,200,000 * 0.85 = 1,870,000 USDC`

That creates **`$170,000` of extra borrow capacity**.

So a same-transaction attack is roughly:

1. Flash-borrow about `10.74M USDC`
2. Push the Uniswap pool up 10%
3. Call your lending market while the bad price is live
4. Borrow an extra `170k USDC` beyond the honest limit
5. Unwind the pool manipulation
6. Repay the flash loan
7. Keep roughly `170k - 10.5k = 159.5k USDC` before gas

The attacker can also use the same primitive to:

- withdraw too much WETH collateral while appearing healthy; or
- push price down and trigger liquidations that should not be allowed, collecting liquidation bonuses

The liquidation-bonus path could be profitable even without owning the victim account. Since no bonus was specified here, the clean quantified extraction is the **extra borrow** path above.

## 3. Recommendation

Price WETH collateral with a **manipulation-resistant push oracle**, not a DEX spot read.

On Ethereum mainnet, the default choice is:

- **primary collateral oracle:** Chainlink `ETH / USD`
- **debt oracle:** Chainlink `USDC / USD`

Then compute health from independently-priced collateral and debt values.

Why this is the right design:

- a Uniswap `slot0` read is atomically manipulable with flash liquidity
- arbitrage bots do not help if the attacker manipulates, uses your protocol, and unwinds all in one transaction
- Chainlink can be stale, but staleness is a bounded and checkable failure mode
- spot DEX manipulation is cheap enough here to be an expected exploit, not a tail event

If you want a DEX-based signal, use it only as a **secondary sanity check** or circuit breaker, preferably from a meaningful TWAP window, not as the authoritative health price.

## 4. Checks required before using the price in health

Before a price is allowed into any borrow / withdraw / liquidation health calculation:

1. `answer > 0`
   Negative or zero oracle answers must hard-fail.

2. Freshness must be feed-specific
   Check `updatedAt` against a per-feed maximum age derived from that feed's heartbeat plus a small justified margin. Do not use one global timeout for all feeds.

3. Decimals must be normalized explicitly
   WETH has 18 decimals, USDC has 6, Chainlink feeds often use 8. Normalize all values to one internal scale before comparing collateral and debt.

4. Use conservative rounding
   Round collateral value **down** and debt value **up** so users do not receive free health from integer truncation.

5. Validate the correct feed pairing
   Do not assume "USDC is always $1". Price the debt asset too, or you will mis-handle depegs exactly when liquidations matter most.

6. Define failure behavior
   If the oracle is stale, zero, or invalid, borrowing and collateral withdrawal should pause. Liquidation behavior under oracle failure must be explicit and conservative.

7. Bound cross-check deviations if you add a secondary oracle
   If you compare Chainlink to a Uniswap TWAP, decide in advance whether disagreement pauses the market or selects the more conservative value. Do not silently pick whichever makes the user healthier.

8. Ensure liquidation parameters are consistent with the oracle model
   The liquidation threshold must leave room for liquidation incentive, slippage, and oracle error. `85%` is only safe if the rest of the liquidation pipeline still leaves enough collateral to repay debt plus bonus.

## Bottom line

Reading WETH collateral price directly from Uniswap v3 `slot0` is unsafe for a lending market.

A 10% manipulation in the live 5 bps WETH/USDC pool needs only about `~$11M` of temporary capital and costs only about `~$10k-$12k` after a same-transaction unwind, while it unlocks about **`$170k`** of extra borrow capacity on a `$2M` position.

That is a cleanly profitable oracle-manipulation attack.

Use Chainlink for the health price, price both sides of the position, and enforce positivity, freshness, decimal normalization, conservative rounding, and explicit failure handling before using the result in any health calculation.
