# USDC Yield Vault on Base: Aerodrome USDC/WETH, v1

Users deposit USDC into an ERC4626 vault. The strategy swaps about half of it to WETH, adds liquidity to the
**Aerodrome volatile USDC/WETH pool** and stakes the LP token in that pool's **gauge**. A keeper calls
`harvest()`. That claims the AERO rewards, sells them for USDC through Aerodrome's AERO/USDC pool and adds
the USDC back into the LP position.

```
src/
  YieldVault.sol                  ERC4626 vault: accounting, profit unlock, keeper, pause, cap
  AerodromeUsdcWethStrategy.sol   zap -> LP -> gauge; harvest AERO -> USDC; Chainlink pricing
  BaseAddresses.sol               every external address, checked onchain 2026-09-21
  interfaces/                     minimal Aerodrome / Chainlink / strategy interfaces
script/Deploy.s.sol
test/YieldVault.fork.t.sol        21 tests on a Base fork (block 51,600,000)
```

## Asset, reward and approval flow

| Step | What happens | Protection |
|---|---|---|
| `deposit` | USDC stays in the vault and is not invested yet | deposit cap, pause, virtual-share offset (blocks the "first depositor" share-price attack) |
| `harvest` → `strategy.harvest` | `gauge.getReward` pays AERO, which is sold for USDC via the vAMM AERO/USDC pool | `minOut` = Chainlink AERO/USD value − `maxSlippageBps` |
| `harvest` → `strategy.invest` | idle USDC → the fee-adjusted swap amount goes to WETH → `addLiquidity` → `gauge.deposit` | refuses to run if pool spot is more than `maxPriceDeviationBps` away from Chainlink. Swap/add mins are based on Chainlink. At most `maxInvestBps` (1%) of the pool's USDC reserve per call |
| `redeem` | idle USDC first. Otherwise unstake → `removeLiquidity` → WETH→USDC | same price-deviation and oracle-based min checks. The person redeeming pays their own exit swap cost, so other holders don't |
| valuation | `2·sqrt(k·p)` "fair LP" price using Chainlink ETH/USD ÷ USDC/USD, never pool spot | a flash swap cannot move `totalAssets` (tested) |

