# WETH/USDC borrowing market — operator notes

`src/WethUsdcMarket.sol` is the only contract to deploy. It is both:

- an **ERC-4626 vault** over USDC — lenders `deposit`/`mint` and hold `mUSDC` shares whose
  value grows as borrower interest accrues; and
- a **borrowing market** — borrowers lock WETH with `depositCollateral` and draw USDC with
  `borrow`, then `repay` and `withdrawCollateral` at will while healthy.

`script/Deploy.s.sol` wires it to mainnet USDC, WETH and the Chainlink ETH/USD feed.

## How a position's health is computed

Everything USD-denominated is carried in **USDC's decimals (6)**. Collateral is in WETH's
decimals (18). The Chainlink ETH/USD answer has 8 decimals. The constructor reads all three
at deploy time and derives one conversion constant:

```
PRICE_SCALE   = 10 ** (collateralDecimals + feedDecimals - debtDecimals)   // 1e20 on mainnet
collateralValue(weth) = weth * price / PRICE_SCALE                          // -> 6-dec USD
collateralForDebt(usd) = usd * PRICE_SCALE / price                          // -> WETH
```

The price read (`collateralPrice`) reverts unless the answer is strictly positive, has a
non-zero `updatedAt` that is not in the future, and is no older than `priceMaxAge`. Every
health decision — borrow, collateral withdrawal, liquidation — goes through it, so a stale
or broken feed fails the transaction closed rather than pricing off a bad number. No DEX
spot price is read anywhere.

**Debt.** Interest is flat (simple, non-compounding) at `borrowRateBps` per year, applied to
a global `borrowIndex` (RAY, 1e27):

```
index += index * rateBps * elapsed / (10_000 * 365 days)
```

A position stores `scaledDebt = borrowed * RAY / index` at borrow time, and its current debt
is `scaledDebt * index / RAY`, **rounded up** — rounding always favours the pool. Interest is
not credited to any position; it simply raises `totalDebt()`, which is part of
`totalAssets() = idle USDC + totalDebt()`, so it accrues to lenders' shares. `accrue()` runs
at the start of every state-changing path (it is also public and free to call), and the view
helpers (`debtOf`, `totalAssets`, `isLiquidatable`) simulate accrual to the current block so
off-chain reads match what a transaction would see.

**The two thresholds**, both compared against collateral value, in bps, cross-multiplied so
no division rounding decides the outcome:

| Check | Rule | Where |
| --- | --- | --- |
| Max LTV 70% | action reverts if `debt * 10000 > value * 7000` | after `borrow` and after `withdrawCollateral` |
| Liquidation 85% | liquidatable if `debt * 10000 > value * 8500` | `liquidate`, `isLiquidatable` |

The LTV check is applied to the position's state *after* the action, so it constrains the
result rather than the starting point. A position with zero debt is always healthy and its
collateral is always fully withdrawable. The 70%–85% gap is the borrower's buffer; it is
crossed by price decline or by accrued interest, not by any action of the protocol.

## What a liquidator has to do

Call `liquidate(account, repayAmount, to)` with USDC approved to the market.

1. **Find an unhealthy position.** `isLiquidatable(account)` is the exact on-chain
   predicate. It reverts if the oracle is stale — that also means liquidations are
   impossible during a feed outage, so watch for it.
2. **Offer a repay amount.** It is clamped for you, so passing `type(uint256).max` is the
   normal way to take the maximum available:
   - **close factor 50%** of current debt while the position is still solvent
     (`collateralValue >= debt`);
   - **100%** once the position is insolvent, so a dust position is not stranded behind bad
     debt.
3. **Receive collateral plus the 5% bonus.** `seized = collateralForDebt(repaid * 10500 /
   10000)`, rounded down, sent to `to`. If that exceeds the remaining collateral (a deeply
   underwater position) the seizure is capped at the whole collateral balance and `repaid`
   is *recomputed downwards* to what that collateral is worth net of the bonus — you never
   pay for collateral you do not get. The uncovered remainder stays on the borrower's
   position as **bad debt**: it keeps accruing, is unlikely to be repaid, and is borne by
   lenders through `totalAssets()`. Nothing in this contract writes it off.
