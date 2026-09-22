# Aerodrome USDC/WETH Yield Vault Design

Evidence checked on 2026-09-22. This design assumes the vault uses Aerodrome's **Basic Volatile** WETH/USDC pool on Base, not one of the concentrated liquidity WETH/USDC pools.

## Live Contracts

Base onchain reads against `https://mainnet.base.org`:

| Component | Address | Notes |
| --- | --- | --- |
| Native USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Pool token1 |
| WETH | `0x4200000000000000000000000000000000000006` | Pool token0 |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | Gauge reward token |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | Official Aerodrome basic pool factory |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | Official Aerodrome voter |
| Pool / LP token | `0xcDAC0d6c6C59727a65F871236188350531885C43` | `vAMM-WETH/USDC`, `Volatile AMM - WETH/USDC` |
| Gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | `Voter.gauges(pool)`; currently alive |
| PoolFees | `0x0cfF5f2f4171db0b187Ad99F05dcCA08b0eEBDd6` | Fee escrow paired to the pool |
| FeesVotingReward | `0x14df87824a11DC27afF185D3149E05aaa4735f60` | Where gauge-forwarded pool fees are routed for voters |

The pool's live fee is `30` basis points, i.e. `0.30%`, from `PoolFactory.getFee(pool, false)`.

Sources: Aerodrome's deployment table lists the Base `PoolFactory`, `Voter`, `Router`, and `AERO` addresses; the contract README also describes gauges, fee voting rewards, and bribe voting rewards. See `aerodrome-finance/contracts` [deployment and contract descriptions](https://github.com/aerodrome-finance/contracts#deployment). The verified gauge and pool behavior is from Aerodrome's [`Gauge.sol`](https://raw.githubusercontent.com/aerodrome-finance/contracts/main/contracts/gauges/Gauge.sol), [`Pool.sol`](https://raw.githubusercontent.com/aerodrome-finance/contracts/main/contracts/Pool.sol), [`PoolFactory.sol`](https://raw.githubusercontent.com/aerodrome-finance/contracts/main/contracts/factories/PoolFactory.sol), and [`PoolFees.sol`](https://raw.githubusercontent.com/aerodrome-finance/contracts/main/contracts/PoolFees.sol).

## Deposit And Position Flow

1. Users deposit into the vault.
2. The vault converts deposits into the required WETH/USDC ratio for the volatile AMM pool.
3. The vault transfers WETH and USDC to `vAMM-WETH/USDC` and calls `Pool.mint(address(this))`.
4. The pool mints fungible LP tokens to the vault.
5. The vault approves the gauge and stakes the LP token through `Gauge.deposit(amount)`.

After step 5, the gauge, not the vault, physically holds the LP tokens. The vault owns the staked gauge balance and accounts shares to users.

## Exact `harvest()` Flow

The keeper calls `vault.harvest()`. The keeper should not call Aerodrome's gauge directly for the vault, because `Gauge.getReward(account)` only allows the account itself or Aerodrome's `Voter` to claim.

Recommended flow:

1. `vault.harvest()` optionally calls `Voter.distribute([gauge])` or the range distribution path if the current epoch's AERO has not yet been pushed to the gauge.
   - This is not the reward claim itself.
   - It moves claimable AERO emissions from the Voter into the gauge by calling `Gauge.notifyRewardAmount(amount)`.
   - As part of `notifyRewardAmount`, the gauge also runs its internal fee-collection path for the pool, described below.
2. The vault claims its accrued LP staking reward by calling:

   ```solidity
   IGauge(0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025).getReward(address(this));
   ```

3. The only token claimed by that call is `AERO` from the gauge's `rewardToken`, currently:

   ```text
   AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631
   ```

4. The vault swaps claimed AERO into WETH and USDC, using strict slippage limits and oracle/TWAP-aware checks.
5. The vault adds the new WETH/USDC liquidity to `vAMM-WETH/USDC`.
6. The vault stakes the newly minted LP tokens back into the same gauge.
7. The vault emits a harvest event with at least: AERO claimed, WETH added, USDC added, LP minted, total assets before/after, and keeper fee if any.

`harvest()` does **not** claim WETH/USDC swap fees from `PoolFees`, does **not** claim `FeesVotingReward`, does **not** claim vote incentives/bribes, and does **not** claim veAERO rebases. Those belong to veAERO voters/lockers, not to a plain staked LP vault.

## What The Position Earns

For this gauge-staked basic LP design, users should think of returns in three buckets:

| Bucket | Earned by vault depositors? | Harvestable? | Notes |
| --- | --- | --- | --- |
| AERO emissions | Yes | Yes | Paid by the Aerodrome gauge to staked LPs. This is the vault's primary yield source. |
| Swap fees from WETH/USDC trades | No, not in this staked-gauge design | No | The pool generates them, but the staked LP fee claim is routed through the gauge to `FeesVotingReward` for veAERO voters. |
| Inventory PnL / impermanent loss | Yes, economically | Not a claim | The vault is long a 50/50 volatile WETH/USDC AMM position, so share value moves with WETH price and pool rebalancing. |

Aerodrome's pool UI on 2026-09-22 showed the Basic Volatile WETH/USDC pool at roughly:

| Metric | UI value |
| --- | --- |
| Pool fee | `0.3%` |
| Volume | `~$826,522.32` |
| Fees | `~$2,479.57` |
| TVL | `~$7,392,741.97` |
| Fee APR | `~8.55246%` |
| Emission APR | `~7.68791%` |

Source: Aerodrome's current [liquidity pool listing](https://aerodrome-finance.app/liquidity/) for `WETH / USDC 0.3% Basic Volatile`.

For this vault, the realistic gross harvestable APR is the **emission APR**, paid in AERO and only realized after the vault swaps and compounds it. The displayed fee APR is useful context for pool activity and for veAERO voter economics, but it should not be counted as vault depositor yield unless the design changes to leave LP tokens unstaked or separately owns/votes a veAERO position.

Example using a `1,000,000` USD vault position and the UI figures above:

| Component | Approx annualized value | Count in vault APY? |
| --- | ---: | --- |
| AERO emissions at `7.68791%` | `~$76,879` before compounding, slippage, and gas | Yes |
| Pool swap fees at `8.55246%` | `~$85,525` of pool-level fee economics | No, routed to voters in this design |
| Rebalancing / impermanent loss | Path-dependent | Yes, as NAV movement |

The actual realized result will vary with weekly gauge votes, AERO price, WETH price, swap execution, liquidity depth, harvest frequency, gas, and the vault's slippage policy.

## Where Swap Fees End Up

The WETH/USDC pool charges the live volatile fee from `PoolFactory.getFee(pool, false)`, currently `0.30%`.

On each swap:

1. `Pool.swap()` computes the input-side fee.
2. `Pool._update0()` or `Pool._update1()` transfers the fee token out of the pool into the paired `PoolFees` contract.
3. Because the vault stakes LP tokens, the gauge is the LP holder for the staked balance. The gauge accrues the corresponding pool-fee claim.
4. When the gauge is notified of new AERO emissions through `Gauge.notifyRewardAmount`, it calls `_claimFees()`.
5. `_claimFees()` calls `Pool.claimFees()` as the gauge.
6. The pool transfers WETH/USDC fees from `PoolFees` to the gauge.
7. The gauge approves and notifies those fee tokens into `FeesVotingReward`.
8. veAERO voters who voted for this gauge can claim those WETH/USDC fee rewards through Aerodrome's voter fee-claim path.

So in this design, the pool's swap fees end up in:

```text
Pool.swap()
  -> PoolFees
  -> Gauge._claimFees()
  -> FeesVotingReward
  -> veAERO voters for the WETH/USDC gauge
```

They do not return to the vault during `harvest()`.

## Design Implication

This vault is an **AERO-emission auto-compounder**, not a fee-compounding LP vault. If the product should advertise WETH/USDC trading fees as depositor yield, the design needs to change: either keep LP unstaked and earn pool fees directly, or add a separate veAERO voting strategy that can capture fees and incentives. Those are different risk and accounting models from the simple staked-LP harvest loop above.
