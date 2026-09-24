# WETH/USDC Borrow Market — operator notes

Three contracts:

| File | Role |
| --- | --- |
| `src/BorrowMarket.sol` | The market: lender deposits, collateral, borrow, repay, liquidate. |
| `src/ChainlinkOracle.sol` | Immutable wrapper over the Chainlink ETH/USD feed, normalised to 1e18 USD. |
| `script/Deploy.s.sol` | Mainnet deployment with the parameters below. |

Parameters as deployed: max LTV 70%, liquidation threshold 85%, liquidation bonus 5%,
flat 5% APR, minimum debt 1,000 USDC.

---

## 1. How a position's health is computed

Everything is normalised to **1e18-scaled USD** before comparison, so token decimals
(WETH 18, USDC 6) never leak into the ratio math.

```
price            = oracle.collateralPriceUsd()              // USD per 1 WETH, 1e18
collateralValue  = collateralOf[user] * price / 1e18        // 1e18 USD
debt             = debtShares[user] * borrowIndex / 1e18    // USDC units, rounded UP
debtValue        = debt * 1e12                              // 1e18 USD
```

Two distinct checks, deliberately at different levels:

- **Borrow / withdraw check** (`_requireWithinMaxLtv`), enforced on `borrow` and
  `withdrawCollateral`: `debtValue <= collateralValue * 7000 / 10000`.
- **Liquidation check**, enforced in `liquidate`: liquidatable when
  `debtValue > collateralValue * 8500 / 10000`.

The 15-point gap between them is the safety buffer. A borrower who maxes out at 70% is not
liquidatable on the next block; ETH has to fall ~17.6% first. The constructor enforces
`maxLtv < liquidationThreshold`, so this buffer can never be configured away.

The constructor also enforces `threshold * (1 + bonus) < 100%` — i.e.
`8500 * 10500 < 10000 * 10000`. Without that, liquidating a position sitting exactly at the
threshold would already take more collateral than the position holds, manufacturing bad debt
on the very first liquidation.

### Interest

Debt is share-based against a single global `borrowIndex` (starts at 1e18, only ever grows).
`accrueInterest()` runs at the top of every state-changing function, so no operation ever
reads a stale debt:

```
growth       = ratePerYear * elapsed / 365 days
borrowIndex += borrowIndex * growth / 1e18
```

Simple (non-compounding) interest, per the brief. The index does **not** advance while
`totalDebtShares == 0` — otherwise the first borrower after an idle period would inherit
interest nobody owed. Interest flows to lenders implicitly: `totalAssets() = usdcCash +
totalBorrows`, and lender shares are priced against `totalAssets()`. There is no reserve
factor; 100% of interest goes to lenders.

### Rounding

Every rounding decision is made against the actor and in favour of the pool:

- debt (`debtOf`, `totalBorrows`): **up**
- shares minted on `borrow`: **up** (you owe at least what you took)
- shares burned on partial `repay`: **down** (credited no more than you paid for)
- lender shares minted on `deposit`: **down**; assets paid on `withdraw`: **down**
- collateral seized in `liquidate`: **down**

A full repayment (`repay(type(uint256).max)`) burns *all* of the position's shares rather than
a computed amount, so no unpayable one-wei dust debt can be left behind.

`Math.mulDiv` (512-bit intermediate) is used for every value computation, so intermediate
products cannot overflow.

### Anti-manipulation details worth knowing

- **Cash is tracked in storage** (`usdcCash`, `totalCollateral`), never read from
  `balanceOf(address(this))`. Sending tokens to the market cannot move the lender share price,
  fake liquidity for `borrow`, or affect any health check. `skim()` exists to recover such
  donations and is bounded by that same internal accounting, so it can never touch lender cash
  or borrower collateral.
- **Virtual shares/assets** (`1e6` / `1`) on the lender side pin the initial share price and
  make the classic first-depositor share-inflation attack unprofitable.
- **`minDebt` of 1,000 USDC.** Positions must be either closed or above the floor — a partial
  repayment that would leave less reverts. This guarantees a liquidation is always worth more
  than its gas, so unhealthy dust positions can't accumulate as bad debt.

---

## 2. What a liquidator has to do

```solidity
market.liquidate(borrower, repayAmount, minCollateralOut)
    returns (uint256 repaid, uint256 seized);
```

Preconditions:

1. `market.isLiquidatable(borrower) == true` — checked on-chain against pre-repayment state.
2. The liquidator holds `repayAmount` USDC and has approved the market for it.
3. `repayAmount` is either `type(uint256).max` (full debt) or a partial amount that leaves the
   position at or above `minDebt`. A partial amount that would leave dust reverts — liquidate
   in full instead.

What the contract does, in order: accrue interest → read the price → verify unhealthy → burn
debt shares and credit the USDC → compute and transfer the seized collateral.

Seizure amount:

```
seized = repaid * 1e12 * (10000 + 500) / 10000 * 1e18 / price
```

i.e. collateral worth exactly the USDC repaid, marked up 5%. Rounded down; dust stays with the
borrower.

Two things a liquidator must handle:

- **`minCollateralOut` is your only slippage protection.** The price is read at execution time,
  not at simulation time. Set it, don't pass `0` — and remember that USDC is credited before the
  seizure is computed, so a bad price read means you have paid and received less than you
  expected.
- **Seizure is capped at the position's collateral.** For a position deep enough underwater that
  it cannot pay the bonus, the cap binds and you receive less than `repaid` is worth. The call
  still succeeds (this is how bad debt gets cleaned up), so `minCollateralOut` is what stops you
  from repaying $14,000 for $8,000 of ETH by accident.