4. The call returns `(repaid, seized)`. Both the USDC pull and the WETH transfer happen
   after all accounting is updated, under a reentrancy guard.

There is no protocol cut of the bonus and no permissioning — any address can liquidate, on
behalf of any recipient. Self-liquidation is allowed and harmless.

## What an operator has to get right on mainnet

**Constructor arguments.** `Deploy.s.sol` hardcodes USDC, WETH and the Chainlink ETH/USD
*proxy* `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` — pass the proxy, never an aggregator
implementation, or the feed silently freezes at the next upgrade. Two things come from the
environment:

- `MARKET_OWNER` — **a multisig or timelock, not an EOA.** The owner can pause, change the
  borrow rate (capped at 100% APR) and change the staleness window. That is enough authority
  to freeze borrowing and liquidation, so it is a censorship vector as much as a safety one.
  Ownership is `Ownable2Step`: the recipient must call `acceptOwnership()`; verify `owner()`
  after the handover, and verify deployed bytecode on Etherscan.
- `BORROW_RATE_BPS` — flat APR. `setBorrowRate` accrues at the old rate first, so changes are
  never applied retroactively.

**`priceMaxAge` is per feed.** The deploy script uses 75 minutes: ETH/USD on mainnet is a
0.5% deviation / 1 hour heartbeat feed, plus margin for congestion. If you point this at any
other pair, re-derive it from *that* feed's published heartbeat — do not carry this number
over. It is bounded to [20 minutes, 2 days] on-chain but nothing enforces that it matches
reality.

**Seed the vault before opening it up.** The empty-vault inflation attack is mitigated with
OpenZeppelin's virtual shares at a 6-decimal offset (covered by
`test_donationDoesNotStealFromFirstDepositor`), but making the first deposit yourself and
keeping those shares removes the question entirely.

**Liquidity and utilisation.** There is no reserve factor and no utilisation-driven rate. At
100% utilisation lenders cannot exit: `maxWithdraw`/`maxRedeem` are clamped to idle USDC, so
withdrawals revert cleanly rather than failing on a transfer, and `borrow` reverts with
`InsufficientLiquidity`. With a flat rate nothing pulls utilisation back down — plan to
manage the rate manually, or replace the rate model before this carries real size.

**What pausing does.** `pause()` stops new supply, borrowing, collateral withdrawal and
liquidation. `repay` is deliberately always open, so borrowers can never be trapped into
accruing interest they cannot pay off. Note the trade-off: a pause also stops liquidations,
so pausing into a falling market accumulates bad debt. Lender `withdraw`/`redeem` also stay
open while paused; pause is not a bank-run brake.

**Token assumptions.** WETH collateral and USDC repayments are pulled through `_pullExact`,
which credits the observed balance delta and reverts if it differs from the requested amount
— a fee-on-transfer token can never desync accounting. The ERC-4626 lender path
(`deposit`/`mint`) uses OpenZeppelin's transfer logic and does assume a non-fee-on-transfer
asset; that holds for USDC today but is a thing to re-check if USDC's proxy implementation
ever changes. USDC is also **upgradeable and has a blacklist**: a blacklisted borrower cannot
receive a `borrow`, and a blacklisted liquidator's `liquidate` will revert. Neither breaks
accounting, but support will see it.

**Before you deploy.** Run static analysis (slither) and resolve the findings; add fork
tests pinned to a mainnet block against the real USDC, WETH and feed; and fuzz the
accrue/borrow/repay/liquidate sequence for the invariant that `totalScaledDebt` equals the
sum of position `scaledDebt` and that no path lets a position end above 70% LTV. The suite
in `test/` covers the units, thresholds, liquidation math, bad-debt capping, oracle failure
modes and access control against mocks — it is a starting point, not a substitute for those.

## Build

```
forge build
forge test
```
