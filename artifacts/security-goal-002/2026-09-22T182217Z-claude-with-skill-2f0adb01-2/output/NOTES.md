# BorrowMarket — operator and integrator notes

A single-pair borrowing market: lock **WETH** as collateral, borrow **USDC** against it.
One contract, `src/BorrowMarket.sol`. Deployment script in `script/DeployBorrowMarket.s.sol`.

```
forge build
forge test
```

## Parameters

| Parameter | Value | Where |
|---|---|---|
| Max LTV (borrow / withdraw limit) | 70% | `MAX_LTV_BPS`, constant |
| Liquidation threshold | 85% | `LIQUIDATION_THRESHOLD_BPS`, constant |
| Liquidation bonus | 5% | `LIQUIDATION_BONUS_BPS`, constant |
| Close factor | 50% of debt per liquidation | `CLOSE_FACTOR_BPS`, constant |
| Borrow rate | flat annual, 5% at deploy | `interestRateBps`, owner-settable, hard-capped at 50% |
| Oracle staleness tolerance | 90 min at deploy | `maxPriceStaleness`, owner-settable within [10 min, 1 day] |
| Minimum position debt | 1,000 USDC at deploy | `minDebt`, owner-settable, capped at 100,000 USDC |

The four risk ratios are `constant`, not storage. Nobody — owner included — can raise the LTV or the
bonus after deployment. Changing them means deploying a new market.

---

## How a position's health is computed

A position is `{ collateral: WETH amount, scaledDebt: index-normalised USDC debt }`.

**1. Debt.** Debt is stored scaled against a global `borrowIndex` (RAY = 1e27), which starts at `RAY` and
only ever increases:

```
debt = ceil(scaledDebt * borrowIndex / RAY)
```

`_accrue()` runs before every state-touching operation and advances the index by simple interest over
the elapsed interval:

```
borrowIndex += borrowIndex * (rateBps * elapsed) / (10_000 * 365 days)
```

So it is simple interest *within* an interval and compounds across intervals, at whatever cadence the
market happens to be touched. The rate model is deliberately not the interesting part here.

Two details that matter:

- When `totalScaledDebt == 0` the index is frozen. With nobody to charge, letting it run forward would
  retroactively tax the next borrower.
- The index must be read *before* `lastAccrualTimestamp` is stamped. Doing it the other way round makes
  the elapsed time compute as zero and silently drops all interest — `test_interestIsRepaidToThePool`
  exists specifically to pin this down.

**2. Collateral value**, expressed in USDC units:

```
collateralValue = collateral * price * DEBT_UNIT / (COLLATERAL_UNIT * PRICE_UNIT)
```

`price` is the validated Chainlink ETH/USD answer. The three `*_UNIT` values are read from
`decimals()` on the two tokens and on the feed at construction — nothing assumes 18 decimals. Concretely
`10 WETH × $2000` evaluates to `20_000e6`, not `20_000e18`; that single factor of `1e12` is the failure
mode this market is most exposed to, so `test_collateralValueUsesDebtTokenDecimals` asserts it directly.

**3. The two thresholds.**

```
borrow / withdraw allowed  while  debt <= collateralValue * 70%
liquidatable               when   debt >  collateralValue * 85%
```

The gap between 70% and 85% is the borrower's buffer against price movement. `healthFactor()` reports
`collateralValue * 85% / debt`, 1e18-scaled: below `1e18` means liquidatable, and a debt-free position
returns `type(uint256).max`.

All rounding resolves toward the protocol: debt rounds **up**, collateral value rounds **down**.

---

## What a liquidator has to do

Call:

```solidity
liquidate(address borrower, uint256 repayAmount, uint256 minSeized)
    returns (uint256 repaid, uint256 seized)
```

Preconditions — have the USDC, and approve the market for at least `repayAmount` first.

1. **Find a position with `debt > collateralValue * 85%`.** `isLiquidatable(borrower)` and
   `healthFactor(borrower)` answer this from offchain. Both read the live oracle, so a position can
   become liquidatable with no transaction touching it at all — only the ETH price moving.
2. **Pick `repayAmount`**, at most 50% of current debt. `type(uint256).max` means "the close-factor
   maximum", which is what a bot normally wants. Exceeding the cap reverts with
   `RepayExceedsCloseFactor`.
3. **Set `minSeized`.** This is a slippage guard. The seizure is priced off the oracle at execution time,
   not at submission time, so a favourable price tick between submit and mine means less WETH than you
   quoted. Pass `0` only if you genuinely do not care.

You pay `repaid` USDC and receive:

```
seized = repaid * 1.05, converted to WETH at the oracle price
```

i.e. WETH worth 105% of what you repaid. The 5% is the whole incentive.

**The underwater case.** If the position is so far gone that `repaid * 1.05` exceeds the collateral that
remains, the contract clamps `seized` to the full remaining collateral and *recomputes `repaid` downward*
so you only pay for what you actually take. You are never forced to overpay. Whatever debt survives that
is bad debt — see below.