There is no close factor: a single call may repay up to 100% of the debt. That is intentional —
it lets one transaction fully clear a position that gapped through the threshold.

Practical liquidation setup: watch `Borrow` / `Repay` / `Liquidate` / `AccrueInterest` events to
maintain the position set, poll `isLiquidatable` (or recompute off-chain from the same feed), and
route the seized WETH through a DEX in the same transaction. The 5% bonus has to cover gas plus
the swap.

---

## 3. What an operator has to get right on mainnet

### Before deploying

- **`OWNER` must be a timelocked multisig**, not an EOA and not a deploy key. The owner can
  repoint the oracle, which is equivalent to being able to drain the market (see below). The
  deploy script reads `OWNER` from the environment and refuses the zero address, but it cannot
  check that the address is actually a timelock — verify that by hand.
- **Ownership transfer is two-step** (`Ownable2Step`): the new owner must call `acceptOwnership()`.
  Don't leave a pending transfer hanging, and don't transfer to an address that cannot call.
- **Verify the three mainnet addresses** hardcoded in `script/Deploy.s.sol`: WETH
  `0xC02a…6Cc2`, USDC `0xA0b8…eB48`, Chainlink ETH/USD **proxy** `0x5f4e…8419`. Use the proxy,
  not the underlying aggregator, so Chainlink's own feed upgrades are picked up.
- **`MAX_STALENESS` must match the feed's heartbeat.** ETH/USD on mainnet is 3600s heartbeat /
  0.5% deviation; the script allows 1h15m, one missed heartbeat plus slack. Re-check the
  heartbeat on the Chainlink docs at deploy time — it has changed before. Too generous and you
  are lending against yesterday's price; too tight and the market freezes routinely.
- **`MIN_PRICE_USD` / `MAX_PRICE_USD` are a circuit breaker, not decoration.** They are immutable
  and exist so a malfunctioning feed pinned at an extreme cannot be acted on. Set them wide
  enough to survive years of real volatility (the script uses $100–$100,000) and narrow enough to
  catch a broken feed. Widening them later means deploying a new oracle.
- **Seed lender liquidity before announcing.** The market starts with zero USDC; `borrow` reverts
  until lenders `deposit`.

### Live operations

- **Oracle replacement is the critical path.** `setOracle` is the one action that can steal every
  dollar in the market: an oracle reporting 1000x lets an attacker borrow the pool against
  pennies of WETH, and one reporting near-zero makes every position instantly liquidatable at a
  5% discount. It sanity-checks that the new oracle returns non-zero and the `ChainlinkOracle`
  itself is immutable (no setters), but the only real control is process: timelock, published
  diff, verified source, independent price comparison before executing.
- **Rate changes accrue first.** `setRatePerYear` calls `accrueInterest()` before writing, so a
  change only applies going forward and can never be applied retroactively to existing debt.
  The rate is hard-capped at 100% APR (`MAX_RATE_PER_YEAR`); the cap is not an owner setting.
- **`setBorrowingPaused` is one-sided by design.** It stops new borrows and new lender deposits.
  `repay`, `withdrawCollateral` and `liquidate` are *never* pausable — users can always get out
  and the market can always be defended. Don't expect pausing to stop an in-progress exploit
  that only uses those paths.
- **A frozen feed freezes liquidations.** When the oracle reverts (stale, out of band), `borrow`,
  `withdrawCollateral` against debt, and `liquidate` all revert. That is the correct failure
  mode — never act on a bad price — but it means a long Chainlink outage during a crash leaves
  positions unliquidatable and can produce bad debt. Monitor feed freshness as a first-class
  alert, not just contract state.
- **Utilisation can reach 100%.** Lenders withdraw against idle cash only; at full utilisation
  they wait for repayments. With a flat rate there is no utilisation curve pushing the market
  back toward liquidity, so watch utilisation and be ready to raise the rate manually. This is
  the main cost of "keep the rate model simple".

### Risks that are inherent, not bugs

- **USDC is treated as exactly $1.** No USDC price feed is read. A sustained USDC depeg makes
  every reported health number wrong in the borrower's favour. Adding a USDC/USD feed is the fix
  if that risk matters to you.
- **USDC is an upgradeable, freezable, blacklistable token.** Circle can blacklist this contract
  (repayments and withdrawals stop), blacklist a borrower (they cannot repay and will be
  liquidated), or upgrade the implementation. Nothing on-chain here can mitigate that.
- **A single Chainlink feed is a single point of failure.** There is no TWAP fallback and no
  secondary feed. Latency between the feed and the real market is also what makes oracle-lag
  arbitrage possible against the pool; the 15-point LTV buffer absorbs ordinary movement, not a
  flash crash.
- **Bad debt is socialised to lenders.** If a position gaps below 100% collateralisation faster
  than liquidators can act, the shortfall shows up as lender shares that cannot be redeemed in
  full. There is no insurance fund.
- **No flash-loan or same-block guard is needed.** Prices come from Chainlink rather than a DEX
  spot pool, all accounting uses internal storage rather than balances, and every entry point is
  `nonReentrant` with token transfers last (CEI). A flash loan changes nothing a large holder
  could not already do.

---

## Build and test

```bash
forge build
forge test
```

26 tests cover LTV limits, interest accrual, repay/withdraw flows, liquidation (including the
underwater cap and the slippage guard), every oracle failure mode, donation resistance,
`skim` bounds, access control, and a solvency fuzz invariant.
