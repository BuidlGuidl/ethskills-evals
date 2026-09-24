# Aerodrome USDC-WETH Vault (Base) — v1

Users deposit USDC. The vault swaps the right share of it to WETH, adds liquidity to the
Aerodrome **volatile WETH/USDC pool** (vAMM), and stakes the LP token in the pool's **gauge**. A keeper
calls `harvest()` to claim AERO rewards, sell them for USDC, and add the proceeds back as LP (compounding).

```
deposit(USDC) ─► swap part to WETH ─► addLiquidity ─► gauge.deposit ─► mint shares
harvest()     ─► gauge.getReward (AERO) ─► AERO→USDC ─► 10% fee ─► swap part ─► addLiquidity ─► stake
withdraw()    ─► burn shares ─► gauge.withdraw ─► removeLiquidity ─► WETH→USDC ─► USDC to user
```

- `src/AeroUsdcWethVault.sol`: the vault and strategy in one contract. Shares are ERC20 and each share is a pro-rata claim on the vault's LP.
- `src/interfaces/IAerodrome.sol`: minimal Aerodrome and Chainlink interfaces.
- `script/BaseAddresses.sol`, `script/Deploy.s.sol`: addresses and the deploy script.
- `test/AeroUsdcWethVault.t.sol`: 19 **fork tests** that run against live Base state.

## Build and test

```bash
forge build
forge test                                   # forks Base via https://mainnet.base.org by default
BASE_RPC_URL=<your rpc> FORK_BLOCK=<n> forge test   # pin a block (needs an archive RPC)
```

The tests cover:
- deposit, withdraw and a full round trip (loss under 0.5% on 10k USDC)
- pro-rata fairness between two users
- harvest compounding real AERO emissions, plus the 10% fee
- keeper-only access and slippage reverts
- a price move made by a whale swap, a stale oracle, and the sequencer being down
- withdraw still working when paused or when the oracle is stale
- emergency unstake
- the first-depositor "donation" attack, done by staking LP into the gauge on the vault's behalf

## Deployment

```bash
export OWNER=<multisig> KEEPER=<keeper EOA/bot> FEE_RECIPIENT=<treasury>
forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify --private-key $PK
```

The script checks that the chain is Base (8453) and that the gauge is still alive in the Voter.
The constructor reads the pool from `gauge.stakingToken()`, the reward token from
`gauge.rewardToken()` and the factory from `router.defaultFactory()`. It reverts unless the pool
is volatile and contains exactly USDC and WETH. Ownership uses a 2-step transfer (`Ownable2Step`).
Use a multisig as the owner.

Defaults you can change after deploy:

