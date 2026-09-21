# Aerodrome USDC/WETH Auto-Compounding Vault — Design

## TL;DR

- Vault stakes its LP tokens in the pool's **Gauge**. Staked LPs earn **AERO emissions only**.
- `harvest()` claims **AERO** from the **Gauge** (`gauge.getReward(address(this))`), sells it for USDC + WETH, adds liquidity, and stakes the new LP again.
- **The vault gets none of the pool's swap fees.** When LP is staked, the Gauge collects the fees and sends them to **veAERO voters** (through `FeesVotingReward`). They are not LP income in this design.

Aerodrome is ve(3,3), which is the opposite of Uniswap: LPs are paid in emissions, and voters are paid in fees and bribes.

---

## 1. Contracts

| Role | Contract | Base address |
|---|---|---|
| Pool (volatile, `stable=false`) | `Pool` (vAMM-WETH/USDC) | look up via `PoolFactory.getPool(WETH, USDC, false)` |
| Pool factory | `PoolFactory` | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Router | `Router` | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Voter | `Voter` | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Gauge | `Gauge` | look up via `Voter.gauges(pool)` |
| AERO | ERC-20 | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| USDC | ERC-20 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | ERC-20 | `0x4200000000000000000000000000000000000006` |

Resolve the pool and gauge addresses onchain in the constructor instead of hardcoding them. In the constructor, also check `Voter.isAlive(gauge)`.

> Note: Aerodrome has also rebranded as **Aero**, but the contracts above are unchanged. Much of the USDC/WETH liquidity is in **Slipstream** (concentrated-liquidity) pools. This doc targets the v2 volatile pool, which uses fungible LP tokens, so ERC-4626 share accounting is simple. For the Slipstream variant, see §6.

## 2. Deposit path

1. User deposits (the asset is the LP token, or USDC with a zap).
2. With a zap: swap about half into WETH, then call `Router.addLiquidity(USDC, WETH, false, ...)`.
3. `gauge.deposit(lpAmount)`. Keep **all** LP staked at all times: unstaked LP earns fees but no AERO, and staked LP earns AERO but no fees.
4. `totalAssets()` = `gauge.balanceOf(address(this))` (plus any idle LP). Do **not** use pool spot reserves to value LP for share pricing, because they can be moved with a flash loan (a loan borrowed and repaid in the same transaction).

## 3. `harvest()` flow

```
keeper → Vault.harvest(minUsdcOut, minWethOut)
  1. gauge.getReward(address(this))        // claim AERO from the Gauge
  2. fee = aero * perfFeeBps / 1e4 → treasury (and optional keeper tip)
  3. Router.swapExactTokensForTokens(AERO → USDC)   // ~half
     Router.swapExactTokensForTokens(AERO → WETH)   // ~half, sized to pool ratio
  4. Router.addLiquidity(USDC, WETH, false, ...)    // mint LP
  5. gauge.deposit(newLp)                           // re-stake
  6. emit Harvested(aeroClaimed, lpAdded)
```

**What it claims, and from where:**
- **Only AERO, and only from the Gauge** (`Gauge.getReward(address)`). The Aerodrome v2 Gauge requires `msg.sender == _account` (or the Voter), so the vault must make this call itself.
- The Voter/Minter sends AERO to the Gauge once per weekly epoch (epochs start Thursday 00:00 UTC). The Gauge then streams it linearly using `rewardRate`. The amount you can claim at any moment is `gauge.earned(address(this))`.
- The vault **does not** call `pool.claimFees()`, because its LP sits in the Gauge and earns no fees. It also does not call `Voter.claimFees` or `claimBribes`, because those are for veAERO NFT holders and the vault has no veNFT.

**Safety:**
- Swaps need `minOut` checked against an oracle (Chainlink ETH/USD, or a TWAP (time-weighted average price) of the AERO pool). Never pass `amountOutMin = 0`, or the swap gets sandwiched (an attacker trades just before and after it).
- Keeper-only, or permissionless with a caller bounty plus oracle-bounded `minOut`.
- Skip the harvest if `earned` is below a threshold. Gas on Base is cheap, but swap slippage and fixed costs still apply.
- Handle leftover USDC/WETH from uneven `addLiquidity` by carrying it into the next harvest.
- If the gauge gets killed (`isAlive == false`), emissions stop. Add a path to unstake and hold plain LP (which then earns fees again).

