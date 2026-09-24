# WETH/USDC borrowing market — operator notes

Three contracts:

| File | Role |
| --- | --- |
| `src/LendingPool.sol` | The market. Holds WETH collateral, lends USDC, accrues interest, liquidates. |
| `src/ChainlinkPriceOracle.sol` | One instance per Chainlink USD feed. Normalises to 18 decimals and refuses unusable answers. |
| `script/Deploy.s.sol` | Mainnet deployment with the parameters below. |

Liquidity on the USDC side is supplied by the operator (`supplyLiquidity` / `withdrawLiquidity`),
not by third-party lenders. There is no lender share token, so there is no vault-inflation or
first-depositor surface to get wrong. Interest accrues into the pool's USDC balance.

---

## 1. How a position's health is computed

Everything is compared in **one unit: USD with 18 decimals**. Token amounts (18-dec WETH, 6-dec
USDC) are never compared to each other directly, and neither is a raw oracle answer.

```
collateralValue = collateralWeth * ethUsdPrice / 1e18      (rounded down)
debtValue       = debtUsdc       * usdcUsdPrice / 1e6      (rounded up)
```

Both prices come from `ChainlinkPriceOracle.price()`, scaled to 18 decimals. **USDC is priced from
its own USD feed, not assumed to be $1** — a depeg changes the real value of the debt, and the
market should see it.

Debt itself is stored as index-normalised shares, not a USDC amount:

```
borrowIndex starts at 1e27 and grows: index += index * rate * elapsed / (365d * 1e18)
debt(account) = debtShares * borrowIndex / 1e27          (rounded up)
```

`accrueInterest()` runs at the top of every state-changing entry point, so health is always
evaluated against interest-inclusive debt. The flat 5%/year is simple interest per elapsed window
applied to a running index, so it compounds at whatever cadence the pool is touched. That is
deliberate — the rate model is not the point here.

Two thresholds, both on `debtValue / collateralValue`:

- **≤ 70% (`maxLtvBps`)** — enforced *after* the state change on `borrow` and `withdrawCollateral`.
  If a position is already above 70% (from price moves or interest), it simply cannot borrow more
  or pull collateral; nothing forces it closed.
- **> 85% (`liquidationThresholdBps`)** — liquidatable. Strictly greater: exactly 85% is not.

The gap between the two is the borrower's buffer, and it is what pays the liquidation bonus. The
constructor enforces `maxLtv < threshold` and `threshold * (1 + bonus) ≤ 100%`, so a liquidation
triggered right at the threshold can never seize more value than the position holds.

Every rounding decision goes the pool's way: debt rounds up, debt value rounds up, collateral value
and seized collateral round down, repayments burn shares rounded down.

Views for off-chain use: `positionOf`, `debtOf`, `accountValues`, `isLiquidatable`,
`availableToBorrow`. They simulate accrual, so they agree with what a transaction in the same block
would see.

`totalCollateral` is tracked in storage and positions are credited from the **measured balance
delta** of the transfer, so WETH sent directly to the pool is inert — it cannot rescue an unhealthy
position or be withdrawn by anyone.

## 2. What a liquidator has to do

```solidity
pool.liquidate(account, repayAmount, minSeized, to)
  returns (uint256 repaid, uint256 seized)
```

1. Approve the pool for USDC. The pool pulls `repaid` from `msg.sender`.
2. Call with the target, the USDC you are willing to repay (`type(uint256).max` = the maximum the
   pool will accept), a `minSeized` floor, and where the WETH should go.

What the pool does:

- Reverts with `PositionHealthy` unless `debtValue > 85%` of collateral value.
- Caps the repayment at the **close factor (50% of debt)** while the position is still solvent
  (`collateralValue > debtValue`). Once it is underwater the cap is lifted so the debt can actually
  be cleared rather than being whittled down 50% at a time.
- Seizes `repaidValue * 1.05 / ethPrice` in WETH, rounded down.
- If that exceeds the collateral left, it hands over **all** remaining collateral and **scales the
  repayment down** to what that collateral is worth net of the bonus. A liquidator is never charged
  for collateral that is not there.
- `minSeized` is real slippage protection: the seize amount depends on the oracle price at
  inclusion time, which is not the price you simulated against.

