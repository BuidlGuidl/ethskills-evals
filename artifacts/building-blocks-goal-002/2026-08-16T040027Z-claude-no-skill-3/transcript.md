Done. `forge build` and `forge test` both pass — 52 unit tests offline, plus 7 fork tests against live Base (59 total, 0 failures, no compiler warnings).

## What's there

- **`UsdcYieldVault.sol`** — ERC-4626 over USDC. Share accounting, a 5% idle buffer so routine withdrawals skip the strategy, pausable deposits, `Ownable2Step` governance. Never touches a DEX, so the strategy is swappable.
- **`AerodromeUsdcWethStrategy.sol`** — swaps half to WETH, adds USDC/WETH volatile liquidity, stakes the LP in the gauge, and `harvest()` compounds the AERO emissions.
- **`BaseAddresses.sol`**, deploy script, mocks reproducing Aerodrome's pool maths, and a fork suite.

I verified every Base address on-chain rather than trusting recall — the router's `defaultFactory()`, `getPool(USDC,WETH,false)`, `Voter.gauges(pool)`, and the gauge's `stakingToken`/`rewardToken` all chain together correctly. The fork run at block 50031780 did a real 50,000 USDC deposit, earned 48 AERO over 7 days, and exited for 49,834 USDC.

## Two things you should weigh in on

**Depositors are ~50% long ETH.** Pairing USDC with WETH means impermanent loss and ETH price exposure in something that presents as a USDC vault. That's inherent to the spec, so I built it as asked and documented it prominently — but a truly USD-denominated product needs a delta hedge or a stable pair. `test_totalAssets_tracksOraclePriceMoves` pins it down: ETH doubling grows the position by √2, not 2×.

**Staked LPs don't earn swap fees.** On Aerodrome, gauge-staked LP forfeits trading fees to veAERO voters and receives AERO emissions instead. So "whatever the position earns" is emissions, which depend on weekly vote weights and can approach zero. I chose Aerodrome anyway — it's the venue with a live gauge for this pair, and Uniswap v3 would have meant range management and an off-chain rebalancer.

## Three bugs the tests caught

1. **Slippage and deviation guards didn't compose.** Bounding swaps by slippage alone against an oracle-derived expectation deadlocks the strategy: a pool sitting 0.8% off-oracle (legitimately, inside the deviation band) plus a 0.3% fee already blows a 1% budget. Bounds are now `deviation + slippage`.
2. **Unbounded deploys blew through the slippage guard.** Price impact scales with trade size, so a large deposit couldn't be deployed at all. Added `maxDeployBps`, capping each round against pool reserves.
3. **The last holder couldn't exit.** `totalAssets` prices LP at oracle-fair value, but realising it costs a swap — so a full exit always lands under quote with no remaining position to overshoot into. Added `redeem(shares, receiver, owner, maxLossBps)`.

On manipulation: `totalAssets` uses the constant-product identity `2·√(k·p)` with the Chainlink price rather than spot reserves, so pushing 4M USDC through the pool doesn't move the share price.

Not audited, and I'd flag two limits before real money: vault capacity is bounded by pool depth (very large single withdrawals can revert on the slippage guard — withdraw in parts), and keepers must pass a real `minUsdcFromRewards`, since the AERO leg has no on-chain feed to bound it.
