# USDC Yield Vault (Base) — v1

Users deposit USDC. The strategy swaps about half into WETH, adds liquidity to the **Aerodrome
volatile USDC/WETH pool**, and stakes the LP token in that pool's **Aerodrome gauge**. The keeper calls
`harvest()` to claim AERO emissions, sell them for USDC through the Aerodrome AERO/USDC pool, and
reinvest the USDC into the position.

```
src/YieldVault.sol                  shares, deposit/redeem, profit lock, keeper entry point
src/AerodromeUsdcWethStrategy.sol   zap, stake, harvest, pro-rata exit, TWAP valuation
src/interfaces/IAerodrome.sol       minimal Aerodrome interfaces
script/Deploy.s.sol                 Base mainnet deploy
test/YieldVault.fork.t.sol          fork tests against live Aerodrome contracts
```

## Build / test

```sh
forge build
BASE_RPC_URL=<archive Base RPC> forge test   # falls back to https://mainnet.base.org
```

The tests run on a Base mainnet fork pinned at block 51,605,000. They use the real pool, gauge,
router and voter. Coverage: deposit → zap → stake → harvest → redeem, no dilution between depositors,
sandwich attacks on deposit, harvest and exit, first-depositor inflation attack, killed gauge,
`panic()`, pause, deposit cap and access control. On a fork nobody else trades, so the `_arb()` helper
plays the external arbitrageur and moves the price back after the vault's own swaps.

## Design in short

- **Invest on deposit.** Shares are minted for the value the deposit actually adds, so each depositor
  pays their own swap fee and price impact instead of spreading it over existing holders.
  `deposit(assets, receiver, minShares)`.
- **Pro-rata exit.** `redeem(shares, receiver, minAssetsOut)` unstakes and removes your share of the LP
  and swaps the WETH to USDC. It works while the vault is paused, after `panic()`, and when the gauge
  is killed. Your `minAssetsOut` is the slippage protection.
- **Valuation resistant to price manipulation.** WETH is priced from the pool's own TWAP (time-weighted
  average price, ~1h, `pool.quote`). LP is valued as `2·sqrt(k·p)` (k = reserve product, p = TWAP price),
  so skewing the reserves with a big swap doesn't move it. Deposits and harvests revert if the
  current price is more than `maxDeviationBps` (1%) away from the TWAP.
- **Swap min-out** for the zap and for reward sales = TWAP quote (fee and price impact included) minus
  `maxSlippageBps` (1%).
- **Profit lock.** Each harvest's gain unlocks linearly over 6h, so depositing just before a harvest
  and redeeming right after earns nothing.
- **Virtual shares** (offset of 1e6) make first-depositor inflation attacks unprofitable.
- The strategy looks up the pool, gauge and reward pool from Aerodrome's own factory and voter
  contracts. The constructor reverts if the gauge is dead or its reward/staking token is wrong.
  Approvals are for exact amounts only.

## Deployment

```sh
export BASE_RPC_URL=...
OWNER=<multisig> KEEPER=<keeper EOA> DEPOSIT_CAP=100000000000 \
  forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify
```

1. The script deploys `YieldVault` (deployer is temporary owner), then the strategy (owner = `OWNER`),
   then calls `vault.setStrategy()` once and starts the vault ownership transfer.
