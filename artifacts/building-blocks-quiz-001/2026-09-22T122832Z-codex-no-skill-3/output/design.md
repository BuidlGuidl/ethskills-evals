# USDC Yield Vault Design

## Summary

The vault accepts native USDC on Base and deploys it into the Aerodrome Slipstream WETH/USDC concentrated liquidity pool. The vault stakes its Slipstream position NFT in the pool gauge, earns AERO emissions, and compounds those emissions back into the WETH/USDC position when a keeper calls `harvest()`.

This design deliberately treats the vault as an AERO-emission strategy, not a swap-fee strategy. In Aerodrome Slipstream, a concentrated liquidity NFT that is staked in a gauge earns emissions instead of directly collecting the position's swap fees. The forfeited fees are routed to the pool's fee voting reward contract for veAERO voters.

## Selected Pool

Use Aerodrome Slipstream CL100 WETH/USDC on Base.

| Item | Value |
| --- | --- |
| Chain | Base mainnet, chain id `8453` |
| Token0 | WETH: `0x4200000000000000000000000000000000000006` |
| Token1 | USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Pool | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` |
| Tick spacing | `100` |
| Gauge | `0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8` |
| Reward token | AERO: `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Fee voting reward | `0x765d935C2F47a06EdA55D07a9b9aE4108F4BBF85` |
| Nonfungible Position Manager | `0x827922686190790b37229fd06084350E74485b72` |
| Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |

Why this pool:

- It is one of the deepest and most actively traded Aerodrome pools on Base. Aerodrome's pool list showed about `$8.33M` TVL, `$23.24M` recent volume, `$10.5k` recent fees, `31.01%` fee APR, and `48.07%` emission APR for WETH/USDC CL100 when checked for this design.
- It uses native Base USDC, matching the deposit asset and avoiding bridged USDbC as the accounting unit.
- WETH/USDC is a core Base trading route, so liquidity is less dependent on a single long-tail token incentive campaign.
- It has real directional risk, but that risk is easier to explain and monitor than USDC/AERO or long-tail pairs. A USDC/AERO pool may show attractive incentives, but the vault would be heavily exposed to the same token it harvests.
- CL100 is a reasonable middle ground for a WETH/USDC pair: concentrated enough to qualify for active Aerodrome incentives, but not as narrow as tick spacing 1 or 50 pools that require very frequent rebalancing.

## Deposit Flow

1. User deposits USDC.
2. The vault keeps a small idle USDC buffer for withdrawals, for example `0.5%` to `2%` depending on expected usage.
3. The vault swaps the deployable portion into the WETH/USDC ratio needed for the target tick range.
4. The vault mints a Slipstream position through `NonfungiblePositionManager.mint(...)`.
5. The vault approves the CL gauge for the NFT and stakes it with `CLGauge.deposit(tokenId)`.

The initial implementation should use one canonical position NFT and one active range. A reasonable first range is wider than a highly optimized market-making band, for example around `+/- 8%` to `+/- 12%` around the current WETH/USDC price, snapped to CL100 ticks. That gives up some headline APR but reduces churn and the chance that a small vault spends too much time out of range.

## `harvest()` Flow

`harvest()` is keeper-callable and compounds AERO emissions into the staked position.

1. Validate the caller is an approved keeper, or allow public harvests with a capped caller incentive.
2. Check the Aerodrome gauge is still alive via `Voter.isAlive(gauge)`.
3. Optionally call `Voter.distribute([gauge])` before claiming. This pushes any currently claimable epoch emissions into the gauge when distribution has not already happened.
4. Unstake the current NFT with `CLGauge.withdraw(tokenId)`.
   - This returns the NFT to the vault.
   - For Slipstream gauges, withdrawing also distributes any outstanding AERO emissions owed to that NFT.
   - If the strategy ever supports a claim-only mode, it can instead call `CLGauge.getReward(tokenId)`.
