# WETH/USDC borrowing market — operator notes

Two contracts:

| Contract | Role |
| --- | --- |
| `src/LendingPool.sol` | The market. Holds WETH collateral, lends USDC, handles liquidation. |
| `src/oracle/ChainlinkOracle.sol` | Wraps the Chainlink ETH/USD feed and normalises it to an 18-decimal USD price. Validates every read. |

`script/Deploy.s.sol` deploys both with mainnet addresses and the parameters below.
`forge build` compiles; `forge test` runs 15 tests covering the flows described here.

Parameters as deployed: **LTV 70%**, **liquidation threshold 85%**, **liquidation bonus 5%**,
**close factor 50%**, **borrow rate 5% APR flat**, **minimum borrow 100 USDC**.

---

## 1. How a position's health is computed

A position is two numbers: `collateral` (WETH, 18 decimals) and `debtShares`.

**Debt.** Interest is tracked with a single global `borrowIndex` (27 decimals, starts at 1e27 and
only ever increases). A borrower's debt is `debtShares * borrowIndex / 1e27`, rounded **up**.
`accrueInterest()` advances the index by `rate * elapsed / 365 days` and runs at the top of every
state-changing entrypoint, so no path ever reads a stale index. Interest is simple between
accruals and compounds each time accrual is called — with the market in use that is effectively
continuous compounding, and it is never *more* than true continuous compounding, so it errs in
the borrower's favour. The index is deliberately **not** advanced while total debt is zero;
otherwise the first borrower after an idle period would inherit interest for time they did not
borrow.

**Collateral value**, denominated in USDC units:

```
value = collateral * price / 1e18       (18-dec USD)
value = value * 1e6 / 1e18              (rescaled to USDC's 6 decimals)
```

where `price` is USD per whole WETH at 18 decimals. Rounded **down**.

**The two ratios.** Both compare debt against collateral value; they differ only in the bound:

- **Open LTV — 70%.** Checked after `borrow` and after `withdrawCollateral`. This is the limit a
  user can put themselves at through their own action: `debt <= value * 70%`.
- **Liquidation threshold — 85%.** Checked in `liquidate`. At `debt * 10000 >= value * 8500` the
  position is open to anyone.

The gap between the two is the point: a fresh loan at the maximum is not instantly liquidatable,
it has to lose ~18% of its collateral value first. `setRiskParams` enforces `ltv <
liquidationThreshold` so this gap can never be configured away.

A position with **no debt** is never priced at all — a debt-free user can withdraw their WETH even
if the oracle is down. Anything else would let a dead price feed hold user funds hostage.

**Rounding.** Every conversion rounds against the user and toward the protocol: debt owed rounds
up, collateral value rounds down, seized collateral rounds down. The residue is a few wei and
always lands on the safe side.

---

## 2. What a liquidator has to do

```solidity
pool.liquidate(account, repayAmount, minCollateralOut, recipient)
  returns (uint256 repaid, uint256 seized)
```

1. **Find a position at or above 85%.** `isLiquidatable(account)` is the on-chain check;
   `positionOf` and `collateralValueOf` give the raw numbers.
2. **Approve USDC** to the pool for at least `repayAmount`. The pool pulls it with
   `transferFrom` — no pre-funding, no flash-loan callback, no hooks.
3. **Choose `repayAmount`.** Capped at the **close factor, 50% of current debt**, so one call
   cannot wind down a whole position while it is still solvent. Passing `type(uint256).max` asks
   for the current maximum, which is the right call for a bot — the cap moves with accrued
   interest between simulation and inclusion, and a hardcoded number that was exactly 50% at
   simulation time reverts on-chain. The cap is lifted to 100% once `debt > collateralValue`:
   at that point the borrower has no equity left to protect and clearing bad debt fast matters
   more.
4. **Set `minCollateralOut`.** Slippage guard. The seize amount is computed from the oracle price
   at execution time, so a price move between simulation and inclusion changes what you get.
   Leaving this at 0 means accepting whatever the market gives you.

**What you receive:**

```
seized = (repayAmount converted to WETH at the oracle price) * 1.05
```

Example, from the test suite: ETH at $1,600, repay 1,000 USDC → 0.625 WETH of value → **0.65625
WETH** seized. The 5% is your margin, and it has to cover gas and the price risk of holding the
WETH until you sell it.

**When collateral runs out.** If the bonus would push `seized` past the position's actual
collateral, the pool caps the seize at the full balance and **scales `repayAmount` back down** so
you are only charged for what you receive:

```
repayAmount = collateralValue * 10000 / 10500
```

You never overpay for a partially-collateralised position. The debt left over after that is bad
debt — the position is at zero collateral and no further liquidation is possible. It is the
operator's loss; `writeOffBadDebt` clears it from the books.

Liquidation stays available while the pool is paused. Pausing stops new risk, it does not strand
the book.

---