- **Swap fees:** Aerodrome sends the swap fees of *staked* LP to veAERO voters (the gauge's `feesVotingReward`), not to the LP. So the vault's yield is **AERO emissions only**.
- **Unclaimed AERO:** not counted in `totalAssets`.
- **Approvals:** the strategy gives unlimited approval to the Aerodrome router (for USDC, WETH, AERO and LP) and to the gauge (for LP). Both addresses are fixed at deploy (immutable). The vault never approves anyone.
- **Profit unlock:** harvested profit unlocks linearly over `profitUnlockTime` (default 1 day). Without this, someone could deposit just before a harvest, take yield earned by earlier depositors, and leave.

## Integration selection: evidence from 2026-09-21

All values were read onchain from Base (chain 8453) around block 51.60M. Volume = sum of `Swap` events over
blocks 51,560,926 to 51,604,127 (about 24 h).

| Candidate | TVL | 24h volume | Incentives | Verdict |
|---|---|---|---|---|
| **Aerodrome vAMM USDC/WETH** `0xcDAC…5C43` (fee 30 bps) | 1,661 WETH + 4.54M USDC ≈ $9.1M | $0.42M (5,833 swaps) | gauge `0x519B…C025` `isAlive=true`, 0.0296 AERO/s ≈ 17.9k AERO/wk ≈ $12.3k/wk at $0.686, about **7% APR**. 98.7% of LP is staked | **Selected** |
| Aerodrome Slipstream CL USDC/WETH, tickSpacing 100, `0xb2cc…DC59` | 1,255 WETH + 5.62M USDC ≈ $9.0M | $32.0M (15,780 swaps) | gauge `0xF33a…0Cd9` alive, 0.270 AERO/s ≈ 163k AERO/wk (**~9× vAMM**) | Deferred to v2 |
| Uniswap v3 USDC/WETH 0.05% `0xd0b5…F224` | 1,527 WETH + 5.24M USDC | not measured | none (fees only) | Rejected: no reward stream to harvest, and needs a price range |

**Why the vAMM pool plus gauge for v1:**
- **Nothing to manage:** the LP token is an ordinary token that covers every price, so there is no price range to maintain and no NFT position. Share accounting stays simple, and a fair LP price can be computed from Chainlink.
- **Real rewards to harvest:** the gauge is live and paying AERO emissions, so there is something to claim and compound.
- **Reward sale route:** vAMM AERO/USDC `0x6cDc…971d` holds 18.1M USDC and 26.2M AERO, so daily AERO sales barely move the price.
- **Oracles exist for every asset:** Chainlink ETH/USD `0x7104…Bb70`, USDC/USD `0x7e86…bc6B`, AERO/USD `0x4EC5…fF0` (all 8 decimals, updated within the last hour) and the L2 sequencer uptime feed `0xBCF8…6433`.
- **Signatures verified:** router/gauge function signatures were checked against deployed bytecode, and pool/gauge wiring is checked in the constructor and in `test_liveIntegrationAssumptions`.

**Trade-offs to know:**
- **Emissions are small:** the vAMM pool's emissions are ~9× smaller than the CL pool's for similar TVL. It also has little trading of its own ($0.42M/day), so its APR depends almost entirely on weekly veAERO votes and could drop in any epoch. Epochs flip Thursday 00:00 UTC; the current one ends at `periodFinish` 1790208000.
- **Emissions vs fees:** staking gives up the ~5% APR in swap fees the LP would otherwise earn, in exchange for ~7% in emissions. If votes drop, unstaked LP could earn more.
- **The pool is shallow for large amounts:** a $100k one-shot zap loses ~1.4% (0.3% fee + ~1.1% price impact) and fails the 1% slippage guard. That's why invests are capped per call. Redemptions above ~$60k at once also exceed the guard: users should redeem in chunks, or the owner can loosen `maxSlippageBps` (hard max 5%). Keep the `depositCap` modest (deploy default: $100k).
- **v2 idea:** move to the Slipstream CL gauge. It needs range management and rebalancing.

## Build and test

```bash
forge build
forge test                                   # uses the cached fork state after the first run
BASE_RPC_URL=<archive Base RPC> forge test   # first run; public endpoints rate-limit, so add -j 1 if needed
```

The tests cover:
- deposit → invest → stake, and compounding AERO after 1 day
- chunked investing, redeem round trip (<1% cost), and exit cost not spread to other holders
- profit unlock stopping a deposit made just before a harvest from getting instant profit
- pool manipulation → revert, and flash swaps not moving `totalAssets`
- stale oracle, sequencer down, killed gauge (LP kept unstaked), emergency exit then redeem
- access control, cap/pause, and the first-depositor share-price attack

The fork has no arbitrage bots, so the tests' time-skip helper moves the pool back to the Chainlink price.

## Deployment

```bash
export OWNER=0x...        # multisig
export KEEPER=0x...       # keeper EOA / automation address
export DEPOSIT_CAP=100000000000   # 100k USDC (6 decimals)
forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify --account deployer
```

The script:
1. Deploys the vault (owned by the deployer at first).
2. Deploys the strategy (owned by `OWNER`).
3. Links them with `setStrategy`. This can only happen once.
4. Starts vault ownership transfer to `OWNER`.

After deploy:
- `OWNER` calls `vault.acceptOwnership()`.
- Re-run `test_liveIntegrationAssumptions` against the latest block, or check that `voter.isAlive(gauge)` is true.

## Keeper operation

- **What to call:** `vault.harvest()` (keeper or owner only). It claims and sells AERO, invests idle USDC (up to 1% of the pool's USDC reserve per call), and locks the profit for 1 day.
- **How often:** about every 4–24 h. Call more often (e.g. hourly) while `usdc.balanceOf(strategy) + usdc.balanceOf(vault) > minInvest`, since that means deposits are waiting. Skip if `strategy.pendingRewards()` is worth less than gas and nothing is idle.
- **Simulate first:** run `eth_call` before sending. Expected reverts are safe; just retry later:
  - `PoolPriceDeviation`: the pool moved away from Chainlink (volatility or manipulation). Wait for arbitrage.
  - `StaleOracle` / `SequencerDown`: the oracle is stale or Base's sequencer was recently down. Wait.
  - Router slippage revert (`B0#`, insufficient output): the trade is too large or the price is moving. Retry, or lower `maxInvestBps`.
- **Emergency** (owner):
  1. `vault.pause()`: stops deposits and investing; withdrawals stay open.
  2. `strategy.emergencyExit(minWeth, minUsdc)`: unstakes and burns all LP.
  3. If needed, `strategy.emergencySwapWeth(amount, minOut)` sells WETH with limits the owner supplies, so it works even if the oracles are down.

  Users then redeem from idle USDC.
- **Monitor:** gauge `isAlive`, weekly `rewardRate`, pool TVL/volume, and how far pool spot is from Chainlink.

## Known v1 limitations

- **`redeem` can pay slightly less than `previewRedeem`** (exit swap cost goes to the person redeeming). `withdraw(assets)` reverts instead of paying less. This departs from the ERC4626 standard, so integrators should use `redeem`.
- **Oracle outage blocks the vault:** `totalAssets()` needs fresh Chainlink data, so deposits and redemptions revert while an oracle is stale, unless all assets are already in USDC after an emergency exit.
- **One strategy, no migration path, no fees, not audited.**
