# Oracle design review

Using `slot0` from the Uniswap V3 WETH/USDC 5 bps pool as the health-check price is not safe. The relevant number is not "how much capital sits in the pool", but "what is the round-trip cost to move the spot price for one transaction and then unwind it after the protocol has already read it". For a spot oracle, that cost is only trading fees plus a flash-loan fee; arbitrage later in the block does not protect us because the protocol has already consumed the manipulated price.

## 1. Cost to move `slot0` by 10%

Model the pool around the current price with about $200m of active liquidity at the current tick. Near the current price that is equivalent to roughly:

- $100m of WETH-side virtual reserves
- $100m of USDC-side virtual reserves

Let the true price be `P` USDC/WETH and the manipulated price be `1.1P`.

For a constant-product / active-liquidity approximation:

- `x = 100,000,000 / P` WETH
- `y = 100,000,000` USDC
- price ratio `r = 1.1`

To push WETH **up** by 10%, the attacker buys WETH with USDC until the pool price is `1.1P`.

The reserve change is:

- `y' = y * sqrt(r)`
- `x' = x / sqrt(r)`

So the attacker must put in:

- `ΔUSDC = y * (sqrt(1.1) - 1)`
- `ΔUSDC = 100,000,000 * (1.048808848 - 1)`
- `ΔUSDC ~= 4,880,885 USDC`

and receives:

- `ΔWETH = x * (1 - 1 / sqrt(1.1))`

If `P = 2,000`, then `x = 50,000 WETH`, so:

- `ΔWETH ~= 2,326.87 WETH`

That is already enough to show the teammate's "tens of millions" claim is off by about 1 order of magnitude. A 10% move needs about **$4.88m**, not tens of millions, if there is about $200m active around the current tick.

## 2. What does the attacker actually lose?

If the attacker manipulates spot, calls our contract, then unwinds the trade themselves, they do **not** donate the full price impact to arbitrageurs. They can reverse their own trade after our read. In the idealized no-fee case, the round trip is reversible.

So the real manipulation cost is dominated by:

- the 5 bps pool fee on the way in
- the 5 bps pool fee on the way out
- flash-loan fees
- gas

Using the numbers above:

- in-leg pool fee: `4,880,885 * 0.0005 ~= $2,440`
- out-leg pool fee: `2,326.87 WETH * 0.0005 * $2,000 ~= $2,327`
- total pool fees: about **$4,767**

Add a flash-loan fee and gas and the attack is still on the order of **a few thousand dollars**, not millions.

This estimate is also not optimistic for the attacker:

- only *active* liquidity near the current tick matters
- concentrated liquidity means total TVL overstates manipulation resistance if much of it sits away from the current price
- if active liquidity is lower than $200m, the attack gets cheaper

## 3. What do they get for it?

### A. Borrower attack: overvalue WETH, then borrow too much USDC

With true collateral value `C = $2,000,000` and liquidation LTV `85%`, the true max debt is:

- `0.85 * 2,000,000 = $1,700,000`

If the oracle overstates WETH by 10%, the protocol sees collateral worth:

- `1.1 * 2,000,000 = $2,200,000`

and allows debt up to:

- `0.85 * 2,200,000 = $1,870,000`

Extra debt the attacker can take:

- `$1,870,000 - $1,700,000 = $170,000`

So a borrower can spend roughly **$5k** to create about **$170k** of extra borrow capacity on a max-size position, then leave the protocol with the bad debt risk.

That trade is obviously favorable to the attacker.

### B. Liquidator attack: undervalue WETH, force liquidations

If the attacker pushes WETH **down** by 10% instead, every position's collateral is marked at `90%` of fair value for that read.

A position that is truly at LTV `L` appears at:

- `L / 0.9`

So positions become liquidatable when:

- `L / 0.9 >= 85%`
- `L >= 76.5%`

That means any account above **76.5% true LTV** can be made to look liquidatable by a one-block 10% downward spot manipulation.

The attacker's profit there is the liquidation incentive. The exact dollar amount depends on our liquidation bonus and how much victim inventory is available, but the mechanism is real even if the liquidator does not own the victim account.

## 4. Why "arbitrage bots fix it in the same block" does not save us

Because the exploit is:

1. flash-loan capital
2. move Uniswap spot
3. call our borrow or liquidation function
4. unwind the spot move
5. repay flash loan

Our contract reads the manipulated price in step 3. Anything that happens after step 3 is irrelevant to the correctness of that read.

Same-block arbitrage only matters if **we** read a TWAP over a sufficiently long window, not if we read instantaneous `slot0`.

## 5. What we should use instead

Use a manipulation-resistant oracle as the primary health-check price:

- primary: **Chainlink ETH/USD** and **Chainlink USDC/USD**, combined into a WETH/USDC price
- sanity check / fallback: **Uniswap V3 TWAP**, not `slot0` spot

For health calculations, the robust pattern is:

- value collateral with a price that cannot be moved inside the borrow or liquidation transaction
- make the price conservative when sources disagree

For example:

- `weth_usdc = eth_usd / usdc_usd` from Chainlink as the primary price
- compare it with a Uniswap TWAP over a meaningful window, such as 30 minutes
- if deviation exceeds a configured bound, pause new borrowing / liquidations or fall back to a conservative path

I would **not** use Uniswap `slot0` directly for solvency decisions.

## 6. Checks required before using the price in a health calculation

Before using the oracle answer, check at least:

- the answer is positive and non-zero
- the feed timestamp is recent enough for the asset's heartbeat and your own tighter staleness bound
- decimals are normalized correctly before arithmetic
- the feed is the intended market pair and quote direction
- the price is within a reasonable deviation bound versus an independent reference such as a Uniswap TWAP
- the protocol's behavior on oracle failure is conservative: no borrowing against unknown prices, and no liquidations from obviously broken prices
- collateral is rounded down and debt is rounded up in fixed-point math, so arithmetic bias does not create free leverage

On Ethereum mainnet specifically, no sequencer-uptime check is needed. On an L2, it would be.

USDC itself should also not be hard-coded as exactly `$1` if solvency matters. If the market is really WETH collateral against USDC debt, the economically correct health check is:

- collateral value from a robust WETH/USD source
- debt value from a robust USDC/USD source
- then compute health from those two values

## Recommendation

Do **not** use Uniswap V3 `slot0` as the collateral price for health checks or liquidations.

With the teammate's own "$200m liquidity" premise, a 10% spot move costs only about **$4.88m of temporary capital** and roughly **$5k of net execution cost**, while it creates about **$170k** of extra borrow capacity on a single `$2m` position and can also force liquidations of accounts above **76.5% true LTV**.

Use **Chainlink as the primary oracle**, derive WETH/USDC from ETH/USD and USDC/USD, and gate it with freshness, positivity, decimal normalization, and a deviation check against a **time-weighted** DEX price.
