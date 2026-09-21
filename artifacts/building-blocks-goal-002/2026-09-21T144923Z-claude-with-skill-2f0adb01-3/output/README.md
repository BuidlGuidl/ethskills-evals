# Aero USDC-WETH Yield Vault (Base) — v1

Users deposit USDC into an ERC-4626 vault. The strategy pairs it with WETH in the **Aerodrome volatile WETH/USDC pool**, stakes the LP in the pool's **gauge**, and a keeper calls `harvest()` to claim AERO emissions, sell them for USDC and compound.

```
src/
  YieldVault.sol                  ERC-4626 vault: shares, profit locking, pro-rata exits, keeper/admin
  AerodromeUsdcWethStrategy.sol   LP + gauge + oracle pricing, only callable by the vault
  interfaces/                     minimal Aerodrome / Chainlink / strategy interfaces
script/Deploy.s.sol               Base deployment
script/BaseAddresses.sol          Base addresses (verified onchain 2026-09-21)
test/YieldVault.t.sol             unit + attack + fuzz tests against mocks
test/fork/BaseFork.t.sol          end-to-end test on a Base fork (real Aerodrome + Chainlink)
```

## Build and test

```sh
forge build
forge test                                           # unit tests; the fork test skips
BASE_RPC_URL=https://mainnet.base.org forge test     # also runs the fork test
```

## How it works

| Step | What happens |
|---|---|
| `deposit` | USDC stays idle in the vault. Shares are priced from `totalAssets()`. |
| `harvest(minUsdcFromRewards)` (keeper) | Sends idle USDC to the strategy → claims AERO → sells it for USDC (checked against `minUsdcFromRewards`) → swaps to a ~50/50 split → adds liquidity → stakes the LP. At most `maxInvestPerHarvest` (default 20k USDC) is deployed per call. |
| `redeem` / `withdraw` | Pays out the caller's share of idle USDC plus the matching slice of the LP position, turned back into USDC. The person leaving pays their own swap fee and slippage. `redeem` pays out **≥ `previewRedeem`**, which is fair value minus `withdrawSlippageBps` (default 1%). |
| `shutdown(minOut)` (owner) | Converts the whole position back to USDC and blocks new deposits and harvests. Withdrawals stay open and no longer depend on the oracle. |

### Safety choices
- **LP valued from the oracle price, not the pool's current price.** The LP is valued as `2·sqrt(k·p)` using the Chainlink ETH/USD price. Someone who moves the pool's price can't move the vault's share price (see `test_poolManipulationDoesNotMoveSharePrice`).
- **Price checks against Chainlink:** swaps must get at least the oracle value minus 1%. Liquidity is only added when the pool price is within 1% of the oracle, and the LP tokens received must be worth at least the value put in, minus 1%.
- **Sequencer and staleness checks:** reads fail if the Base sequencer is down, has restarted within the last hour, or the price is more than 1h old.
- **Profit unlocks gradually:** harvest profit is added to the share price over 6h. Depositing just before a harvest and withdrawing just after doesn't pay.
- **Protection against the first-depositor share-inflation trick:** the ERC-4626 decimals offset is 6.
- **Guarded launch:** `depositCap` (default 50k USDC in the deploy script).
- **Strategy access:** only the vault can call the strategy. The strategy can be set once. Ownership changes use a two-step transfer.

## Deployment (Base, chain 8453)

```sh
export OWNER=0x...        # multisig: admin for vault + strategy
export KEEPER=0x...       # keeper EOA / automation address
export DEPOSIT_CAP=50000000000   # 50k USDC (6 decimals)

forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify \
  --account <keystore> --sender <deployer>
```

The script:
1. Looks up the vAMM WETH/USDC pool with `PoolFactory.getPool(WETH, USDC, false)` and its gauge with `Voter.gauges(pool)`, and checks the gauge is alive.
2. Deploys `YieldVault` with the deployer as owner.
3. Deploys the strategy, owned by `OWNER`.
4. Links the strategy to the vault, then starts transferring vault ownership to `OWNER`.

**Afterwards:** `OWNER` must call `vault.acceptOwnership()`. After that, raise `depositCap` step by step.

Addresses used (each checked onchain):

