# WETH/USDC borrowing market — operating notes

Two contracts get deployed:

| Contract | Role |
| --- | --- |
| `src/ChainlinkPairOracle.sol` | Prices WETH in USDC from two Chainlink USD feeds. Immutable, no owner. |
| `src/LendingPool.sol` | The market. ERC-4626 vault over USDC for lenders, collateral + debt ledger for borrowers. |

`script/Deploy.s.sol` wires them for mainnet with 70% LTV, 85% liquidation threshold, 5% bonus,
50% close factor, 5% flat APR, 10% reserve factor.

---

## 1. How a position's health is computed

### Units

Three different scales meet in this contract, so every quantity is normalized before comparison:

- collateral is held in WETH's own decimals (18),
- debt, collateral **value**, and every threshold comparison are in USDC's decimals (6),
- the oracle reports the price of **one whole WETH in whole USDC, scaled by 1e18** (ETH at $3000
  with USDC at $1.00 → `3000e18`).

`PRICE_SCALE` bridges them and is derived from the two tokens' real `decimals()` at construction,
not hardcoded:

```
PRICE_SCALE   = 10 ** (collateralDecimals + 18 - debtDecimals)   // WETH/USDC => 1e30
collateralValue = collateralAmount * price / PRICE_SCALE          // in USDC units
```

Sanity check: `1e18 wei * 3000e18 / 1e30 = 3000e6` = 3,000 USDC. ✅

### Debt

Debt is stored as a *principal* scaled by a global `borrowIndex` (starts at `1e18`), so interest
reaches every borrower through one index update instead of a loop:

```
debtOf(user) = ceil(debtPrincipal[user] * borrowIndex / 1e18)
```

`accrueInterest()` runs at the top of every state-changing entry point and advances the index by
simple interest over the elapsed time:

```
factor       = ratePerYearWad * dt / 365 days
borrowIndex += borrowIndex * factor / 1e18
totalBorrows += totalBorrows * factor / 1e18
```

Because this is applied repeatedly rather than once, the realized rate compounds per accrual step
and sits slightly above the nominal flat rate — the same behaviour as Compound's index. The rate
model is deliberately a single constant; there is no utilization curve.

All rounding is directional and always in the protocol's favour: debt reads round **up**, new
borrow principal rounds **up**, principal reduction on repay rounds **down**. Dust can never
accumulate into free debt relief.

### The two thresholds

There are two distinct limits, and they are not interchangeable:

```
borrowLimit      = collateralValue * 7000 / 10000   (70%)  — checked on borrow AND on collateral withdrawal
liquidationLimit = collateralValue * 8500 / 10000   (85%)  — checked on liquidate
```

- **Borrowing or withdrawing collateral** must leave `debt <= borrowLimit`. Withdrawal is
  intentionally held to the 70% LTV, not the 85% threshold — otherwise a borrower could withdraw
  right up to the liquidation line and be liquidatable in the same block.
- **Liquidation** requires `debt > liquidationLimit`. The gap between 70% and 85% is the buffer
  that absorbs price moves and accrued interest before anyone can be liquidated.

`isLiquidatable(user)`, `borrowLimitOf(user)` and `liquidationLimitOf(user)` expose this, and all
of them include interest pending since the last accrual, so an off-chain bot reading a view gets
the same answer the transaction would compute.

> Note: the plain `totalBorrows` / `totalReserves` / `borrowIndex` storage getters are only correct
> as of `lastAccrualTime`. Use `totalBorrowsCurrent()`, `totalReservesCurrent()` and
> `borrowIndexCurrent()` for live values.

---

## 2. What a liquidator has to do

```solidity
pool.liquidate(account, repayAmount, minSeized, to)
    returns (uint256 repaid, uint256 seized);
```

Preconditions the caller must satisfy:

1. **The position is actually unhealthy.** `debt > collateralValue * 85%`. Otherwise it reverts
   with `PositionHealthy()`. Check `isLiquidatable(account)` first.
2. **Approve USDC.** The pool pulls `repayAmount` from `msg.sender` via `transferFrom`.
3. **Stay inside the close factor.** `repayAmount <= 50% of the position's current debt`, or it
   reverts with `RepayExceedsCloseFactor`. Half a position at a time keeps a single price wick
   from wiping out a borrower who would have recovered.
4. **Set `minSeized`.** This is the caller's slippage guard. Between simulating and landing, the
   price can move or someone else can partially liquidate the same position, and both shrink the
   payout. `minSeized = 0` means "take whatever I get".

What comes back:

```
seized = (repaid * PRICE_SCALE / price) * 10500 / 10000
```

— the WETH worth exactly what was repaid, plus the 5% bonus, sent to `to`. Repaying 10,000 USDC
with ETH at $2,400 seizes `10000/2400 * 1.05 = 4.375 WETH`.

Two behaviours worth knowing:

- **Seizure is capped at the borrower's remaining collateral.** If a position is so far underwater
  that collateral cannot cover repayment plus bonus, the liquidator receives all of it and the
  leftover debt stays on the books as bad debt. At that point liquidation is unprofitable and
  will stop happening — see the operator section.
- **Liquidation stays available while the pool is paused.** Pausing blocks new deposits and new
  borrows only. Repay, collateral withdrawal and liquidation are never pausable, so a pause can
  neither trap a borrower's collateral nor stop the market from de-risking.

---

## 3. Operator checklist for mainnet

### Ownership