**Dust rule.** A partial repayment may not leave a position with `0 < debt < minDebt`, because a position
too small to be worth the gas is a position nobody will ever liquidate. This rule is waived once all
collateral has been seized, since at that point there is nothing left to incentivise anyone anyway.

Liquidation is **not** blocked by the pause switch. Solvency work must never be something an operator can
turn off.

---

## What an operator has to get right

### Before deploying

- **The feed address.** `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` is Chainlink ETH/USD on mainnet:
  8 decimals, 1 hour heartbeat, 0.5% deviation threshold. Wrong feed = the pool is drained on the first
  borrow. The constructor calls `_price()` and reverts the deployment if the feed is silent, misconfigured
  or already stale, which catches a typo at deploy time rather than at exploit time. The addresses are
  compile-time constants in the deploy script rather than env vars for the same reason — they show up in
  code review.
- **`maxPriceStaleness` must exceed the feed heartbeat.** Deploy value is 90 minutes against a 1 hour
  heartbeat. Set it under the heartbeat and the market bricks itself — every borrow, withdraw and
  *liquidation* reverts — on any routine late publish. Set it far above and you are pricing collateral off
  an answer that may be hours out of date. If you ever point this at a different asset, re-derive the
  value from that feed's heartbeat; do not copy 90 minutes across.
- **Owner must be a multisig or timelock.** The deploy script refuses an EOA (`owner.code.length > 0`).
  Ownership is `Ownable2Step`, so a transfer needs the new owner to accept — a fat-fingered address cannot
  strand the market.

### After deploying

- **Fund it.** The market has no public lender side. Borrowers draw against USDC supplied by the owner
  through `fundLiquidity`; `borrow` reverts with `InsufficientLiquidity` until then. Interest accrues to
  the pool and is collected by the owner via `withdrawLiquidity`.
- **Verify the source** on Etherscan (`forge verify-contract`). An unverified lending market is
  indistinguishable from a scam, and nobody can audit what they cannot read.
- **Run liquidation bots from day one.** Liquidation is permissionless but not automatic. If nobody is
  watching, positions fall through 85% into insolvency and the losses land on the owner's capital. This
  is the single most common way a market of this shape loses money — not a contract bug, an empty
  liquidator set. Budget for at least one bot you control rather than assuming the market provides them.

### What the owner can and cannot do

Worth being explicit, since users have to price this trust:

| Can | Cannot |
|---|---|
| Withdraw **idle USDC** (their own capital + interest) | Touch **WETH collateral** — no code path reaches it |
| Raise the borrow rate, up to a 50% APR hard cap | Withdraw USDC that is currently lent out |
| Pause deposits and new borrows | Block repay, withdraw or liquidate |
| Change `minDebt` (≤ 100k) and staleness (10 min – 1 day) | Change LTV, liquidation threshold, bonus or close factor |
| Sweep unrelated tokens sent here by accident | Sweep WETH or USDC (`CannotSweepMarketToken`) |

**On the pause switch.** `Pausable` + `onlyOwner` is a censorship vector and should be treated as one. It
is scoped as narrowly as it can be: it stops `depositCollateral` and `borrow` only. Repay, withdraw and
liquidate stay open while paused, so pausing can stop new risk from entering but can never trap a solvent
borrower's collateral or freeze a liquidation. `test_pauseStopsBorrowingButNotExits` and
`test_liquidationWorksWhilePaused` hold that line. If you want the ability removed entirely, delete
`Pausable` before deploying — it is not load-bearing.

### Known limitations, accepted deliberately

- **Bad debt is not socialised.** After a gap-down that blows through the 5% bonus, a stripped position
  can be left with debt and no collateral. `totalScaledDebt` keeps counting it; there is no write-off
  function. The loss sits against the owner's capital and has to be handled by redeploying. Adding a
  write-off would mean an owner function that erases user debt, which is a bigger hole than the one it
  closes.
- **Single oracle, no fallback.** If Chainlink ETH/USD stops updating past `maxPriceStaleness`, borrowing
  and liquidation both halt until it resumes. That is the safe failure direction — the alternative is
  lending against a price nobody is standing behind. Debt-free borrowers can still withdraw, since
  `withdrawCollateral` skips the oracle entirely when `debt == 0`.
- **Owner-funded liquidity only.** No lender shares, no ERC-4626 vault, so no share-inflation surface.
  `fundLiquidity` is `onlyOwner` precisely because a third party sending funds here would have no claim
  on them.
- **Liquidations are MEV.** Bots will compete and reorder; that is the intended design, not a defect.
  Borrowers approaching 85% should top up through a private RPC so their own transaction is not the
  signal that triggers the liquidation.
- **Not audited.** 32 tests including two fuzz properties cover the decimal math, the accrual path, the
  liquidation math including the underwater clamp, oracle validation and access control. That is not a
  substitute for an audit of a contract that holds other people's collateral.
