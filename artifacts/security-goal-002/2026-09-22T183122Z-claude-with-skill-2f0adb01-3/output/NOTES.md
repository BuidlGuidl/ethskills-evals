# WETH/USDC borrowing market — operator notes

One contract, `src/WethUsdcMarket.sol`. Lock WETH, borrow USDC against it.

| Parameter | Value | Where enforced |
|---|---|---|
| Max LTV | 70% | `borrow`, `withdraw` |
| Liquidation threshold | 85% | `liquidate`, `isLiquidatable` |
| Liquidation bonus | 5% | `liquidate` |
| Close factor | 50% of debt per call | `liquidate` |
| Borrow rate | flat annual, bps, owner-settable, capped at 50% | `accrue` |

---

## 1. How a position's health is computed

**Collateral value.** WETH is 18 decimals, USDC is 6, and the Chainlink ETH/USD feed is 8. All
three are read from the respective contracts at deploy time (`COLLATERAL_UNIT`, `DEBT_UNIT`,
`FEED_UNIT`) rather than hardcoded, and everything is denominated in USDC units:

```
collateralValue = collateralWeth * price * DEBT_UNIT / (COLLATERAL_UNIT * FEED_UNIT)
```

This is a single `Math.mulDiv`, so the whole numerator is computed at 512-bit width before the
one division — multiply before divide, no intermediate truncation, no overflow. It rounds **down**,
so collateral is never valued optimistically.

**Debt.** Interest lives in one global index, not in per-user timestamps. `borrowIndex` starts at
`1e27` and grows linearly with elapsed time:

```
borrowIndex += borrowIndex * rateBps * elapsed / (10_000 * 365 days)
debtOf(user)  = scaledDebt[user] * borrowIndex / 1e27     (rounded UP)
```

`accrue()` is public, and every state-changing entry point calls it first. The view functions
(`debtOf`, `totalDebt`, `healthFactor`) apply the same formula to a *previewed* index, so a
read and the write that follows it in the same block agree — no stale-view liquidation surprises.

Rounding is asymmetric and always points at the pool:
- computing debt owed → up
- new debt on `borrow` → up
- credit given on partial `repay` → down (capped at the position's scaled balance)
- a *full* repay zeroes `scaledDebt` outright, so no dust wei of debt can survive

**The two thresholds are different on purpose.**

- `borrow` and `withdraw` check `debt * 10_000 <= collateralValue * 7_000` (70%).
- `liquidate` checks `debt * 10_000 > collateralValue * 8_500` (85%).

Both comparisons are cross-multiplied — there is no division, so no truncation decides whether
someone gets liquidated. The 15-point gap means a user who maxes out their borrow cannot be
liquidated by their own transaction, or by a single tick of the oracle; price has to actually move
against them.

`healthFactor(account)` returns `collateralValue * 85% / debt` scaled by 1e18. Below `1e18` the
position is liquidatable; no debt returns `type(uint256).max`.

## 2. What a liquidator has to do

```solidity
usdc.approve(address(market), repayAmount);
market.liquidate(borrower, repayAmount, recipient);
```

Preconditions the contract enforces:

1. The position is past 85% — otherwise `PositionHealthy`.
2. `repayAmount <= 50%` of current debt — otherwise `RepayExceedsCloseFactor`. Call twice (or
   wait) to take more. Use `debtOf(borrower)` to size the call; it already includes accrued interest.
3. The liquidator holds and has approved that much USDC.

Collateral seized:

```
seize = repaid * 10_500 / 10_000 * COLLATERAL_UNIT * FEED_UNIT / (DEBT_UNIT * price)
```

i.e. WETH worth 105% of the USDC repaid. Rounded down.

**The underwater case.** If the position is so far gone that `seize` exceeds the collateral actually
present, the contract clamps the seizure to the real balance *and recomputes the repayment down to
match* — the liquidator is charged only for the WETH it receives, never for a bonus that isn't
there. The shortfall stays on the borrower's books as bad debt (visible via `totalDebt` exceeding
what the collateral backs) rather than being silently shifted onto whoever showed up to help.
`Liquidated.collateralExhausted` flags this.

Ordering inside `liquidate` is checks → effects → interactions, the USDC is pulled in *before* the
WETH goes out, and the function is `nonReentrant`.