2. `OWNER` calls `vault.acceptOwnership()` (Ownable2Step).
3. Check the logged pool/gauge: `0xcDAC0d6c6C59727a65F871236188350531885C43` /
   `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
4. Keep `DEPOSIT_CAP` low at first (default 100k USDC). The pool holds about $9M, and entry+exit cost
   grows with deposit size (see limits below).

A dry run on a Base fork succeeds (`forge script ... --fork-url`).

## Keeper operation

- Call `vault.harvest()` from `KEEPER` (the owner can call it too). Suggested cadence is every
  12–24h, or when `strategy.pendingRewards()` × AERO price clearly beats gas. Base gas is cheap, but
  anything under `minAeroToSell` (1 AERO) is skipped.
- Send through a private or MEV-protected RPC if one is available. The min-out checks already bound
  losses to ~1% from the TWAP.
- If `harvest()` reverts with `PriceDeviation`, the market is moving fast or someone is manipulating
  the pool. Wait and retry. Don't raise `maxDeviationBps` just to push a harvest through.
- Gauge rewards run in weekly epochs (Thursday 00:00 UTC). If the pool loses its votes, emissions for
  that epoch are zero and harvest just claims nothing. Keep watching.
- Watch `voter.isAlive(gauge)`. If the gauge is killed, the owner calls `strategy.panic()` (unstakes;
  new deposits then revert) and `vault.pause()`. Users can still redeem.
- Tunable by the owner: `strategy.setParams(maxSlippageBps, maxDeviationBps, minAeroToSell)`
  (bps capped at 5%), `vault.setKeeper`, `vault.setDepositCap`, `pause/unpause`.

## Why these integrations (checked 2026-09-21, Base block ~51,605,661)

All values below were read onchain with `cast` against Base mainnet on that date.

| Item | Onchain reading |
|---|---|
| Aerodrome PoolFactory `0x420DD381…40Da`, Router `0xcF77a3Ba…4E43`, Voter `0x16613524…80A5` | code present; `router.defaultFactory()` = that factory; `factory.voter()` = that voter |
| USDC/WETH vAMM pool `0xcDAC0d6c…5C43` | 1,661 WETH + 4.53M USDC (≈ $9.1M); fee 30 bps |
| Its gauge `0x519BBD1D…C025` | `isAlive = true`, reward token AERO, `rewardRate` 0.0296 AERO/s (≈ 2,556 AERO/day), `periodFinish` 1790208000 (current epoch), ~98.8% of pool LP staked |
| Volume sample | 394 swaps, ≈ $42.5k USDC leg over 2,000 blocks (~67 min) ⇒ roughly $0.9M/day |
| AERO/USDC vAMM `0x6cDcb1C4…971d` (reward exit) | 18.1M USDC + 26.2M AERO (≈ $36M); AERO TWAP ≈ $0.69 |
| Implied emissions APR for staked LP | ≈ 933k AERO/yr × $0.69 / ≈ $9.0M staked ≈ **7%** (changes weekly with votes) |

Why this venue:
- **Aerodrome** is the Base DEX with gauge emissions on this exact pair, so there is something
  concrete for `harvest()` to claim and compound. The AERO/USDC pool that the strategy sells rewards
  into is deep enough (~$36M).
- **vAMM (full-range) rather than Slipstream (concentrated liquidity).** The Slipstream USDC/WETH pool
  with tick spacing 100 (`0xb2cc224c…DC59`, 1,413 WETH + 5.78M USDC) gets ~9× the emissions
  (0.27 AERO/s). But concentrated positions are NFTs that need range management and rebalancing
  logic, and that doubles the attack surface for a v1. A full-range LP token is fungible, is easy to
  value with the fair-reserve formula, and has a built-in TWAP (`quote`). Slipstream is the obvious v2
  upgrade.
- **Not Uniswap v3/v4.** The Uniswap v3 USDC/WETH 0.05% pool (`0xd0b53D92…F224`, 1,520 WETH + 5.11M
  USDC) is deep, but it has no native emissions. Yield there would be swap fees only, with the same
  concentrated-liquidity complexity.
- **Trade-off:** on Aerodrome, **staked LP gives up swap fees** (they go to veAERO voters). So the
  vault earns AERO emissions only. That is the yield `harvest()` compounds.

## Known limits (v1)

- **Entry + exit cost.** A 100k USDC round trip cost ~1.3% on the fork (0.3% fee on the swapped half
  in each direction, plus price impact in a $9M pool). 10k costs <1%. At ~7% APR that is about 2 months
  to break even for large deposits. Keep the cap modest.
- **Impermanent loss** on the WETH leg. The vault is not delta-neutral.
- **Emission APR depends on veAERO votes** and on the AERO price. It can drop to zero in any epoch.
- The price check limits valuation error to roughly half of `maxDeviationBps` (LP value scales with
  √price), but a depositor can still trade against TWAP lag within that band.
- No performance/management fee, no strategy migration (`setStrategy` is one-shot), no permissionless
  harvest. Not ERC-4626, because entry and exit go through swaps and need user min-outs.
- Not audited.
