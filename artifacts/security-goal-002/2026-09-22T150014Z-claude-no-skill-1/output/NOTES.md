# WETH / USDC borrowing market — operator notes

Two contracts get deployed:

| Contract | Role |
| --- | --- |
| `src/ChainlinkOracle.sol` | Turns Chainlink USD feeds into 1e18-scaled USD prices, and refuses to return anything it cannot vouch for. |
| `src/BorrowMarket.sol` | The market itself: WETH collateral, USDC debt, flat-rate interest, liquidations. |

`script/Deploy.s.sol` wires them together with mainnet addresses and the intended risk parameters.

```
forge build
forge test
```

The USDC that gets lent out is supplied by a single trusted `liquidityManager` (treasury or vault).
There is **no public lender side** — no supply shares, therefore no share-price / first-depositor
inflation surface. Interest accrues into the pool and the manager withdraws it as borrowers repay.
If you later want public lenders, that is a separate contract on top; do not bolt shares onto this one
without re-auditing the rounding.

---

## How a position's health is computed

A position is `(collateral, scaledDebt)`.

**Debt.** Interest is a flat annual rate tracked by a single global index:

```
elapsed  = now - lastAccrual
growth   = 1 + ratePerYear * elapsed / 365 days      (WAD)
index    = index * growth                            (rounded up)
debt     = scaledDebt * index / WAD                  (rounded up)
```

Accrual is O(1) and touches no per-user storage. The index only advances while `totalScaledDebt > 0`,
so idle periods do not retroactively tax the next borrower. Every rounding decision is made in the
pool's favour: debt taken on rounds **up**, debt retired by a partial repayment rounds **down**.

**Collateral value**, denominated in USDC units:

```
usdValue         = collateral * wethPrice / 1e18          (1e18 USD)
collateralValue  = usdValue  * 1e6       / usdcPrice      (USDC units, rounded down)
```

Both legs are priced. USDC is *not* assumed to be worth exactly \$1 — if USDC depegs downward,
collateral is correctly worth *more* USDC, and borrowing power moves with it rather than being
silently wrong.

**The two ratios.**

| | Value | Checked when |
| --- | --- | --- |
| `ltvBps` | 70% | `borrow`, `withdrawCollateral` — the action reverts if `debt > collateralValue * 70%` |
| `liquidationThresholdBps` | 85% | `liquidate` — allowed only if `debt > collateralValue * 85%` |

They are deliberately different numbers. A borrower opens at most 70%, so an ordinary price wobble
does not put them up for grabs; nothing becomes liquidatable until 85%. `healthFactor(account)` is
`collateralValue * 85% / debt`, WAD-scaled — below `1e18` means liquidatable, `type(uint256).max`
means no debt.

`setRiskParams` enforces `ltv < liquidationThreshold` and
`liquidationThreshold * (1 + bonus) <= 100%`. The second one matters: with an 85% threshold and a 5%
bonus, a liquidation triggered right at the threshold consumes 89.25% of the collateral, so it cannot
push a barely-unhealthy position into insolvency. Governance cannot configure that invariant away.

A **debt-free position needs no price at all** to withdraw. That is intentional: if the oracle is
stale or the market is paused, borrowers who owe nothing can still get their WETH out.

---

## What a liquidator has to do

```solidity
usdc.approve(address(market), repayAmount);
(uint256 repaid, uint256 seized) = market.liquidate(borrower, repayAmount, recipient);
```

Pass `type(uint256).max` as `repayAmount` to take the maximum the market will allow. Preflight with
`isLiquidatable(borrower)` and `healthFactor(borrower)` — both project pending interest, so they agree
with what the call will see.

**How much you can repay.** Normally the close factor caps a single liquidation at 50% of the debt.
The cap is lifted to the full debt in two cases: the position is already insolvent
(`debt >= collateralValue`), or a capped repayment would strand a remainder below `minDebt` that
nobody would come back for.

**What you get.** Collateral worth what you repaid, plus 5%:

```
seized = repaid * usdcPrice / 1e6 * 1e18 / wethPrice * 105%        (rounded down)
```

Worked example, from the test suite: 10 WETH collateral, 14,000 USDC debt, ETH falls to \$1,600.
Collateral is worth 16,000 USDC, the threshold is 13,600, so the position is liquidatable. The close
factor lets you repay 7,000 USDC; 7,000 / 1,600 = 4.375 WETH, plus the bonus = **4.59375 WETH**. The
borrower is left with 7,000 of debt against 5.40625 WETH, comfortably healthy again.

**Deeply underwater positions.** If the bonus-inclusive seizure would exceed the collateral on hand,
the market clamps the seizure to whatever is left and charges you only what that collateral is
actually worth net of the bonus — you are never asked to overpay for a partial pile. The unrepaid
remainder stays on the books as bad debt against a zero-collateral position. There is no socialisation
mechanism; the `liquidityManager` eats it. Watch for this: the market keeps functioning, but its cash
will not fully recover.

