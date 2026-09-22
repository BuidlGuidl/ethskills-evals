# WETH/USDC borrowing market — operator & integrator notes

Two contracts get deployed:

| Contract | What it does |
|---|---|
| `src/ChainlinkOracle.sol` | Reads Chainlink ETH/USD and USDC/USD, normalises both to 18-decimal USD, rejects stale/invalid answers. No owner, everything immutable. |
| `src/LendingMarket.sol` | Holds WETH collateral and the USDC lending pool. Borrow, repay, withdraw, liquidate, and a share-based lender side. |

Lenders supply USDC (`supply`/`withdraw`) and own shares of the pool; borrowers lock WETH
(`depositCollateral`) and draw USDC (`borrow`). Interest paid by borrowers accrues to the pool, so
it lands on the lender shares. Risk parameters are `constant`, not admin-settable: a position's
liquidation terms cannot be changed underneath the borrower after it is opened.

```
MAX_LTV                 70%   borrow / withdraw limit
LIQUIDATION_THRESHOLD   85%   above this the position is liquidatable
LIQUIDATION_BONUS        5%   extra collateral for the liquidator
CLOSE_FACTOR            50%   max share of debt closed per liquidation (100% if insolvent)
MAX_BORROW_RATE         50%   ceiling on the flat annual rate the owner may set
```

## How a position's health is computed

Everything is compared in **USD with 18 decimals**. Token amounts stay in their native decimals —
USDC is 6, WETH is 18 — and are converted using the unit read from the token itself at deploy
(`collateralUnit`, `debtUnit`). There is no hardcoded `1e18` in the pricing path; that assumption is
the classic way a USDC integration ends up off by 10^12.

```
collateralValue = collateral * ethUsdPrice  / 1e18   (rounded down)
debtValue       = debt       * usdcUsdPrice / 1e6    (rounded up)
```

`debt` itself is `scaledDebt * borrowIndex / 1e27`, rounded up. Each borrower stores a *scaled*
principal; the global `borrowIndex` grows with time at the flat annual rate, so interest reaches
every borrower by moving one number:

```
borrowIndex += borrowIndex * rateBps * elapsedSeconds / (10_000 * 365 days)
```

That is simple (non-compounding between touches) interest, by design — the rate model is not the
point here. `accrue()` is public and is called first by every state-changing entry point, so views
and state always agree. Changing the rate accrues first, so a rate change can never retroactively
re-price existing debt.

Three checks use these values:

- **Borrow / withdraw collateral** — allowed only while `debtValue * 10_000 <= collateralValue * 7_000`.
- **Liquidation** — allowed only while `debtValue * 10_000 > collateralValue * 8_500`.
- **`healthFactor(user)`** — `collateralValue * 85% / debtValue`, scaled by 1e18. Below `1e18` the
  position is liquidatable; no debt returns `type(uint256).max`. `isLiquidatable(user)` is the same
  test as a bool.

Rounding always goes against the actor and in favour of the pool: borrower debt rounds up, lender
withdrawals round down, liquidator seizures round down.

Prices come **only** from Chainlink, never from a DEX pool — a spot price can be moved inside a
single flash-loaned transaction, which would let an attacker either mint free debt or liquidate
healthy positions. Every read rejects a non-positive answer, an unfinalised round
(`answeredInRound < roundId`), a future timestamp, an answer older than the configured max age, and
anything outside absolute sanity bounds. If a feed goes stale the market **fails closed**: borrowing,
liquidating and collateral withdrawals with debt outstanding all revert until it recovers. Repaying
and withdrawing collateral from a debt-free position do not touch the oracle, so users are never
locked in by a dead feed.

## What a liquidator has to do

```solidity
market.liquidate(borrower, repayAmount, minCollateralOut, recipient)
  returns (uint256 repaid, uint256 seized)
```

1. **Find a target.** `isLiquidatable(borrower)` / `healthFactor(borrower) < 1e18`. Both include
   interest not yet written to storage, so no need to call `accrue()` first.
2. **Approve USDC** to the market for at least `repayAmount`. Approve the exact amount you intend to
   spend rather than `type(uint256).max`.
3. **Size the repayment.** For a solvent-but-unhealthy position you may repay at most 50% of the
   debt. Once a position is underwater (`debtValue >= collateralValue`) the close factor lifts to
   100% so the bad debt can be cleared in one go. Passing more than the cap is fine — it is clamped,
   not reverted.
4. **Set `minCollateralOut`.** This is your slippage guard: the price can move, or another
   liquidator can land first and shrink the position, between the time you build the transaction and
   the time it mines. Passing `0` means "accept anything". Liquidations are a prime MEV target;
   consider submitting through a private relay (e.g. Flashbots Protect) so your transaction is not
   simply backrun.