## 4. What the position actually earns

| Source | Vault gets it? | Notes |
|---|---|---|
| AERO emissions | **Yes**, the only income | Paid in AERO. Must be sold, so returns depend on AERO's price. |
| Pool swap fees | **No** | Go to veAERO voters (§5). |
| Bribes | **No** | Go to veAERO voters. |
| Impermanent loss | **Cost** | USDC/WETH is a volatile pair. IL can wipe out emissions during big ETH moves. |
| Swap slippage on AERO sales | **Cost** | Small on the deep AERO/USDC and AERO/WETH pools, but not zero. |
| Performance fee | **Cost** | Taken from harvested AERO. |
| Keeper gas | **Cost** | Cents per harvest on Base. |

**Emissions APR** (read it live, don't hardcode it):

```
emissionsAPR = gauge.rewardRate() * 365 days * AERO_price
               / (gauge.totalSupply() * LP_price)
```

- This changes **every epoch**, because gauge emissions follow veAERO votes. It also moves with AERO's price and with how much LP is staked in the gauge.
- Real net yield ≈ `emissionsAPR − IL − perfFee − slippage/gas`, and the emissions part is only realized at the AERO price at harvest time.
- Any APR shown in the UI should state these points and should come from live gauge data (or DeFi Llama / the Aerodrome UI for cross-checking), not from a constant.
- Frequent compounding adds a little on top (it helps more at higher APRs), but the main driver is AERO price × votes.

Illustrative example only (hypothetical numbers): with $10M staked in the gauge and 150k AERO/week at $0.80, emissions are ≈ 150k × 0.8 × 52 / 10M ≈ **62% APR, paid in AERO**. A 30% ETH move costs about 3.4% of the position to IL. If AERO falls 40% between accrual and sale, the realized yield falls by the same proportion.

## 5. Where the swap fees go

1. Traders pay the swap fee (a per-pool fee set by the factory, typically about 0.3% on volatile pools). The fee is split off into the pool's separate `PoolFees` contract, **not** added to the reserves, so it does not compound into LP value.
2. Fees are credited to whoever holds the LP tokens. In this design, **the Gauge holds them** (the vault staked them).
3. The Gauge claims those fees (`pool.claimFees()` inside `Gauge._claimFees`) and forwards them to the pool's **`FeesVotingReward`** contract.
4. veAERO holders who voted for this pool during the epoch claim them (pro-rata by vote) via `Voter.claimFees`, after the epoch ends.

So the vault's depositors pay for the fees with IL, and **veAERO voters collect the fees.** In return, the vault receives the AERO emissions those votes directed to the gauge.

Out of scope for v1, but possible: the vault locks part of its AERO into veAERO and votes for its own pool. This gets back part of the fees plus bribes, and it adds weekly voting, NFT custody, and lock-up risk.

## 6. Slipstream (CL) variant differences

- The position is an NFT from `NonfungiblePositionManager`. It is staked in a `CLGauge`, and the claim is `clGauge.getReward(tokenId)`.
- The fee rule is the same: staked liquidity's fees go to `FeesVotingReward` and voters. Emissions go only to in-range staked liquidity.
- The vault needs range management (rebalancing), and share accounting is harder. This is not a trivial swap from the v2 design.

## 7. Risks

- Dependencies: Aerodrome Pool, Gauge, Voter, and Router; the oracle; the AERO price.
- Gauge can be killed. Emissions can drop to near zero if votes move elsewhere.
- IL on USDC/WETH.
- Harvest sandwiching. Mitigated with oracle-bounded `minOut`.
- First-depositor share inflation (ERC-4626). Mitigate with virtual shares/offset or a seed deposit.

## Open questions

- v2 volatile pool or Slipstream CL? (This doc assumes v2.)
- Vault asset: LP token, or USDC with a zap?
- Keeper-only or permissionless `harvest()` with a bounty?
- Performance fee size?
- Lock part of the AERO into veAERO later?