- `POOL_OWNER` **must be a multisig or timelock, never the deploying EOA.** The owner can
  repoint the oracle, move risk parameters and withdraw reserves. Oracle replacement in particular
  is equivalent to being able to mark every position however you like, so it belongs behind a
  timelock long enough for users to exit.
- The pool uses `Ownable2Step`: the new owner must call `acceptOwnership()`. Confirm the handover
  completed — a one-step transfer to a wrong address is unrecoverable.
- Parameter bounds are enforced *in the contract*, not just in the deploy script: LTV must be
  below the threshold, the threshold below 100%, bonus ≤ 20%, reserve factor ≤ 50%, APR ≤ 100%,
  and `threshold * (1 + bonus) <= 100%` so a liquidation at the threshold cannot by itself push a
  position underwater. A compromised owner still cannot set a nonsensical configuration.

### Oracle — the part most likely to go wrong

- **Never point this at a DEX spot price.** Uniswap `slot0`, pool reserves, or any current quote
  can be moved with flash-borrowed capital and restored inside one transaction, which turns
  borrowing and liquidation into free money. Pool depth does not fix this. The shipped oracle
  reads Chainlink push feeds only.
- **Per-feed max age.** Mainnet ETH/USD has a ~1h heartbeat, USDC/USD ~24h. A single global
  timeout either rejects perfectly fresh USDC rounds or silently accepts an ETH price that is 20
  hours stale. Set each feed's max age from *that feed's* published heartbeat plus margin, and
  re-check them after any Chainlink feed migration.
- **The stablecoin leg is priced, not assumed.** USDC is read from its own feed rather than
  hardcoded to $1.00. A depeg with USDC pinned at 1.0 would misprice every position in the market
  at exactly the moment it matters.
- **Verify the sanity bands against the live aggregator.** `ETH_USD_MIN/MAX` and
  `USDC_USD_MIN/MAX` in the deploy script are placeholders. Chainlink aggregators clamp their
  answer to the underlying `minAnswer`/`maxAnswer`; if the true price exits that band the feed
  keeps publishing the clamped bound as a fresh, valid-looking round. Read the current
  aggregator's `minAnswer`/`maxAnswer` on-chain and set these strictly inside them so a clamped
  round reverts instead of being consumed. Re-verify whenever the aggregator behind the proxy is
  upgraded.
- The oracle is immutable and ownerless by design: there is no setter to compromise. Replacing it
  means deploying a new one and having the pool owner call `setOracle`.

### Liquidity and bad debt

- **Seed the pool before advertising it.** Deposit USDC and take the first shares yourself. The
  vault uses a 6-decimal virtual-share offset against the classic first-depositor donation attack,
  but a seeded pool removes the question entirely.
- **Lender withdrawals are capped by idle cash** (`maxWithdraw` / `maxRedeem` reflect this). With
  a flat rate there is no utilization curve pulling the market back toward liquidity, so at 100%
  utilization lenders are simply stuck until someone repays. If that matters, add a utilization
  based rate or a supply cap before launch.
- **Run liquidation bots from day one and monitor them.** This market has no backstop: if nobody
  liquidates, positions go underwater and the loss lands on lenders. Alert on positions above ~80%
  and on any position where seizure got capped at available collateral.
- **There is no bad-debt socialization mechanism.** Bad debt sits in `totalBorrows`, so
  `totalAssets` keeps counting debt that will never be repaid and share price is overstated. The
  last lenders out absorb it. If the market is going to hold size, add explicit write-down before
  launch rather than after.

### Tokens and integration

- WETH and USDC are both well-behaved today, but deposits are credited from the **measured balance
  delta**, not the requested amount, so a fee-on-transfer or otherwise lossy token can never credit
  more than the pool actually holds. USDC is an upgradeable proxy — a future implementation adding
  a transfer fee would not silently corrupt accounting here.
- USDC is also **pausable and has a blocklist**. If USDC pauses, repayment and liquidation stop
  working while interest keeps accruing. This is an accepted risk of the pair; make sure whoever
  operates it knows.
- Collateral accounting is tracked in `totalCollateral`, so WETH sent directly to the contract is
  never credited to anyone. `sweep` can recover that surplus but cannot touch collateral backing
  positions, and refuses to touch the USDC asset at all.
- All value-moving entry points are `nonReentrant` and follow checks-effects-interactions.

### Before you broadcast

- [ ] `forge build` and `forge test` clean.
- [ ] Run against a pinned mainnet fork with the real WETH, USDC and Chainlink feeds — the unit
      tests here use mocks and prove the math, not the integrations.
- [ ] Fuzz and invariant runs on the accounting: total debt equals the sum of positions, the pool
      never pays out more collateral than it holds.
- [ ] Static analysis (Slither) clean, or every high/medium documented as a false positive.
- [ ] Verify deployed bytecode on Etherscan and confirm the constructor arguments — especially the
      feed addresses, max ages and sanity bands.
- [ ] Confirm `owner()` is the multisig/timelock and that `acceptOwnership()` has been called.
- [ ] Deposit a small amount and run one borrow → accrue → repay → withdraw cycle, plus one real
      liquidation, before opening it up.

### Known limitations (deliberate, given the brief)

- Flat interest rate with no utilization curve.
- Single collateral/debt pair, no isolation or caps.
- No bad-debt write-down.
- Non-upgradeable: fixing anything means deploying a new pool and migrating.