5. **What you get.** `seized = repaid * usdcPrice / ethPrice * 1.05`, rounded down. If the position
   does not hold enough WETH to pay the full bonus, the seizure is capped at the remaining
   collateral and the repayment is *recomputed downward* to match — you never overpay for a capped
   seizure.

Reverts you should expect: `PositionHealthy` (someone beat you to it, or the price moved back),
`NoDebt`, `SlippageExceeded`, and oracle errors if a feed is stale.

**Bad debt.** If a position is liquidated to zero collateral with debt remaining, that debt stays on
the books and is carried by the lender pool — `totalAssets()` still counts it. The contract has no
socialisation mechanism; this is the tail risk lenders take. Liquidating early, while the 5% bonus
is still covered by collateral, is what keeps it from happening, which is why liquidation is
permissionless and incentivised.

## What an operator has to get right on mainnet

**Before broadcasting**

- [ ] **Owner is a multisig or timelock, never an EOA.** `MARKET_OWNER` gets `setBorrowRate` and
      `pause`. Ownership transfer is two-step (`Ownable2Step`) so a typo cannot orphan the market.
- [ ] **Verify every address in `script/Deploy.s.sol`** against the block explorer: WETH, USDC, the
      ETH/USD feed (`0x5f4e…8419`) and the USDC/USD feed (`0x8fFf…18f6`). A wrong address here is
      unrecoverable — the market's token and oracle wiring is immutable.
- [ ] **Check the feed heartbeats you are deploying against.** The script uses 1h15m for ETH/USD and
      25h for USDC/USD: the published heartbeat plus a grace margin. Too tight and a normal late
      update bricks the market; too loose and you price positions off a dead feed. Re-read the
      current heartbeats on data.chain.link before deploying — they change.
- [ ] **Pick the rate deliberately.** It is flat and capped at 50% APR. There is no utilisation
      curve, so nothing automatically pulls in liquidity when the pool is drained.

**At deploy**

- [ ] **Seed the lender pool yourself in the same transaction batch as the deploy.** The pool uses a
      virtual-share offset (the ERC-4626 inflation-attack mitigation), so a donation attack is not
      profitable, but seeding removes the empty-pool edge entirely.
- [ ] **Verify the source on Etherscan** (`forge verify-contract`, or `--verify` on the script) for
      both contracts. An unverified lending market is indistinguishable from a scam.

**After deploy**

- [ ] **Run a liquidation bot, or make sure someone does.** Nothing in the contract self-liquidates.
      An unhealthy position stays unhealthy until a third party acts, and the protocol's solvency
      depends entirely on someone acting while the 5% bonus is still covered.
- [ ] **Monitor utilisation.** Lender withdrawals are served from idle USDC only
      (`availableLiquidity()`); if borrowers have drawn the pool down, withdrawals revert with
      `InsufficientLiquidity` until someone repays. That is normal for a lending market, but lenders
      must be told, and with a flat rate you have to raise the rate by hand to attract liquidity.
- [ ] **Know the USDC-specific failure modes.** USDC is upgradeable, pausable, and has a blocklist.
      If USDC pauses, every repayment and liquidation in this market stops. If the market address
      itself were ever blocklisted, the pool would be frozen. Nothing in the contract can fix that;
      it is a risk to disclose, not to engineer around.
- [ ] **Watch the pause tradeoff.** `pause()` is a single owner key that can stop all new supply,
      collateral deposits and borrows. That is a censorship vector, which is why it is deliberately
      limited: repay, withdraw collateral, withdraw supply and liquidate all keep working while
      paused, so a pause can never trap user funds. Keep that key behind the same multisig, and
      prefer a timelock for the rate.
- [ ] **Run the analysers before shipping.** `forge test`, `forge test --fuzz-runs 10000`, and
      `slither .`. Treat any reentrancy, unchecked-return or unprotected-state-change finding as a
      blocker. Every external call in the market goes through `SafeERC20` (USDT-style non-returning
      tokens, though not used here, and paused/blocklisted transfers all surface as reverts), every
      entry point is `nonReentrant`, and state is written before tokens move. Incoming transfers are
      measured as a balance delta, so a fee-on-transfer token could never credit more than it paid.
- [ ] **This has not been audited.** The tests in `test/` cover the LTV boundary, interest accrual,
      the close factor, the collateral cap, oracle staleness and the pause semantics — that is a
      sanity net, not an audit. Get one before it holds real size.

## Build and test

```bash
forge build
forge test
```
