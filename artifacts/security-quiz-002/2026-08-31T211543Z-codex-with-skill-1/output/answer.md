# Lending Market Oracle Design Review

Using `slot0` from a single Uniswap V3 pool as the liquidation oracle is not defensible here. The pool depth only tells you the temporary notional needed to move the spot price; it does **not** tell you the attacker's economic loss, because the attacker can manipulate, call your lending contract while the price is wrong, and unwind inside the same transaction with a flash loan.

## 1. What it costs to move the Uniswap V3 spot 10%

Assume the WETH/USDC 5 bps pool has about **$200M** of active liquidity around spot, and be generous to the defense by pretending that liquidity stays constant across the full 10% move. In Uniswap V3 terms, with price `P` in USDC per WETH and liquidity `L`:

- `x = L / sqrt(P)` WETH in-range
- `y = L * sqrt(P)` USDC in-range
- pool value in USDC at spot is `V = P*x + y = 2L*sqrt(P)`

So with `V = $200M`, moving the price up by 10% to `P' = 1.1P` needs:

- `ΔUSDC_in = L * (sqrt(P') - sqrt(P))`
- `ΔUSDC_in = V/2 * (sqrt(1.1) - 1)`
- `ΔUSDC_in = 100,000,000 * (1.048808848 - 1)`
- `ΔUSDC_in ~= $4.88M`

That is the **net** USDC that must hit the pool. With a 5 bps fee tier, gross input is about:

- `gross_in ~= 4.88M / 0.9995 ~= $4.883M`

So the teammate's "tens of millions" estimate is off by about a factor of 4 to 10 even under optimistic assumptions for the defense. Real V3 liquidity is concentrated by tick, so the true number can be lower if liquidity thins out before the 10% mark.

### The important number is the loss, not the temporary notional

If the attacker manipulates and then **self-unwinds** after your contract reads the price, the principal comes back. The attacker does not have to leave the pool skewed for arbitrageurs to clean up.

The first-order loss is just the two swap fees:

- entry fee: about `0.05% * $4.883M ~= $2.44k`
- exit fee: about another `$2.44k`
- total fee loss: about **$4.9k**, plus gas

So the attack is not "burn tens of millions." It is "source about $4.9M intratx, usually from a flash loan, and burn roughly $5k."

The same logic works in the other direction. Pushing the read price **down** by 10% also costs only low-single-digit millions of temporary notional and low-thousands of economic loss.

## 2. What they get for it

There are two relevant payoffs.

### A. Overprice WETH by 10% and overborrow

For a max position with real collateral value `$2.0M` and liquidation threshold `85%`:

- honest max debt: `2.0M * 85% = 1.70M USDC`
- manipulated collateral value read by your contract: `2.0M * 1.10 = 2.20M`
- manipulated max debt: `2.20M * 85% = 1.87M USDC`

Extra borrow capacity created by the manipulated read:

- `1.87M - 1.70M = 170k USDC`

So about **$5k** of manipulation cost can buy about **$170k** of extra borrowing power on one max-size account, a ~34x gross payoff on the bypass itself.

Important nuance: because the collateral is WETH, this is not necessarily immediate protocol insolvency by itself. After the transaction, the true LTV is:

- `1.87M / 2.0M = 93.5%`

That position is liquidatable, but it is still nominally overcollateralized at the moment of creation. The real damage is that your protocol's own 85% limit has become unenforceable, and a thin liquidation bonus, slippage, market move, or partial-liquidation design can turn that into bad debt.

### B. Underprice WETH by 10% and force liquidations

This is the cleaner extraction path.

Take a healthy borrower at 80% true LTV:

- real collateral: `$2.0M`
- debt: `$1.6M`
- true LTV: `80%`

If your contract reads collateral 10% low, it sees:

- read collateral value: `$1.8M`
- read LTV: `1.6M / 1.8M = 88.9%`

That account now appears liquidatable even though it is healthy at the real market price.

The liquidator's profit is then the protocol's liquidation incentive. If your bonus were:

- `5%`, repaying `$1.0M` of debt earns about `$50k` of extra collateral
- `5%`, repaying the full `$1.6M` earns about `$80k`
- `8%`, repaying the full `$1.6M` earns about `$128k`

So a false-liquidation trade can also turn a roughly **$5k** oracle manipulation cost into **tens of thousands** of extractable value.

This is why "arbitrage fixes it in the same block" is the wrong threat model. The attacker only needs the price to be wrong at the exact moment **your contract** reads it.

## 3. What the protocol should use instead

For Ethereum mainnet WETH collateral against USDC debt, use a **Chainlink-based price**, not a single-pool Uniswap spot.

The cleanest way to value collateral in USDC terms is:

- `WETH value in USDC = (ETH/USD feed) / (USDC/USD feed)`

using canonical Chainlink proxy feeds and treating mainnet WETH as 1:1 with ETH.

Why this is better:

- it is not synchronously manipulable by an intratx swap in one pool
- it is not hostage to one venue's tick distribution or temporary pool imbalance
- it correctly handles **USDC depeg risk**, which a bare ETH/USD feed or a direct WETH/USDC spot read does not

If you want onchain market data as a secondary signal, use a **long-window Uniswap V3 TWAP** only as a sanity check or circuit breaker, not as the primary liquidation price.

## 4. Checks required before using the price in health math

Before a health calculation uses the oracle, all of these should pass:

### Feed validity

- Read through the Chainlink **proxy** with `latestRoundData()`.
- Require `answer > 0`.
- Require `updatedAt != 0`.
- Require `block.timestamp - updatedAt <= maxStaleness`.
- Do **not** rely on `answeredInRound`; Chainlink marks it deprecated.

### Decimal normalization

- Normalize feed decimals explicitly. Chainlink feeds are commonly 8 decimals, USDC is 6, WETH is 18.
- Normalize to one internal precision before computing health.
- Multiply before dividing.
- Round **collateral value down** and **debt value up** so health checks are conservative.

### Price composition

- If you compute `ETH/USD / USDC/USD`, verify both feeds independently.
- If either feed is stale or invalid, do not fall through to a spot DEX read for liquidations.
- Decide policy during USDC stress explicitly: if `USDC/USD` moves materially, your system should reflect that rather than assuming `1 USDC = $1`.

### Circuit breakers

- Compare against a secondary reference, typically a sufficiently long Uniswap TWAP.
- If deviation exceeds a configured bound, freeze new borrowing and preferably freeze liquidations until governance or automation resolves it.
- Implement your own breaker; Chainlink documentation notes `minAnswer`/`maxAnswer` are not generally a live safety mechanism.

### Operational checks

- Hardcode the intended feed proxy addresses and expected decimals/description at deployment.
- Pause or degrade safely if a feed is deprecated, replaced, or unavailable.
- Test edge cases: stale feed, zero/negative answer, USDC depeg, decimal mismatch, and rounding at the liquidation threshold.

## Bottom line

Reading `slot0` from the Uniswap V3 WETH/USDC pool makes the oracle synchronously manipulable. Under the teammate's own `$200M liquidity` assumption, a **10%** spot distortion costs only about **$4.88M** of temporary swap notional and about **$4.9k** of actual loss if the attacker manipulates and unwinds atomically.

That is cheap relative to what it buys:

- about **$170k** of extra borrow headroom on a max `$2M` WETH position, or
- **tens of thousands** in false-liquidation profit, depending on the liquidation bonus

The right design is to price WETH collateral with **Chainlink ETH/USD and USDC/USD feeds**, then gate health calculations on freshness, positivity, decimal normalization, conservative rounding, and a secondary-source circuit breaker.
