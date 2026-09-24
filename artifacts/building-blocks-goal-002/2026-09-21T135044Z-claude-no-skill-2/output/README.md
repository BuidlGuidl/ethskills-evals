# Aerodrome USDC Vault (Base) — v1

Users deposit USDC and receive `avUSDC` shares. A keeper zaps idle USDC into the
**Aerodrome vAMM-WETH/USDC** pool, stakes the LP in the pool's **gauge**, and
calls `harvest()` to claim AERO, sell it for USDC, and compound it.

```
deposit USDC ──► idle USDC ──harvest()──► swap ~½ to WETH ──► addLiquidity ──► stake LP in gauge
                                 ▲                                                   │
                                 └──── sell AERO → USDC (minus perf fee) ◄── getReward ┘
```

Contract: `src/AerodromeUsdcVault.sol` (single contract, no upgrade proxy).

## ⚠️ Risk: this is not a stablecoin yield product

Half of each deployed dollar is held as WETH. Share value in USDC **moves with
ETH** (roughly 50% exposure) and suffers impermanent loss. AERO emissions must
beat that. Say so clearly in any UI.

## Build & test

```sh
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0   # if lib/ is empty
forge build
forge test                                   # unit tests (mocks); fork test is skipped
BASE_RPC_URL=<base rpc> forge test --match-path 'test/fork/*' -vv   # real Base contracts
```

- `test/AerodromeUsdcVault.t.sol` — 21 unit + fuzz tests. The mock pool copies
  Aerodrome's fee behavior (the fee is sent out of the pool, not left in reserves).
- `test/fork/…fork.t.sol` — full cycle on a Base fork: deposit → zap → stake →
  30 min of real AERO emissions → harvest → redeem. Forks the latest block unless
  `BASE_FORK_BLOCK` is set (pinning a block needs an archive RPC).

## Deployment

All Base addresses live in `script/BaseAddresses.sol`. They were checked onchain
on 2026-09-21: `router.poolFor(WETH,USDC,false)` returns the pool,
`voter.gauges(pool)` returns the gauge (alive), the gauge's reward token is AERO,
the pool fee is 30 bps, and the feed descriptions match.

```sh
export OWNER=<multisig> KEEPER=<keeper EOA> FEE_RECIPIENT=<treasury> DEPOSIT_CAP=250000000000  # 250k USDC
forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify --account deployer
```

- `OWNER` should be a multisig. It is set in the constructor; later transfers use a two-step accept (`Ownable2Step`).
- Start with a low `DEPOSIT_CAP` and raise it with `setDepositCap` once the vault has run well for a while.
- Defaults: 10% performance fee (max 20%) and 1% max slippage against Chainlink (max 5%).
- The owner can pause deposits. Withdrawals can never be paused.

## Keeper operation

Call `harvest(minRewardUsdcOut, maxDeploy)` every **6–12 h**. This call is the only
thing that puts idle USDC to work, so also call it soon after large deposits.

1. `pendingRewards()` gives the claimable AERO. Quote it with the Aerodrome router's
   `getAmountsOut(amount, [{AERO→USDC, stable:false, factory}])` and set
   `minRewardUsdcOut = quote × 0.99`. This is the only protection on the reward
   swap, so never pass 0 on mainnet.
2. `maxDeploy` sets how much idle USDC is zapped in this call. The zap swap has to
   stay within `maxSlippageBps` of Chainlink, which includes the 0.3% pool fee. With
   the pool's current ~$9M of liquidity, about 50k USDC per call is safe. If the call
   reverts with `Router: insufficient output`, halve the amount and try again.
3. `harvest` reverts with `PoolPriceDeviation` if the pool price is too far from
   Chainlink (the pool was manipulated or is lagging), and with `OracleUnavailable`
   if a feed is stale or the sequencer is down. Retry later; don't raise the limits
   to force it through.

```sh
cast send $VAULT "harvest(uint256,uint256)" $MIN_OUT 50000000000 --rpc-url $BASE_RPC_URL --account keeper
```

Either the keeper or the owner can call it. Harvested profit (after the fee)
unlocks linearly over 12 h, which stops "deposit just before harvest, withdraw
just after" sniping.

## Design notes

- **Share price uses a fair LP value, not the pool's spot price.** A vAMM pool is
  worth `2·sqrt(k·P)`, where `k = reserveWETH·reserveUSDC` and `P` is Chainlink
  ETH/USD divided by USDC/USD. A flash loan can skew the reserves but can't make
  this number bigger.
- **Deposits never touch the DEX.** They stay idle until the keeper deploys them,
  so a depositor can't be sandwiched.
- **Redeem** (`redeem(shares, receiver, minAssetsOut)`) pays out the fair value of
  the shares. It uses idle USDC first, then unwinds only as much LP as needed. The
  redeemer pays their own exit swap fee and slippage, so other holders aren't
  diluted. The WETH→USDC swap has a minimum output based on Chainlink.
  `previewRedeem` is an upper bound.
- **If the oracle is down**, redeem switches to a pro-rata exit and requires
  `minAssetsOut > 0`. Deposits and harvests stay blocked. User funds are never
  locked just because the oracle is down.
- **L2 sequencer check**: every oracle read requires the Base sequencer to be up,
  plus a 1 h grace period after it restarts.
- **Inflation attack**: virtual shares (offset 6, share decimals 12) make a
  donation attack cost the attacker far more than the victim loses. In the test, the attacker burns about $500k and the victim loses under $1.

Known v1 limits:
- The zap swap cost for new deposits (~0.15%) is shared by all holders.
- There is no ERC-4626 `withdraw`/`mint`, because exit output depends on slippage.
- `maxSlippageBps` also caps redeem size (about ≤50k USDC per tx right now), so
  bigger exits need to be split into several calls.
- There is one fixed pool and no migration. Moving to a new strategy means users
  redeem and deposit into a new vault.

## Why these integrations

| Integration | Why |
|---|---|
| **Aerodrome** (router, vAMM-WETH/USDC pool, gauge) | Base's main DEX and liquidity hub. The WETH/USDC gauge is alive and pays **AERO emissions**, which gives the keeper a real reward stream to claim and compound. Staked LPs give up trading fees to veAERO voters in exchange for those emissions. |
| **vAMM (full-range x·y=k), not Slipstream / Uniswap v3** | Full-range liquidity needs no range management. The LP token is a plain ERC-20, and the fair-LP pricing formula is exact for x·y=k. It doesn't hold for concentrated liquidity. Slipstream earns more per dollar but needs active rebalancing, so it's a v2 candidate. |
| **AERO→USDC through the Aerodrome vAMM** | This route is deep: its USDC side held about $18M when checked. Using one router for everything keeps the approvals and code small. |
| **Chainlink ETH/USD, USDC/USD, L2 sequencer uptime** | The standard, well-supported oracles on Base. Using USDC/USD means a USDC depeg is priced in correctly. The sequencer feed is Chainlink's recommended guard for L2s. Pool TWAPs were rejected: they're cheaper to manipulate on a single-sequencer L2 and they lag. |
| **OpenZeppelin v5.1** | Audited ERC20, SafeERC20, Ownable2Step, ReentrancyGuard and Math (mulDiv/sqrt). |

Before mainnet: get an external audit, set up keeper monitoring and alerts (stale
harvests, deviation reverts), and run a capped launch.
