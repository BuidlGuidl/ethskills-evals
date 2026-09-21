# Aero USDC-WETH Vault (v1, Base)

ERC-4626 vault. Users deposit USDC. The strategy pairs it with WETH in the Aerodrome
**vAMM-WETH/USDC** pool, stakes the LP in the pool's gauge, and a keeper calls `harvest()` to
claim AERO emissions, sell them for USDC, and reinvest.

```
src/AeroUsdcWethVault.sol          vault + strategy (one contract)
src/interfaces/                    minimal Aerodrome + Chainlink interfaces
script/BaseAddresses.sol           Base mainnet addresses (checked on-chain)
script/Deploy.s.sol                deployment
script/Harvest.s.sol               keeper harvest
test/AeroUsdcWethVault.t.sol       unit tests (mock Aerodrome/Chainlink)
test/AeroUsdcWethVault.fork.t.sol  end-to-end test against real Base contracts
```

```bash
forge build
forge test                                                   # unit tests; fork test is skipped
BASE_RPC_URL=https://mainnet.base.org forge test --mt testFork -vv   # Base fork test
```

## How it works

| Step | What happens |
|---|---|
| `deposit` / `mint` | USDC sits idle in the vault until the next harvest. Blocked when paused or over `depositCap`. |
| `harvest(minUsdcOut)` (keeper) | `gauge.getReward` → sell all AERO for USDC via the AERO/USDC pool (reverts under `minUsdcOut`) → send `performanceFeeBps` (10%) of it to `treasury` → invest idle USDC above the 5% buffer: swap half to WETH, `addLiquidity`, stake LP in the gauge. |
| `withdraw` / `redeem` | Paid from idle USDC first. If that's not enough, the vault unstakes and removes just enough LP (+ slippage margin), and sells the WETH for USDC. Works while paused. |
| `emergencyExit(minUsdcOut)` (owner) | Pauses, removes all LP, sells all WETH. Uses no oracle, so it works if Chainlink is down. `minUsdcOut` covers only the USDC from the unwind (idle buffer not included). |

### Safety

- **Share price can't be moved by trading in the pool.** LP is valued with "fair LP pricing":
  `2 * sqrt(reserveWETH * reserveUSDC * P) * lp / totalSupply`, where `P` is the Chainlink ETH/USD ÷ USDC/USD price.
  A swap in the pool changes the reserve ratio but not `k`, so the value stays the same. There's a test for this.
- **Trades are checked against the oracle.** Invest and unwind revert if the pool's spot price is more than
  `maxDeviationBps` (1%) away from Chainlink. Every USDC↔WETH swap has a `minOut` based on the oracle, and
  the vault's total value may drop by at most `maxSlippageBps` (1%) of the amount moved.
- **Invest size is limited by pool depth.** Each harvest swaps at most 0.25% of the pool's USDC reserve.
  Larger idle balances go in over several harvests.
- **Oracle checks:** stale-price limits (ETH/USD 25 min vs. 20 min heartbeat; USDC/USD 25 h vs. 24 h),
  plus the Base sequencer uptime feed with a 1 h grace period after restart.
- **Exit fee** (0.30%, max 1%) stays in the vault for the remaining holders. It pays for unwind costs
  and makes it unprofitable to deposit just before a harvest and leave just after (tested).
- **First-depositor share inflation** is blocked by OZ virtual shares (`_decimalsOffset = 6`).
- Setters have hard caps. Ownership uses `Ownable2Step`. Pausing stops deposits and investing, never withdrawals.

## Deployment (Base, chain 8453)

```bash
export OWNER=0x...        # multisig (Safe)
export KEEPER=0x...       # hot keeper EOA
export TREASURY=0x...     # receives performance fee (USDC)
export DEPOSIT_CAP=250000000000   # 250k USDC (6 decimals); start small

forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify \
  --account deployer    # or --ledger
```

The script refuses to run on other chains. It also reads the gauge from the Aerodrome Voter
(`voter.gauges(pool)`), checks it matches the hard-coded address, and checks it is alive. The vault constructor checks
the pool tokens and that the pool is volatile, the gauge's staking and reward tokens, and the token and feed decimals.

After deploying: run the fork test against the deployed parameters, deposit a small amount, run one
harvest, redeem, then raise `depositCap` step by step. **Keep TVL small relative to pool depth.** The pool
holds about $9M. A withdrawal whose WETH sale moves the price more than ~1% will revert (`SlippageExceeded`),
so big holders have to exit in parts.

