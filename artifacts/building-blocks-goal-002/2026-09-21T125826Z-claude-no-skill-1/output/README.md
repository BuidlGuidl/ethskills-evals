# Aerodrome USDC/WETH Yield Vault (Base) — v1

Users deposit USDC. A keeper pairs it with WETH in the Aerodrome **vAMM WETH/USDC** pool, stakes the LP in
the pool's **gauge**, and calls `harvest()` to claim AERO, sell it for USDC and reinvest.

Contract: `src/AeroUsdcWethVault.sol` (one contract: vault + strategy, shares are an ERC20 `aeroUSDC`).

## How it works

| Action | Who | What happens |
|---|---|---|
| `deposit(assets, receiver)` | anyone | USDC pulled in and shares minted at `totalAssets()`. USDC waits idle until the next harvest. |
| `harvest(minUsdcFromRewards, maxInvestUsdc)` | keeper / owner | `gauge.getReward` → sell AERO→USDC → swap ~half of idle USDC to WETH → `addLiquidity` → stake LP. |
| `redeem(shares, receiver, owner, minUsdcOut)` | holder | Burns shares, unwinds the pro-rata slice of idle + LP, sells the WETH side, pays USDC. |
| `redeemInKind(shares, receiver, owner, minUsdc, minWeth)` | holder | Same slice, paid as USDC + WETH. No oracle, no swap. Works when paused or feeds are down. |
| `emergencyExit(minUsdc, minWeth)` | owner | Unstake + remove all liquidity, pause. Users still exit via both redeem paths. |

**Pricing / safety model**
- `totalAssets()` = idle USDC + idle WETH + LP, priced with Chainlink. LP uses the "fair reserves" formula
  `2·sqrt(k·P)`, so moving the pool ratio (flash loan, big swap) does not move the share price.
- Exits are pro-rata of real holdings, so they don't depend on valuation at all.
- Every swap and liquidity add is checked against Chainlink: pool spot must be within `maxSlippageBps`
  (default 1%, hard cap 5%) of the oracle, and swap outputs must be ≥ oracle value − `maxSlippageBps`.
  `redeem` also checks total USDC out ≥ oracle value of the slice − `maxSlippageBps`.
- Chainlink checks: answer > 0, staleness per feed, Base L2 sequencer uptime feed + 1h grace period.
- First-depositor inflation attack blocked by a virtual-share offset (1e12).
- Owner can't move user funds: only keeper, cap, slippage (capped), reward route (only Aerodrome-factory
  pools, must go AERO→…→USDC), pause, emergency exit, and sweep of non-vault tokens.

## Build & test

```bash
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0   # lib/ is not committed
forge build
forge test                                                                       # unit tests (mocks), fork test is skipped
BASE_RPC_URL=https://mainnet.base.org forge test --match-path 'test/fork/*'      # real Aerodrome + Chainlink on a Base fork
```

## Deployment

Addresses live in `script/BaseAddresses.sol` (checked onchain; the gauge is read from the Aerodrome Voter at
deploy time and the constructor re-checks router→pool, pool→gauge, gauge→AERO, token decimals).

```bash
export BASE_RPC_URL=...
OWNER=<multisig> KEEPER=<keeper EOA> DEPOSIT_CAP=100000000000 \
  forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --account deployer
```

- `OWNER` should be a Safe (ideally behind a timelock). Ownership uses 2-step transfer.
- `DEPOSIT_CAP` is in USDC wei (6 decimals). Default 100k USDC — start small, raise with `setDepositCap`.
- After deploy: small deposit → `harvest` → `redeem` round trip before announcing.

## Keeper operation

Run from a dedicated EOA set via `setKeeper` (it can only harvest; worst case a compromised keeper sells AERO
at a bad price, bounded by what it passes as `minUsdcFromRewards`).

Each run:
1. Read `pendingRewards()` (AERO) and quote AERO→USDC off-chain (e.g. `router.getAmountsOut` on the stored
   route). Set `minUsdcFromRewards = quote × (1 − 0.5–1%)`. There is no AERO Chainlink feed in the vault, so
   this number is the only protection for the reward sale — never pass 0 when there are rewards.
2. Choose `maxInvestUsdc` so the USDC→WETH swap (≈ half of it) stays well under the 1% bound. The vAMM
   pool holds ~$9M, so ~$20–40k per call is safe; call repeatedly (next block) for larger idle balances.
3. Send `harvest(minUsdcFromRewards, maxInvestUsdc)`. Simulate first (`eth_call`); a revert with
   `PoolPriceDeviation`, `StaleOracle` or `SequencerDown` means "skip and retry later", not "raise slippage".
4. Cadence: every 12–24h, or when rewards ≥ a few × gas cost. Also run after large deposits.
   AERO emissions switch each Thursday 00:00 UTC epoch; one harvest after the flip is worthwhile.
5. Alert on: consecutive reverts, `Harvest.totalAssetsAfter` dropping, idle USDC > ~5% of TVL for long.

## Why these integrations

- **Aerodrome (DEX + gauge)** — the largest DEX on Base by TVL and volume, and the one with the most
  emissions. Staked LP earns AERO emissions (trading fees of staked LP go to veAERO voters), which is exactly
  the "claim and compound" loop. The **vAMM (x·y=k)** pool was picked over Slipstream (concentrated
  liquidity) because it's full-range — no range management, no rebalancing keeper, no out-of-range periods —
  and its math allows manipulation-resistant fair LP pricing. The router is Aerodrome's own, so swaps go
  through the same audited contracts; reward routes are restricted to Aerodrome's default factory.
- **Chainlink ETH/USD + USDC/USD + L2 sequencer feed** — the standard, battle-tested price source on Base.
  Used for share pricing and to bound every swap/LP add. Dividing by USDC/USD keeps pricing correct in a USDC
  depeg. The sequencer feed stops pricing while Base is down and for 1h after restart.
- **OpenZeppelin v5** — ERC20, SafeERC20, Ownable2Step, Pausable, ReentrancyGuard, Math (mulDiv/sqrt).
- **Not used**: pool spot / TWAP for pricing (spot is flash-manipulable; Aerodrome's TWAP is coarse), external
  aggregators (extra trust + integration surface; Aerodrome routes are enough for AERO and WETH on Base).

## Known limitations (v1)

- Not ERC-4626: `redeem` takes a `minUsdcOut` and exits are pro-rata and bear swap costs, which doesn't fit
  4626 preview semantics. Can be wrapped later.
- No performance/management fee.
- Deposits earn nothing until the next harvest invests them; they also don't pay for the entry swap
  (that cost is shared by all holders at harvest).
- When pool spot drifts from the oracle, fair-LP value is slightly below the in-kind value
  (≈ deviation²/8 of LP value, ~0.001% at a 1% gap), so a deposit→`redeemInKind` round trip can gain a
  negligible amount. Covered by the fuzz test's tolerance.
- vAMM LP has impermanent loss against holding USDC; the vault's USDC value moves with ETH.
- Unclaimed AERO isn't counted in `totalAssets()` (conservative).
- Not audited.