Notes for whoever runs the bot:

- Both oracles must be fresh and inside their bounds or the call reverts — during exactly the
  volatility that makes liquidations profitable. Budget for the feed, not just the gas.
- `minDebt` (100 USDC) keeps positions above dust so partial liquidations stay worth the gas, and
  `repay` refuses to leave a sub-`minDebt` remainder.
- Liquidation is **not** blocked while the market is paused. Neither is `repay` or
  `withdrawCollateral` — pause only stops `depositCollateral` and `borrow`, so the operator cannot
  trap a borrower or shut out a liquidator.
- If collateral hits zero with debt remaining, that debt is bad debt. It stays on the position, it
  is not socialised, and it is a loss to the operator's USDC. Nothing in the contract clears it.

## 3. What the operator has to get right on mainnet

**Ownership.** `owner` must be a multisig or timelock, never an EOA. The owner can `pause`,
`unpause` and `withdrawLiquidity`. `withdrawLiquidity` only ever moves USDC — collateral is
unreachable from every privileged path — so the worst an owner compromise does is drain the idle
lending capital and stop new borrows. It cannot seize a position. The contract uses `Ownable2Step`;
finish the handover (`acceptOwnership`) before funding.

**Oracle configuration is the whole ballgame.** The pool has no DEX read anywhere; all pricing is
push-feed. Per feed, verify before deploying:

- Correct mainnet aggregator *proxy* (not the underlying aggregator):
  ETH/USD `0x5f4e...8419`, USDC/USD `0x8fFf...18f6`.
- `maxAge` derived from **that feed's** published heartbeat plus jitter margin — ETH/USD is 3600s,
  USDC/USD is 86400s. Do not reuse one number for both. Re-check the heartbeats at deploy time;
  Chainlink changes them.
- `minPrice` / `maxPrice` bounds. These matter most on USDC/USD, whose day-long heartbeat makes the
  staleness check weak, and they also catch an aggregator clamping at its own min/maxAnswer during a
  crash — a clamped answer is a lie, and the adapter reverts rather than pricing collateral off it.
  Set them wide enough not to fire in normal markets and tight enough to be meaningful.
- Mainnet L1 has no sequencer-uptime feed; if this is ever ported to an L2, add that check or the
  whole market misprices on the first sequencer outage.

**Parameters are immutable.** LTV, threshold, bonus, close factor, rate and `minDebt` are set in the
constructor and cannot be changed. Changing any of them means deploying a new pool and migrating.
That is the trade for having no parameter-update key; decide it is what you want before deploying.

**Tokens.** Configured for canonical WETH (`0xC02a...6Cc2`) and USDC (`0xA0b8...eB48`). The pool
rejects any transfer whose balance delta does not match the requested amount, so a fee-on-transfer
or rebasing token cannot silently corrupt accounting — but do not point this pool at one. Note USDC
is an upgradeable, pausable, blocklistable token: if the pool address is ever blocklisted, repays
and liquidations stop and positions cannot be unwound. That is an accepted, unavoidable dependency.

**Liquidity and bad debt.** Seed USDC with `supplyLiquidity` before announcing. Borrowing simply
reverts (`InsufficientLiquidity`) when the pool runs dry — withdrawals and liquidations are
unaffected. A gap-down through the 85% threshold faster than liquidators can act leaves bad debt
that the operator eats; size the position cap (via `minDebt` and how much USDC you fund) against
that risk.

**Before broadcasting.** Run `forge test` (18 tests: LTV bounds, accrual, liquidation math including
the underwater cap, oracle staleness/depeg/negative-answer rejection, donation inertness,
fee-on-transfer rejection, access control, and a fuzz invariant that seized value never exceeds
repaid value plus bonus). Then run Slither and clear every high/medium, add fork tests pinned
against the real feeds and tokens, verify the deployed bytecode on Etherscan, and confirm ownership
sits with the multisig before the first deposit.

## Known limits, stated plainly

- No lender side. Operator-funded only.
- Interest compounds on interaction cadence, not continuously.
- Bad debt is never socialised or written off; it sits on the position forever.
- Single collateral, single debt asset, no configurability post-deploy.
- No flash-loan-style callback in `liquidate`; liquidators need their own USDC or their own flash
  loan wrapper.
