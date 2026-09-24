# Aerodrome USDC/WETH Yield Vault Design

## Scope

The vault LPs into Aerodrome Slipstream on Base, using the CL100 WETH/USDC pool:

| Item | Address / value |
| --- | --- |
| Pool | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` |
| Gauge | `0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8` |
| Position manager | `0x827922686190790b37229fd06084350E74485b72` |
| Reward token | AERO, `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Token0 | WETH, `0x4200000000000000000000000000000000000006` |
| Token1 | USDC, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Tick spacing | `100` |
| FeeVotingReward | `0x765d935C2F47a06EdA55D07a9b9aE4108F4BBF85` |

Snapshot notes from Base RPC reads on 2026-09-22, block `51645306`: the pool is linked to the gauge above, `isPool()` is `true`, `rewardToken()` is AERO, `left()` was about `34,596 AERO`, `rewardRate()` was about `0.269843 AERO/sec`, and the pool swap fee was `639` pips, or about `0.0639%`.

## Position Lifecycle

Deposits are converted into the pool's required WETH/USDC amounts, then the vault mints one or more Slipstream NFT positions through `NonfungiblePositionManager.mint(...)`. The vault approves the Aerodrome CL gauge for each NFT and stakes it with:

```solidity
ICLGauge(CL100_WETH_USDC_GAUGE).deposit(tokenId);
```

Use `deposit(tokenId)`. Do not transfer the NFT directly to the gauge. The gauge deposit path records the stake, moves the position's liquidity into the gauge accounting, and starts AERO emission accounting for that token id.

## `harvest()` Flow

`harvest()` claims only AERO emissions from the CL gauge. It does not claim WETH/USDC swap fees.

1. Keeper calls `harvest(uint256[] tokenIds, HarvestParams params)`.
2. The vault verifies each `tokenId` is a vault-owned staked position, for example with `CLGauge.stakedContains(address(this), tokenId)`.
3. For each staked NFT, call:

```solidity
ICLGauge(CL100_WETH_USDC_GAUGE).getReward(tokenId);
```

This is the important claim. It is called on the Aerodrome CL100 WETH/USDC gauge at `0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8`, and it transfers owed AERO emissions to the vault. The claim is keyed by Slipstream NFT id, not by vault address.

4. Measure `AERO.balanceOf(address(this))` before and after the claims to get harvested rewards.
5. Optionally reserve configured performance / keeper fees in AERO or after swapping.
6. Swap the remaining AERO into WETH and USDC using bounded slippage and deadline checks. The split should target the selected tick range's current required token ratio, not a hard-coded 50/50 split.
7. Compound by minting an additional WETH/USDC CL position through the position manager with the strategy's current range, then stake that new NFT into the same gauge with `deposit(newTokenId)`.
8. Keep any WETH, USDC, or AERO dust as idle vault balances for the next harvest or deposit.

The design compounds with additional staked NFTs. A staked NFT is owned by the gauge, so the vault should not assume it can directly increase liquidity on that existing NFT via the position manager. A separate rebalance routine can later withdraw, remint, and restake if the strategy wants to consolidate NFTs or move ranges.

`harvest()` should not call:

- `NonfungiblePositionManager.collect(...)` for staked positions as a fee-harvest step.
- `FeeVotingReward.getReward(...)`; that is for veAERO voters, not LP stakers.
- `Voter.claimBribes(...)` or `Voter.claimFees(...)`; the vault is not voting in this design.

## Realistic Earnings Breakdown

The staked position earns:

- **AERO emissions.** This is the vault's primary yield source. Emissions are streamed by the CL gauge and are claimable per staked NFT with `getReward(tokenId)`. The allocation changes weekly based on veAERO votes and gauge distribution. At the snapshot above, the full-epoch reward pace implied about `163,201 AERO/week`. Using a contemporaneous AERO/USDC market price around `$0.6874`, that is about `$112k/week` of AERO distributed by the gauge before any vault-specific share calculation.
- **Only active-range participation.** Slipstream rewards accrue to liquidity that is in range while the pool trades. A narrow range can earn a larger share while active, but earns nothing from emissions when price leaves the range.
- **WETH/USDC inventory exposure.** Users are exposed to ETH price movement and concentrated-liquidity inventory changes. If ETH rises or falls through the range, the vault's position shifts toward one asset and may underperform simply holding the original assets.
- **Compounding uplift.** Harvested AERO is converted back into WETH/USDC and staked as more CL liquidity, increasing future emission share. This uplift is reduced by swap slippage, gas, keeper fees, performance fees, and any idle dust.

A realistic public-market snapshot shows why the pool is attractive but also why APR should not be treated as fixed: DexScreener showed roughly `$12.0m` liquidity and `$28.2m` 24h volume for this pool around the same time. At the onchain `0.0639%` swap fee, the pool was producing roughly `$18.0k/day` of gross swap fees. In this staked-vault design, that fee production helps attract veAERO votes and therefore AERO emissions, but it is not directly paid to the vault.

## Where Swap Fees Go

Aerodrome has an explicit tradeoff:

- Unstaked LP positions can collect swap fees.
- Staked LP positions forgo swap fees and receive AERO emissions instead.

Because this vault stakes its Slipstream NFTs in the CL gauge, the vault's WETH/USDC swap-fee entitlement is routed away from the vault. For staked liquidity, the pool tracks the fee amounts owed to the gauge side. When emissions are distributed to the gauge, the gauge claims those pool fees and forwards WETH/USDC to the linked `FeeVotingReward` contract. That contract distributes the fees to veAERO voters who voted for this pool, generally in the following epoch.

So, in this design:

- Users do receive compounded AERO emission yield.
- Users do not receive the pool's WETH/USDC swap fees.
- The pool's swap fees end up with veAERO voters for the WETH/USDC gauge, unless the vault also runs a separate veAERO voting strategy, which is intentionally out of scope here.

## Sources Checked

- Aerodrome security / deployment page: https://aerodrome-finance.app/security/
- Aerodrome protocol specification, especially gauge and fee voting reward routing: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome Slipstream specification, especially staked CL fee/emission behavior: https://raw.githubusercontent.com/aerodrome-finance/slipstream/main/SPECIFICATION.md
- Aerodrome Slipstream `ICLGauge` interface: https://raw.githubusercontent.com/aerodrome-finance/slipstream/main/contracts/gauge/interfaces/ICLGauge.sol
- Aerodrome Slipstream position manager source: https://raw.githubusercontent.com/aerodrome-finance/slipstream/main/contracts/periphery/NonfungiblePositionManager.sol
- BaseScan gauge page: https://basescan.org/address/0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8
- DexScreener pair API snapshot: https://api.dexscreener.com/latest/dex/pairs/base/0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59