**Practicalities.**
- You need the USDC in hand. There is no flash-liquidation callback — nothing in `liquidate` hands
  control to an untrusted address mid-state-change, which is the point.
- `liquidate` reverts with `PositionHealthy` if you lose the race. Simulate first.
- Liquidations stay open while the market is paused. They are blocked if the oracle is unusable,
  because a liquidation priced off a stale feed is a theft, not a liquidation.

---

## What an operator has to get right on mainnet

**1. The oracle is the whole ballgame.** Every dollar of risk in this system routes through
`ChainlinkOracle`. The adapter already rejects non-positive answers, carried-over rounds
(`answeredInRound < roundId`), incomplete rounds, future timestamps, answers outside a configured
sanity band, and answers older than the configured heartbeat. What *you* must get right is the
configuration:

- `heartbeat` = the feed's published heartbeat plus slack, per feed. ETH/USD on mainnet is 1h; USDC/USD
  is 24h. Using one number for both is wrong in one direction or the other. Too tight and the market
  bricks itself on a slow hour; too loose and a stale price prices a liquidation.
- `minAnswer` / `maxAnswer` are the last line of defence against a feed returning a garbage price. Set
  them wide enough that a real market move does not halt the market, narrow enough that an absurd
  answer cannot mint unbacked USDC. Revisit them as ETH's price range changes — a band set in 2021 is
  a liability now.
- The oracle reads spot Chainlink, so it inherits Chainlink's deviation threshold and its update
  latency. That is a known, accepted exposure for a 70/85 market; it is not acceptable for tighter
  parameters or for thin collateral. Do not reuse this adapter for a long-tail asset.

**2. Ownership goes to a multisig or timelock, not an EOA.** The owner can change risk parameters,
replace the oracle, and pause. `setOracle` is the dangerous one — a malicious oracle drains the market
in one transaction. Put it behind a timelock so the change is visible before it lands. Both contracts
use `Ownable2Step`, so transfers need an explicit `acceptOwnership()`; the deploy script hands the
oracle over but **the transfer stays pending until the new owner accepts it**. Do not consider the
deployment finished until both `owner()` calls return the multisig.

**3. Check the deployed constants against mainnet.** WETH `0xC02a…6Cc2`, USDC `0xA0b8…eB48`, ETH/USD
`0x5f4e…8419`, USDC/USD `0x8fFf…18f6`. The constructor reads `decimals()` off both tokens and rejects
anything above 18, but it cannot tell you that you pointed at the wrong token. Run the deploy script
against a fork and check `collateralValueOf` on a known position before funding it.

**4. USDC is upgradeable and has a blacklist.** Two consequences. If the market's own address is ever
blacklisted, repayments and funding stop working while collateral withdrawals keep working — plan for
that, it is not hypothetical. And a blacklisted *borrower* cannot repay, so their position will drift
into liquidation; that is the liquidator's opportunity and nothing in the contract needs to change,
but support will hear about it. Circle can also upgrade the implementation under you; watch their
announcements.

**5. Set `minDebt` in real money.** The deploy script uses 1,000 USDC. This number exists so that
liquidating a position is worth more than the gas it costs. At 100 gwei a liquidation is a few dollars
of gas; a dust position with 5 USDC of debt would simply never be liquidated and would sit as
permanent bad debt. If mainnet gas expectations change, revisit it.

**6. Seed liquidity before announcing.** `borrow` is bounded by `totalCash`, which is internal
accounting — tokens sent directly to the contract are **not** lendable and are recoverable only via
`skim`. Fund through `fund()`. Conversely `skim` is bounded by that same accounting, so it can never
touch borrower collateral or lendable cash.

**7. Know what `pause` does and does not do.** It stops new borrows. Deposits, repayments,
withdrawals and liquidations stay open by design — pausing is a risk brake, not a hostage-taking
mechanism, and a borrower topping up collateral to escape a liquidation must never be locked out.
If you need to stop liquidations too, the only honest lever is the oracle, and that stops everything.

**8. Accept that bad debt is possible.** A gap-down through the 85% threshold faster than liquidators
can act leaves the shortfall with the `liquidityManager`. Monitor `totalDebt()` against the sum of
collateral value, and keep liquidation bots funded and running — this market has no backstop module,
no insurance fund, and no auction fallback.

**9. Monitor.** At minimum: oracle staleness on both feeds (alert *before* the heartbeat expires),
`totalCash` versus `totalDebt()`, the count of positions below a 1.05 health factor, and any
`RiskParamsSet` / `OracleSet` / `LiquidityManagerSet` event you did not initiate.
