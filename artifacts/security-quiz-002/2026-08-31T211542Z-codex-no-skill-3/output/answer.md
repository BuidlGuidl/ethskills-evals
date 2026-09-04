# Lending market oracle review

The proposed `slot0` design is unsafe for health checks. The reason is not philosophical; it is economic.

## 1. What it costs to make `slot0` print a 10% wrong price

Assume, generously for the defender:

- the Uniswap v3 WETH/USDC 5 bps pool really has about `$200m` of *active* liquidity at the current price,
- that means about `$100m` of WETH and `$100m` of USDC notionally sit on each side of the current price,
- the attacker only needs the price to be wrong at the instant our contract reads it,
- they can use a flash loan and do everything atomically in one transaction.

To make WETH read **10% too expensive** in USDC, the attacker buys WETH from the pool with USDC until:

\[
P_1 = 1.10 \cdot P_0
\]

For a constant-liquidity AMM around the current tick, the USDC that must actually move the price is:

\[
\Delta Q = R\left(\sqrt{1.10} - 1\right)
\]

with `R = $100,000,000`.

\[
\Delta Q \approx 100,000,000 \cdot (1.048808848 - 1) = 4,880,885
\]

So the attacker needs to push only about **`$4.88m` effective USDC** into the pool, not "tens of millions".

Because the pool fee is `0.05%`, the gross input is:

\[
\frac{4,880,885}{0.9995} \approx 4,883,326 \text{ USDC}
\]

The WETH they receive is:

\[
\Delta W = \frac{R}{P_0}\left(1 - \frac{1}{\sqrt{1.10}}\right)
\]

If `P0 = $2,000/ETH`, then:

\[
\Delta W \approx 50,000 \cdot (1 - 0.953462589) = 2,326.87 \text{ WETH}
\]

### If they had to leave the trade open

If they bought `2,326.87` WETH for `4.883m` USDC and then immediately marked that WETH back to the true market price of `$2,000`, it would be worth about:

\[
2,326.87 \cdot 2,000 = 4,653,741
\]

So the mark-to-market loss would be about:

\[
4,883,326 - 4,653,741 = 229,585 \text{ USDC}
\]

That is the number your teammate is intuitively reaching for.

### But for a `slot0` oracle they do **not** have to leave it open

With a spot read, the attacker can:

1. flash borrow USDC,
2. buy WETH to move the pool price +10%,
3. call our lending contract while `slot0` is manipulated,
4. unwind the swap in the same transaction,
5. repay the flash loan.

Arbitrage bots do nothing here because the bad read already happened before the transaction ends.

The attacker therefore does **not** pay the `$229k` mark-to-market loss. The unavoidable cost is roughly the round-trip trading fee:

- first swap fee: `4,883,326 * 0.0005 = 2,441.66 USDC`
- second swap fee: about `2,328.03 WETH * 0.0005 ~= 1.164 WETH ~= 2,328.03 USDC` at `$2,000/ETH`

Total round-trip fee cost:

\[
2,441.66 + 2,328.03 = 4,769.69 \text{ USDC}
\]

So under the defender-friendly `$200m` liquidity assumption, a **10% oracle error costs roughly `$4.8k` plus flash-loan fee and gas**, not tens of millions.

Also, this is still optimistic for the defender:

- only **active in-range liquidity** matters, not TVL headlines,
- liquidity can be pulled,
- if active liquidity is lower than `$200m`, the attack is cheaper.

## 2. What they get for it

Your market allows positions up to `$2m` of WETH collateral with an `85%` liquidation threshold.

If the true collateral value is `$2,000,000`, the honest max debt is:

\[
2,000,000 \cdot 0.85 = 1,700,000 \text{ USDC}
\]

If the oracle overstates WETH by `10%`, the protocol sees:

\[
2,000,000 \cdot 1.10 = 2,200,000
\]

and allows debt up to:

\[
2,200,000 \cdot 0.85 = 1,870,000 \text{ USDC}
\]

Extra debt extractable:

\[
1,870,000 - 1,700,000 = 170,000 \text{ USDC}
\]

So the core trade is:

- **cost:** about `$4.8k` to manipulate the read,
- **benefit:** about **`$170k` extra borrow capacity** on a max-size position.

That is a very favorable attack.

The same spot oracle also enables **false liquidations** in the other direction. If WETH is pushed **10% too low**, then a position with true LTV `x` is seen as:

\[
\frac{x}{0.9}
\]

Any account above:

\[
0.85 \cdot 0.9 = 0.765
\]

or **`76.5%` true LTV** becomes liquidatable even though it should not be. A manipulator who is also the liquidator then captures the liquidation incentive from otherwise healthy users.

## 3. What the protocol should use instead

For a USDC-denominated debt market, price WETH collateral from a **manipulation-resistant oracle**, not from a DEX spot read.

The clean design on Ethereum mainnet is:

- primary source: **Chainlink `ETH/USD`**
- debt-side source: **Chainlink `USDC/USD`**
- composed collateral price in USDC:

\[
\text{WETH/USDC} = \frac{\text{ETH/USD}}{\text{USDC/USD}}
\]

That gives you the collateral value in the same unit as the liability, while avoiding single-transaction DEX manipulation.

If you want an onchain market sanity check, use **Uniswap v3 TWAP via `observe`**, not `slot0`, and use it only as a secondary check or fallback guardrail.

Relevant source material:

- Uniswap v3 oracle docs: `observe`/TWAP, not raw spot `slot0`: https://developers.uniswap.org/docs/protocols/v3/concepts/price-oracles
- Uniswap OracleLibrary example: https://github.com/Uniswap/v3-periphery/blob/main/contracts/libraries/OracleLibrary.sol
- Chainlink docs root for data feeds / `latestRoundData`: https://docs.chain.link/

## 4. What must be checked before using that price in health logic

Before a health calculation uses a Chainlink-derived price, check at least:

1. `answer > 0` for every feed used in the composition.
2. `updatedAt != 0`.
3. `block.timestamp - updatedAt <= maxStaleness`, where `maxStaleness` is chosen from the feed's heartbeat and your own risk tolerance.
4. Decimals are normalized correctly before arithmetic.
5. The denominator feed (`USDC/USD`) is not zero and is within sane bounds.
6. Arithmetic rounds **against** the borrower:
   - round collateral value down,
   - round debt value up.
7. A secondary sanity check passes:
   - compare against a sufficiently long Uniswap v3 TWAP,
   - if deviation is too large, do not trust the price for new borrows or liquidations.

Operationally, if the primary oracle is stale or the sanity check fails, the safe behavior is:

- allow `repay`,
- allow `addCollateral`,
- block `borrow`,
- block `withdrawCollateral`,
- usually block `liquidate` off a suspect price as well.

## Conclusion

Reading WETH price directly from the Uniswap v3 WETH/USDC pool's `slot0` does **not** force the attacker to lose tens of millions, or even hundreds of thousands. For the only moment that matters, the attacker can buy the price up 10%, make your contract read it, and unwind atomically for roughly **`$5k`** in AMM fees.

Against that, a max-size position gains about **`$170k`** of extra borrowing power, and a downward manipulation can create false liquidations for users above **`76.5%`** true LTV.

Use **Chainlink-based pricing** for health calculations, ideally composing `ETH/USD` and `USDC/USD`, and gate that price on freshness, positivity, decimal normalization, conservative rounding, and a secondary sanity check such as a Uniswap TWAP.