## Keeper operation

```bash
export VAULT=0x...
export AERO_USD_PRICE=680000   # USDC per AERO, 6 decimals, from an off-chain source (CEX / aggregator)
forge script script/Harvest.s.sol --rpc-url $BASE_RPC_URL --broadcast --account keeper
```

- The script reads pending AERO and gets an on-chain quote. It **refuses to sell** if the quote is more than 3×
  the slippage below the off-chain price. Otherwise it sets `minUsdcOut = min(quote, offchain) × (1 − 1%)`.
  The vault does not use an on-chain AERO oracle, so the off-chain price is the anchor. Never call `harvest(0)` when there are
  rewards to sell.
- **Frequency:** every 12–24 h, or when pending AERO is worth ≥ ~20× the gas cost. Gas on Base is cheap, but
  harvesting more often puts more USDC through the swap fee without much gain. Harvest soon after large
  deposits so the idle USDC gets invested (at most 0.25% of pool reserves per call).
- **When `harvest` reverts:**
  - `PriceDeviation`: the pool is off the oracle price. Wait for arbitrageurs to fix it.
  - `StaleOracle` / `SequencerDown`: wait for Chainlink or the sequencer.
  - `INSUFFICIENT_OUTPUT_AMOUNT`: recheck the AERO price.
- **Monitor:** `Harvested`, `Invested`, `Unwound` events. Watch `totalAssets()` against the sum of deposits,
  and `voter.isAlive(gauge)`. If the gauge is killed or the pool is compromised, the owner calls `pause()` and then
  `emergencyExit(minUsdcOut)`.
- The keeper key can only call `harvest` and cannot move funds. The worst a leaked keeper key can do is a bad AERO sale,
  capped by the rewards pending at that moment. Rotate it with `setKeeper`.

## Why these integrations

- **Aerodrome (Aero) as the DEX.** It is the largest DEX on Base, bigger than Uniswap there. Its gauges pay AERO
  emissions to staked LPs, which is the "earnings" `harvest()` claims and compounds. Note: in Aerodrome's ve(3,3)
  model, **staked LPs earn AERO, not trading fees**. Fees go to veAERO voters. So all of the yield is AERO,
  sold at harvest.
- **Basic volatile pool (vAMM) instead of Slipstream (concentrated liquidity).** The v1 tradeoff is less
  capital efficiency in exchange for:
  - a fungible ERC-20 LP (simple ERC-4626 accounting),
  - no price range to manage or rebalance keeper to run,
  - a closed-form fair-value formula that can't be manipulated.
  
  Slipstream WETH/USDC pools are deeper and get more emissions, so they are the natural v2 once range
  management and NFT-position valuation are audited.
- **Router `0xcF77…4E43`**, the canonical Aerodrome router, used for swaps and liquidity changes (the vault
  checks outcomes itself against the oracle). The AERO→USDC sale goes through the vAMM AERO/USDC pool (about $36M).
- **Chainlink ETH/USD + USDC/USD + L2 Sequencer Uptime feed.** These are the standard, battle-tested oracles on Base.
  They are needed to value the position and to bound slippage without trusting pool spot prices. USDC/USD is
  included so the vault accounts correctly if USDC depegs.
- **OpenZeppelin v5.4** (ERC4626, SafeERC20, Ownable2Step, Pausable, ReentrancyGuard). These are audited
  building blocks, so there is no custom share math.

All addresses in `script/BaseAddresses.sol` were checked on Base on 2026-09-21: `factory.getPool`,
`voter.gauges`, `voter.isAlive`, `gauge.stakingToken/rewardToken`, and feed `description()`.

## Known limitations (v1)

- One contract holds both the vault and the strategy. To migrate, users withdraw and deposit into v2
  (or the owner runs `emergencyExit`, which leaves funds in USDC).
- Unwind costs above the exit fee are shared by the remaining holders, capped by `maxSlippageBps`.
- Harvest profit is added to the share price all at once, not spread out over time. The exit fee is what
  makes timing a deposit around a harvest unprofitable. Add profit streaming if the harvest size grows compared
  to the exit fee.
- The vault has no AERO oracle, so the reward sale relies on the keeper's `minUsdcOut`.
- Impermanent loss against WETH is real. Depositors take on ETH price exposure through the LP. This is not a
  delta-neutral product.
- Not audited.