## 3. What an operator has to get right on mainnet

### Ownership
The owner can set the oracle, the risk parameters and the rate, and can move idle liquidity.
**That address must be a multisig or timelock, never an EOA.** `POOL_OWNER` is read from the
environment by the deploy script. The contracts use `Ownable2Step`, so a fat-fingered transfer
can't brick the market — the new owner has to accept.

### The oracle is the whole attack surface
Every borrow, withdrawal and liquidation prices collateral through `ChainlinkOracle`. Get this
wrong and the market is drained. It enforces four things, and each needs a deliberate setting:

- **`maxAge`.** Mainnet ETH/USD is a 1-hour heartbeat / 0.5% deviation feed; the script uses
  1h15m. Too tight and normal heartbeat jitter freezes the market; too loose and you lend against
  a price from hours ago. If you point this at a different feed, **re-check its heartbeat** —
  they are not uniform.
- **`minPrice` / `maxPrice`.** Chainlink aggregators clamp at their own `minAnswer`/`maxAnswer`.
  During a violent move the feed keeps reporting the bound as though it were a real price — this
  is exactly how Venus lost money on LUNA. These bounds turn that into a revert. Set them wide
  enough not to trip in normal markets, tight enough to catch a saturated feed, and revisit them
  as ETH drifts over the years.
- **Non-positive answers** revert.
- **Decimals** are read from the feed at construction and fixed.

A failing oracle read reverts, which freezes borrowing, collateralised withdrawals and
liquidations. That is the intended failure mode: a frozen market is recoverable, a mispriced one
is not. Note the corollary — **while the oracle is down, liquidations are down too**, so a long
outage during a selloff produces bad debt. Alert on staleness rather than discovering it during a
crash.

There is **no TWAP and no second source**. For real size, add a fallback feed and a
deviation-vs-Uniswap-TWAP circuit breaker before scaling deposits up.

### The lending side has no depositor accounting
This is the significant scope decision, and it must be understood before deploying. USDC
liquidity comes from `fund()`; interest accrues to the pool's balance; only the **owner** can pull
liquidity out via `withdrawLiquidity`. There are no supplier shares and no supplier claim.

`fund()` is permissionless, so **anyone can send USDC in and cannot get it back.** If third
parties are ever meant to supply this market, do not ship it as is — it needs ERC4626-style share
accounting, a utilisation-based rate model, and a reserve factor. As written, this is an
operator-funded credit facility.

`withdrawLiquidity` can only move USDC that is not lent out, so it cannot touch outstanding
loans — but an owner draining idle liquidity blocks new borrows. Leave a buffer.

### USDC-specific behaviour
- **6 decimals**, not 18. All USDC-denominated inputs (`minBorrow`, `repayAmount`, the price
  bounds' counterpart values) are in 1e6. Scaling is read from `decimals()` at construction, so
  the contract is correct for the pair — the risk is human, in the parameters you type.
- **USDC has a blacklist.** A blacklisted borrower cannot repay and a blacklisted liquidator
  cannot liquidate. A blacklisted *pool* would be fully frozen. Nothing on-chain can fix this;
  know it is a live dependency.
- **USDC is an upgradeable proxy.** Circle can change its behaviour under you.
- Neither WETH nor USDC is fee-on-transfer or rebasing today, and the accounting assumes that. Do
  not reuse this contract for a token that is either.

### Parameters to set deliberately
- **`minBorrow` (100 USDC).** Positions must be large enough that liquidating them beats gas. Too
  low and you accumulate dust positions nobody will ever clear. Revisit if gas prices move.
- **Borrow rate.** Flat 5% APR, capped at 100% in the setter. It is not a rate model — it does not
  respond to utilisation, so at full utilisation there is no market force refilling liquidity.
  Fine for an operator-funded facility, inadequate for an open market.
- **Bonus vs. threshold.** `setRiskParams` enforces `threshold * (1 + bonus) <= 100%`, so a
  position liquidated right at the threshold cannot be pushed underwater by the bonus itself. At
  85% × 1.05 = 89.25% there is real headroom. If you raise the threshold, that invariant binds.

### Before mainnet
- Fork-test the deploy script against real WETH, USDC and the live feed, not just the mocks here.
- Get an audit. This has 15 tests and no fuzzing, invariant testing, or formal verification of the
  accounting.
- Have a runbook for: oracle stale, bad debt appears, USDC blacklist event, pause/unpause.
- Cap initial liquidity to a size you are willing to lose outright.

### Known limitations, stated plainly
- Single collateral, single debt asset, no isolation modes.
- No reserve factor; all interest is operator revenue.
- No supplier shares (see above).
- Simple interest between accruals, not continuously compounded.
- Bad debt is socialised to the operator and cleared manually.
- Self-liquidation is permitted. It is not profitable beyond the bonus a third party would take
  anyway, so it is not treated as an attack.