| Parameter | Default | Setter / bound |
|---|---|---|
| performance fee | 10% of the AERO proceeds | `setPerformanceFee`, at most 20% |
| max pool vs Chainlink price gap | 1% | `setOracleParams`, at most 5% |
| max oracle age | 1 h (the feed's heartbeat is 20 min) | `setOracleParams`, at most 1 day |

## Keeper operation

1. Read `pendingAero()`. Harvest when the USDC value is well above the gas cost. On Base that
   is roughly daily, or several times a day once TVL is large.
2. Quote the sale: `minUsdcFromAero = AERO_USDC_pool.getAmountOut(pendingAero, AERO) * 0.99`.
3. Simulate `harvest(minUsdcFromAero, 0)` with `eth_call` to read the LP that will be added, then send
   `harvest(minUsdcFromAero, simulatedLp * 0.99)`. Use a private or protected RPC if you can.
4. Expect a revert with `PriceDeviation`, `StaleOracle` or `SequencerDown` when the pool is off
   the Chainlink price or the feeds are unhealthy. In that case retry later. Do not raise the band
   just to push the harvest through.
5. Stop harvesting at the end of an epoch if the gauge is killed (`Voter.isAlive(gauge) == false`).
   The owner can call `emergencyUnstake()`, which also pauses. Withdrawals keep working.

Safety model:
- **Deposits** check the pool spot price against Chainlink ETH/USD and the Base sequencer-uptime feed, and take `minShares` from the user.
- **Withdrawals** deliberately skip the oracle check so users can always exit. They rely on `minUsdcOut`.
- **Donation attack:** virtual shares (offset 1e3) make first-depositor inflation unprofitable.

## Why these integrations (evidence read onchain on 2026-09-21, Base block ~51,606,600)

| What | Address | Reading |
|---|---|---|
| Aerodrome Router | `0xcF77…4E43` | code present; `defaultFactory` = PoolFactory; `voter` = Voter |
| PoolFactory | `0x420D…40Da` | `getPool(USDC,WETH,false)` = `0xcDAC…5C43`, fee 30 bps |
| WETH/USDC vAMM pool | `0xcDAC…5C43` | reserves 1,655.8 WETH + 4.55M USDC (≈ $9.1M); spot price $2,748 vs Chainlink $2,744.8 |
| Gauge | `0x519B…C025` | `Voter.isAlive = true`, reward AERO, `rewardRate` 0.0296 AERO/s (≈ 2,556 AERO/day), epoch ends 2026-09-24 00:00 UTC, 98.7% of LP staked |
| AERO/USDC vAMM (the harvest sale route) | `0x6cDc…971d` | 18.1M USDC + 26.1M AERO (≈ $36M, AERO ≈ $0.69); $1.24M volume in 10k blocks (~5.6 h) |
| Chainlink ETH/USD | `0x7104…Bb70` | "ETH / USD", 8 decimals, updated in the same block as the read |
| Chainlink L2 sequencer uptime | `0xBCF8…6433` | answer 0 (up) |

**Why Aerodrome.** It is Base's ve(3,3) DEX. Its gauges pay AERO emissions, and emissions are the
thing a keeper can "claim and compound". This pool's gauge is alive and paying rewards in the
current epoch. At the prices above the gauge pays about $1.77k/day on about $9.0M staked, which is
**about 7% APR before our fee**. The rate changes every weekly epoch with veAERO votes.

**Why the vAMM (full range) and not concentrated liquidity (CL).**
- **The vAMM needs no range management.** The LP token is fungible and pro-rata share accounting
  is trivial. It is the smallest correct v1.
- **The CL pool is much bigger.** The Slipstream CL100 WETH/USDC pool (`0xb2cc…DC59`) did $8.24M
  of volume in the same 10k-block window, against $148k in the vAMM. Its gauge emits about 9× more
  AERO (0.27 AERO/s).
- **Why CL is not in v1.** CL pays only while the position's price range covers the current price,
  and it needs NFT positions plus a rebalancing keeper.
- **Uniswap v3** has deep WETH/USDC pools on Base but no emissions, and it has the same range
  management problem.

**Uniswap v3 and Slipstream CL are the natural v2 upgrade.**

**Why Chainlink.** It is the independent price reference for the manipulation guard. The
sequencer-uptime feed is Chainlink's standard guard for L2s.

### Caveats found while checking

- **Staked LP gets no swap fees.** On Aerodrome, the fees earned by gauge-staked LP go to veAERO
  voters (the gauge's `feesVotingReward` = `0x14df…5f60`). The vault's only yield is AERO.
  In the 5.6 h sample, fees for unstaked LP would have annualised to roughly the same ~7%. One
  short sample is weak evidence, so recheck both numbers before scaling TVL.
- **Pool depth limits deposit size.**
  - A 100k USDC zap moved the $9.1M pool's price about 2.2%. On a fork (no arbitrage) that
    tripped the 1% oracle band at the next harvest.
  - The depositor pays for their own price impact, which `minShares` guards against.
  - Recommend UI caps of around $20–50k per transaction. Past that, move to a deeper venue (CL) or route the zap swap through CL.
- **USDC is assumed to be $1** in the oracle check.
- **Leftover dust stays in the vault.** Small USDC/WETH leftovers from deposit zaps stay behind
  and are compounded at the next harvest.

## Not in v1

- An ERC-4626 interface. `totalAssets` in USDC would need an LP valuation that can be manipulated.
- Multi-hop or configurable harvest routes.
- Deposit caps.
- A timelock on admin setters.
- An audit.