Practical notes for running a liquidation bot:
- Liquidations are ordinary public mempool transactions and will be contested. Submit through a
  private relay (Flashbots Protect / MEV-Share) or expect to be frontrun.
- `previewSeize(repayAmount)` and `isLiquidatable(account)` are the two calls to poll. Both revert
  if the oracle is stale — treat a revert as "do not act", not as "not liquidatable".
- There is a `minDebt` dust floor so positions can't be whittled down to amounts not worth the gas.

## 3. What an operator has to get right on mainnet

**Constructor arguments are the whole security model.** Get these wrong and nothing downstream saves you.

- `owner_` — **must be a multisig or timelock, never an EOA.** The contract uses `Ownable2Step`, so
  the handover requires the new owner to accept; confirm `owner()` actually changed before funding.
- `priceFeed_` — Chainlink ETH/USD `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` (8 decimals).
  Verify onchain. A wrong-but-plausible feed (ETH/BTC, a testnet address) prices every position wrong.
- `maxPriceStaleness_` — must track that feed's **heartbeat**, which is 3600s for ETH/USD. The deploy
  script uses 3900s for slack. Set it too high and the market prices off an abandoned feed; too low
  and the market bricks itself between routine updates.
- `minPrice_` / `maxPrice_` — the sanity band. Chainlink aggregators clamp at their own min/max
  answer; in a violent crash the feed can report the floor rather than the market. Reverting beats
  liquidating the entire book at a fake price. Revisit these as ETH's range moves — they are
  owner-settable for exactly that reason.
- `minDebt_` — size it against realistic mainnet gas so liquidating a small position is still
  profitable. 500 USDC in the deploy script is a starting point, not a researched number.

**Liquidity is owner-supplied.** This is a single-lender market: `addLiquidity` / `removeLiquidity`
are `onlyOwner` and there is no lender share token. That is a deliberate scope choice — it keeps the
task's surface small and it means there is no share price to inflate, so the classic first-depositor
donation attack does not exist here. Consequences to accept:
  - Borrowers can only draw what the owner has funded; `borrow` reverts with `InsufficientLiquidity`.
  - All interest accrues to the pool, i.e. to the owner.
  - If you later want outside depositors, that is an ERC-4626-style vault on top and a real design
    exercise (share rounding, withdrawal queues against utilisation) — not a small patch.
  - `removeLiquidity` can only move USDC that isn't lent out, and cannot touch collateral at all.
    But the owner *can* drain all idle USDC. Users must trust the owner with the lending side; they
    do not have to trust it with their collateral.

**The pause is deliberately one-directional.** `setBorrowPaused` blocks new borrows and new
deposits. Repay, withdraw-while-healthy and liquidate are **never** pausable. A pause that can trap
collateral is a censorship vector and a hostage situation; this one can only stop new risk entering.
Even so, it is owner-controlled — put it behind the same multisig.

**Token quirks that are live risks here.**
- USDC is upgradeable, pausable, and has a blocklist. If USDC pauses, repayments stop while interest
  keeps accruing; if the market address itself were blocklisted, the market stops. Nothing onchain
  fixes this — know it's the failure mode.
- All token movement goes through `SafeERC20`, and incoming transfers credit the measured balance
  delta, so a fee-on-transfer or upgraded token can never credit more than the contract holds.
- Don't deploy this against a rebasing collateral (stETH). It assumes a balance that only changes
  when this contract moves it. wstETH would be fine, WETH is what it's built for.

**Before you broadcast.**
- `forge test` (20 tests including two fuzz invariants: repay never credits more than it collects,
  liquidation never seizes more collateral than exists) and `forge build` are clean with no warnings.
- Run `slither .` and resolve anything about reentrancy, unchecked returns, or unprotected
  state-changing functions.
- `forge verify-contract` after deploy — constructor args included. An unverified lending contract
  is indistinguishable from a scam.
- Fund with a small amount and run one deposit → borrow → repay → withdraw cycle, plus one real
  liquidation on a deliberately unhealthy test position, before opening it up.

**Known limitations, stated plainly.**
- Bad debt is not socialised or auctioned; it sits on the position. There is no reserve/insurance fund.
- The rate is flat and manual, not utilisation-driven, so the market can be fully drawn with no rate
  pressure to bring liquidity back. This was scoped out on purpose.
- Single collateral, single debt asset, no per-account borrow caps beyond available liquidity.
- Not audited.