| | Address |
|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| vAMM-WETH/USDC pool (resolved at deploy) | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| its gauge (resolved at deploy) | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |
| Chainlink L2 Sequencer Uptime | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` |

## Keeper operation

Call `vault.harvest(minUsdcFromRewards)` from `KEEPER` (the owner can also call it).

1. `pending = strategy.pendingRewards()`. This is unclaimed AERO.
2. Get an off-chain quote: `router.getAmountsOut(pending, [(AERO, USDC, false, factory)])`. Set `minUsdcFromRewards = quote * 0.99`. There is no reliable onchain AERO price feed, so the keeper supplies this minimum. Do not compute it inside the same transaction.
3. Send the transaction:
   ```sh
   cast send $VAULT "harvest(uint256)" $MIN_OUT --rpc-url $BASE_RPC_URL --account keeper
   ```

**When to call it:**
- **Every 12–24h.** Gas on Base is cents. Each harvest also restarts the 6h profit unlock.
- **Again after large deposits.** Each call deploys at most `maxInvestPerHarvest`. Keep calling until `usdc.balanceOf(strategy)` is small. Allow a few blocks between calls so arbitrage brings the pool price back into line.

**If harvest reverts:**

| Revert | Meaning | What to do |
|---|---|---|
| `PriceDeviation` | Pool price is more than 1% from the oracle | Wait and retry |
| `StaleOracle` / `SequencerDown` | Chainlink feed is stale, or the sequencer is down or in its grace period | Wait |
| `INSUFFICIENT_OUTPUT_AMOUNT` | A swap missed its minimum output | Re-quote and retry |

**Monitor:** the `Harvest(profit, invested, totalAssets)` event, `vault.totalAssets()`, whether the gauge is still alive (`Voter.isAlive(gauge)`), and how deep the pool is.

**Emergency:** the owner calls `vault.shutdown(minUsdcOut)`. `minUsdcOut` is the minimum USDC to accept, computed off-chain, since the oracle may be the thing that broke.

**Tuning (owner):**
- `strategy.setParams(slippageBps, deviationBps, oracleMaxAge, gracePeriod)`
- `strategy.setMaxInvestPerHarvest`
- `vault.setWithdrawSlippageBps`
- `vault.setProfitUnlockTime`
- `vault.setDepositCap`
- `vault.setKeeper`

## Why these integrations

- **Aerodrome (Aero) as the DEX.** It is Base's main DEX and has the most USDC/WETH liquidity and emissions there. On Aerodrome, staked LPs earn **AERO emissions** instead of trading fees (fees go to veAERO voters). That gives the keeper a concrete reward to claim and compound, which matches the "harvest and compound" design. Uniswap on Base would pay only trading fees, which pile up inside the position rather than being claimed.
- **The volatile (vAMM) WETH/USDC pool, not the concentrated-liquidity (Slipstream) pools.** A vAMM position is a plain ERC-20 LP token, so it's easy to split between depositors and needs no price-range management. Its value can also be computed with the oracle formula above, which makes share pricing resistant to manipulation. Slipstream pools are deeper and earn more per dollar, but they need range rebalancing, NFT positions and harder valuation. That's a good v2 upgrade.
- **AERO sold through the AERO/USDC vAMM pool.** It's the deepest direct AERO→USDC route on Aerodrome (~$18M USDC side at deploy time), so the sale takes one hop through the same router.
- **Chainlink ETH/USD plus the L2 Sequencer Uptime feed.** This is the standard manipulation-resistant price source on Base. The uptime feed avoids trusting stale prices while the sequencer is down.
- **OpenZeppelin v5.4 ERC-4626.** Audited, standard vault interface, and has the virtual-share offset built in.

## Known limitations / v1 assumptions

- **Pool depth.** The pool had ~$9M TVL at deploy time. Swapping half of each harvest's deposits costs ~0.3% fee plus price impact, and every depositor shares that cost. Keep `depositCap` and `maxInvestPerHarvest` small compared with pool depth.
- **USDC assumed = $1.** ETH/USD is used as the ETH/USDC price. If USDC loses its peg, the price checks would reject swaps and harvest/withdraw would revert, but nothing would be mispriced silently.
- **Impermanent loss.** Depositors are exposed to ETH price moves through the pool: they bear impermanent loss (value lost vs just holding the two tokens). Emissions may not cover it.
- **Withdrawals depend on the oracle** while the strategy holds LP. If Chainlink is stale or the sequencer is down, withdrawals revert until it recovers or the owner calls `shutdown`.
- **Small leftover amounts.** Pool fees leave small USDC/WETH dust in the strategy. It still counts in `totalAssets` and gets reinvested on the next harvest.
- **Not included in v1:** performance fee, multiple strategies, and an audit. Get an audit before raising the cap beyond test amounts.