5. Measure the AERO balance received from the gauge.
6. Swap harvested AERO into the needed WETH and USDC amounts using the Aerodrome Slipstream `SwapRouter`.
   - Use quoted minimum outputs and a deadline.
   - Do not let the keeper supply arbitrary swap paths unless paths are allowlisted.
   - Prefer AERO -> USDC and AERO -> WETH routes that are quoted onchain or by a trusted offchain keeper and verified with minimum outputs.
7. If the current price is still inside the strategy range, add the compounded WETH/USDC to the same NFT using `NonfungiblePositionManager.increaseLiquidity(...)`.
8. If the price has moved outside the acceptable range, rebalance instead:
   - remove all liquidity from the old NFT with `decreaseLiquidity(...)`;
   - collect withdrawn WETH/USDC from the position manager;
   - swap into the new target ratio;
   - mint a new NFT at the updated range;
   - burn the old empty NFT if possible.
9. Approve and restake the active NFT with `CLGauge.deposit(tokenId)`.
10. Update accounting: total managed assets in USDC terms, last harvest timestamp, last harvested AERO, and any caller incentive.

What `harvest()` claims:

- It claims AERO emissions from the Aerodrome CL gauge at `0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8`.
- Those emissions are funded through Aerodrome's voter/minter flow and distributed to the gauge for LPs whose staked liquidity was active.
- It does not claim the pool's WETH/USDC swap fees for the staked NFT. While staked, the position earns emissions; its foregone fees are directed to `FeesVotingReward` at `0x765d935C2F47a06EdA55D07a9b9aE4108F4BBF85` for veAERO voters.

## Realistic Earnings Breakdown

The vault's return should be modeled as:

```text
net return ~= AERO emissions
           + WETH/USDC LP mark-to-market change
           - impermanent loss
           - out-of-range drag
           - swap slippage
           - keeper incentives and gas
```

Expected components:

- AERO emissions: this is the primary yield source. The pool list showed about `48.07%` emission APR for WETH/USDC CL100 when checked, but this is variable because emissions depend on weekly veAERO votes, total staked active liquidity, AERO price, and whether the vault's range is active.
- Swap fees: not counted for this staked-gauge strategy. Aerodrome may display a fee APR for the pool, but a staked Slipstream NFT earns emissions instead of directly collecting those fees. An unstaked variant could earn WETH/USDC fees, but would give up gauge emissions.
- LP exposure: the vault is economically long a WETH/USDC LP position, not pure USDC. If WETH rises, the position gradually becomes more USDC-heavy; if WETH falls, it becomes more WETH-heavy. Share price should be reported in USDC terms, so WETH movement affects user returns.
- Impermanent loss: relative to simply holding the same WETH/USDC inventory, the LP position can underperform when WETH trends strongly. Concentrated liquidity magnifies this because the position can become one-sided once price exits the range.
- Range uptime: emissions accrue only when the staked liquidity is in the active tick/range. A range that is too narrow may show better capital efficiency but can miss rewards during fast price moves.
- Compounding cost: Base gas is usually small, but each harvest may include gauge withdraw, swaps, position-manager calls, and restaking. Harvesting should be skipped unless expected AERO value exceeds slippage, gas, and keeper incentive by a comfortable margin.

For planning, do not underwrite the strategy at the full displayed APR. A more conservative base case is to haircut displayed emission APR by range uptime and execution cost. For example, a displayed `48%` emission APR might be modeled as `25%` to `40%` gross before WETH price movement and impermanent loss for a reasonably maintained range, and lower during volatile periods or weeks with weaker AERO incentives.

## Sources Checked

- Aerodrome pool list: https://aerodrome-finance.app/liquidity/
- Aerodrome security and contract addresses: https://aerodrome-finance.app/security/
- Aerodrome protocol contracts README: https://github.com/aerodrome-finance/contracts
- Aerodrome/Velodrome SDK docs for deposits, staking, and claiming: https://github.com/velodrome-finance/docs/blob/main/content/sdk.mdx
- Slipstream specification for staked CL emissions versus fees: https://github.com/velodrome-finance/slipstream/blob/main/SPECIFICATION.md
- Onchain checks against Base RPC for the pool, gauge, reward token, tick spacing, fee voting reward, NFT manager, and gauge liveness.
