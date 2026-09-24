# Base USDC-WETH Yield Vault (v1)

ERC-4626 vault on Base. Users deposit USDC. The strategy pairs it with WETH in the Aerodrome
**vAMM-WETH/USDC** pool, stakes the LP token in the pool's gauge, and a keeper calls `harvest()`
to claim the AERO rewards, sell them for USDC, and add that USDC back into the position.

```
user ──USDC──▶ YieldVault (ERC-4626, yvUSDC-WETH)
                  │ deposit: USDC goes straight to the strategy (no swap in the user tx)
                  ▼
             AerodromeStrategy ──▶ Aerodrome Router ──▶ vAMM WETH/USDC pool ──▶ Gauge (earns AERO)
                  ▲                                                          
               keeper: harvest() = claim AERO → sell for USDC → swap half the USDC to WETH → add liquidity → stake
```

| File | Purpose |
|---|---|
| `src/YieldVault.sol` | ERC-4626 share accounting, deposit cap, withdrawal loss cap |
| `src/AerodromeStrategy.sol` | LP management, harvest, oracle-based valuation and slippage checks |
| `script/Deploy.s.sol`, `script/BaseAddresses.sol` | Deployment and Base mainnet addresses |
| `test/YieldVault.t.sol` | Offline unit tests for the vault (mock strategy) |
| `test/AerodromeStrategy.fork.t.sol` | Tests against the real Aerodrome and Chainlink contracts on a Base mainnet fork |

## Build & test

```sh
forge build
forge test                      # fork tests use BASE_RPC_URL, or https://mainnet.base.org if it's unset
BASE_RPC_URL=<your rpc> forge test
```

Fork tests are pinned to block `51_600_000`. The RPC must be able to serve that block's historical state.

## Deployment

```sh
export BASE_RPC_URL=...  OWNER=0x...(multisig)  KEEPER=0x...  DEPOSIT_CAP=250000000000   # 250k USDC
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --account <deployer>
```

The script:
1. deploys `YieldVault` (the deployer is temporary owner)
2. deploys `AerodromeStrategy`. The constructor checks that the gauge's staking token is the factory's
   canonical volatile WETH/USDC pool, that the gauge pays AERO, and that every price feed has 8 decimals
3. calls `vault.setStrategy(strategy)` (this can only be done once)
4. transfers vault ownership to `OWNER`. The strategy is owned by `OWNER` from the start.

Before mainnet: check the Chainlink heartbeats in `BaseAddresses.sol` (`*_MAX_AGE`) against
data.chain.link, and use a multisig as `OWNER`.

Owner settings (strategy `setParams`):
- `slippageBps`: max loss on any swap vs the oracle price. Default 1%.
- `maxPriceDeviationBps`: how far the pool price may be from the oracle before liquidity is added. Default 1%.
- `profitUnlockTime`: how long harvested profit takes to show up in the share price. Default 6h.
- `maxInvestPerHarvest`: max USDC put into the pool per harvest. Default 25k.

Vault settings: `setDepositCap`, `setMaxLossBps` (default 1%, max 10%).

## Keeper operation

- Call `strategy.harvest()` from the `KEEPER` address (the owner can also call it). The function has no arguments.
  Every price limit is computed on-chain from Chainlink, so the keeper doesn't need to calculate anything.
- **Frequency:** new deposits sit as USDC in the strategy until a harvest invests them, and at most
  `maxInvestPerHarvest` goes in per call. Run it every few hours, and more often while there's a
  backlog of uninvested USDC (`usdc.balanceOf(strategy) > 0`). Skip a run when `gauge.earned(strategy)`
  is small and there's no uninvested USDC.
- **Expected reverts** (retry later, don't raise the limits):
  - `PoolPriceDeviation`: the pool price is off from the oracle (volatility, or someone is manipulating the pool)
  - `StaleOrBadPrice`: an oracle hasn't updated in time
  - `SequencerDown`: the Base sequencer is down or restarted less than 1h ago
  - router `B0#`-style reverts: the swap would lose more than `slippageBps`
- Profit is released gradually over `profitUnlockTime` after each harvest. This way nobody can deposit
  just before a harvest and withdraw just after to take the rewards.
- Emergency: the owner calls `strategy.emergencyExit()`. It pulls all liquidity out of the gauge and pool,
  converts it to USDC, and stops reinvesting. Users then withdraw as normal.

## Why these integrations

**Aerodrome (vAMM-WETH/USDC + gauge).** Aerodrome is the main DEX on Base and has the largest
incentive program there. Its gauges pay AERO rewards every second, so there's always something for
`harvest()` to claim. Its pools are simple x·y=k pools with one fungible LP token, which gives us:
- no price ranges to manage or rebalance (unlike Uniswap v3/v4 or Slipstream concentrated liquidity)
- a simple ERC-20 LP that can be split for partial withdrawals
- a closed-form fair value for the LP token (see below)

Note that staked Aerodrome LP gives up trading fees; they go to veAERO voters. The yield is the AERO
rewards. The pool (`0xcDAC…5C43`), gauge (`0x519B…C025`), router and factory addresses were checked
on-chain (factory `getPool`, voter `gauges`, `isAlive`). The strategy re-checks them in its constructor.

**Chainlink (ETH/USD, USDC/USD, AERO/USD, L2 sequencer uptime).** Chainlink is the standard oracle
on Base and has all three prices we need. It is used to:
- value the position. LP is priced as `2·sqrt(k·P_oracle)` instead of from the pool's current reserves,
  so pushing the pool price around can't move the vault's share price.
- set a minimum output for every swap (AERO→USDC, USDC→WETH, WETH→USDC)
- refuse to add liquidity when the pool price is far from the oracle
- stop everything while the sequencer is down, and for 1h after it restarts

**OpenZeppelin ERC4626** with a 6-decimal share offset ("virtual shares"). This protects the first
depositor from the known share-inflation attack.

## Known limits / v1 trade-offs

- **Capacity.** The pool holds about $9M, so large swaps move its price. Harvests invest at most
  `maxInvestPerHarvest` each. A single withdrawal needs to sell roughly half its size as WETH, so
  withdrawals above about $50k may fail the 1% slippage check and should be split into smaller ones.
  Keep `DEPOSIT_CAP` modest.
- **Exit cost is paid by the withdrawer.** A withdrawal can receive up to `maxLossBps` less than the share
  value shown (swap fee plus price impact of selling the WETH). `redeem` returns the amount actually paid.
  `withdraw(assets)` can pay slightly less than `assets`, so it isn't fully ERC-4626-strict.
- **Oracle dependence.** If a feed stops updating or the sequencer is down, deposits, withdrawals and
  harvests revert, because `totalAssets()` needs fresh prices. This fails safe (no mispriced shares),
  but funds are temporarily stuck.
- **Impermanent loss.** Users take on ETH price exposure through the LP.
- **No fees, single strategy, owner is trusted** (it sets parameters and can call emergency exit). Not audited.
