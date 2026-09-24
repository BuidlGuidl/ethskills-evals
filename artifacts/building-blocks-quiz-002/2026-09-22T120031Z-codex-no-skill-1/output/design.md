# Aerodrome USDC/WETH Vault Design

## Scope and Assumptions

This design targets the classic Aerodrome `vAMM-WETH/USDC` pool on Base, not a Slipstream concentrated-liquidity pool. That matches the simple strategy shape: the vault mints fungible LP tokens, stakes them in a gauge, periodically claims AERO emissions, swaps those rewards into the two pool assets, and adds more LP.

If the strategy later moves to Slipstream, the harvest path changes because the position is NFT/range based and the gauge interface is different.

## Relevant Base Contracts

| Component | Address | Notes |
| --- | --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Pool token1 |
| WETH | `0x4200000000000000000000000000000000000006` | Pool token0 |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | Gauge reward token |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | `getPool(WETH, USDC, false)` resolves the pool |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | Used for swaps and classic add/remove liquidity |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | Maps pool to gauge and distributes weekly emissions |
| vAMM-WETH/USDC pool / LP token | `0xcDAC0d6c6C59727a65F871236188350531885C43` | `stable() == false`, symbol `vAMM-WETH/USDC` |
| PoolFees | `0x0cfF5f2f4171db0b187Ad99F05dcCA08b0eEBDd6` | Holds swap fees segregated from pool reserves |
| Pool gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | Stake LP here to earn AERO emissions |
| FeesVotingReward | `0x14df87824a11DC27afF185D3149E05aaa4735f60` | Receives USDC/WETH fees claimed by the gauge |
| BribeVotingReward | `0x3371753209EA6975be5dF825aeCE63766e374441` | For veAERO voter incentives, not an LP harvest source |

## Deposit and Invest Flow

1. User deposits the accepted asset set into the vault.
2. The vault normalizes into roughly equal-value WETH and USDC. If the user deposits one side only, the vault swaps part of the deposit through the Aerodrome router or the configured swapper.
3. The vault calls Aerodrome Router `addLiquidity(WETH, USDC, false, ...)`.
4. The vault receives `vAMM-WETH/USDC` LP tokens.
5. The vault approves and deposits those LP tokens into the pool gauge with `Gauge.deposit(amount)`.

From that point, the vault's staked LP balance earns AERO emissions according to:

```text
vault AERO earned ~= gauge emissions for epoch
                    * vault staked LP
                    / total LP staked in gauge
```

The gauge's emission rate is set by the Aerodrome `Voter` based on weekly veAERO votes. A keeper or anyone may trigger `Voter.distribute([gauge])` around epoch rollover so the gauge receives its new AERO stream.

## Exact `harvest()` Flow

`harvest()` claims only AERO emissions from the pool gauge. It does not claim pool swap fees for the vault.

Recommended flow:

1. Optionally checkpoint the pool gauge:
   - Call `Voter.distribute([0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025])` if the new epoch's emissions have not been pushed to the gauge yet.
   - This is not strictly part of claiming already accrued rewards, but it keeps the gauge's reward stream current.
2. Claim AERO emissions:
   - Call `Gauge.getReward(address(this))` on `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
   - The gauge transfers accrued `AERO` (`0x940181a94A35A4569E4529A3CDfB74e38FD98631`) to the vault.
   - This call is authorized because the vault calls for its own account. Alternatively, `Voter.claimRewards([gauge])` can be used, which internally calls `gauge.getReward(msg.sender)`.
3. Take any configured performance fee from the claimed AERO.
4. Swap the remaining AERO into the underlying pool assets:
   - Swap roughly half of AERO to WETH.
   - Swap the other half to USDC, or solve the exact optimal split from current reserves and route quotes.
   - Use slippage limits; stale quotes should revert rather than donate value.
5. Add liquidity:
   - Call Router `addLiquidity(WETH, USDC, false, amountWETH, amountUSDC, minWETH, minUSDC, address(this), deadline)`.
   - The vault receives more `vAMM-WETH/USDC` LP tokens.
6. Stake the new LP:
   - Call `Gauge.deposit(newLpAmount)` on the same gauge.
7. Update accounting:
   - Increase total managed LP balance.
   - Emit a harvest event with claimed AERO, amounts compounded, LP minted, fees taken, and slippage.

The harvest function should not call `Pool.claimFees()` expecting USDC/WETH income. Once the LP tokens are staked, the gauge owns the LP tokens and receives the LP-token-level fee claim.

## Realistic Earnings Breakdown

For this staked classic LP design, the position's realized yield has these components:

| Component | Earned by this vault? | Details |
| --- | --- | --- |
| AERO emissions | Yes | Primary harvestable yield. Accrues in the gauge and is claimed with `Gauge.getReward(address(this))`. It is variable week to week because veAERO voters direct emissions by pool. |
| Swap fees | No, not directly while staked | The pool generates fees on swaps, but staked LPs forgo direct fee claims in exchange for AERO emissions. The gauge claims the fee stream and forwards it to `FeesVotingReward` for veAERO voters. |
| LP inventory exposure | Yes | The vault holds a 50/50 volatile WETH/USDC AMM position, so share value moves with WETH price and pool reserve changes. This includes impermanent loss versus simply holding WETH and USDC separately. |
| Compounding benefit | Yes | Claimed AERO is converted into more WETH/USDC LP, increasing the vault's future share of gauge emissions. Net benefit depends on harvest frequency, gas, swap slippage, and AERO price. |
| Bribes / voting incentives | No | These accrue to veAERO voters through `BribeVotingReward`, not to LP stakers. The vault only receives them if it also owns/votes a veAERO NFT, which is outside this LP strategy. |

As a current order-of-magnitude snapshot, Aerodrome's liquidity UI showed the basic volatile WETH/USDC pool around `8.55%` fee APR and `7.69%` emission APR on September 22, 2026. For this vault, the realistic harvestable APR is the emission side before vault fees, gas, slippage, and price movement. The displayed fee APR is real pool revenue, but it is not vault revenue while the vault stakes its LP in the gauge.

A practical mental model:

```text
vault gross harvest yield
  = AERO emissions claimed from Gauge
  - keeper gas / incentive
  - swap slippage and price impact
  - protocol/performance fee, if any
  +/- WETH/USDC LP mark-to-market and impermanent loss

vault gross harvest yield does not include direct USDC/WETH swap fees
```

## Where Swap Fees End Up

Aerodrome classic pool fees are separated from reserves into `PoolFees`. During a swap, the pool transfers the fee amount to its `PoolFees` contract and updates fee indexes for whoever holds the LP tokens.

For unstaked LP tokens, the LP token holder can call `Pool.claimFees()` and receive its pro-rata fees in token0/token1.

For this staked vault:

1. The vault deposits LP tokens into the gauge.
2. The gauge becomes the LP token holder.
3. The pool's fee accounting accrues fees to the gauge's LP balance.
4. When Aerodrome distributes new AERO to the gauge through `Gauge.notifyRewardAmount(...)`, the gauge internally calls `_claimFees()`.
5. `_claimFees()` calls `Pool.claimFees()` from the gauge.
6. The gauge receives WETH/USDC fees and forwards them into `FeesVotingReward` via `notifyRewardAmount(token, amount)`.
7. veAERO voters who voted for this pool claim those fees through `Voter.claimFees(...)`.

So the design has a deliberate tradeoff:

```text
staked LP vault receives: AERO emissions
veAERO voters receive: swap fees generated by staked liquidity
unstaked LPs receive: direct swap fees, but no AERO emissions
```

This means the keeper's `harvest()` should be modeled, tested, and reported as an AERO-emissions compounding operation, not as a USDC/WETH fee-claiming operation.

## Implementation Notes

- Do not report pool fee APR as vault APR unless the UI clearly labels it as "fees generated for voters" or "forgone by staked LPs."
- Guard harvest swaps with minimum outputs and a deadline.
- Use `earned(address(this))` on the gauge for previews, but treat it as informational; the authoritative claim is `getReward(address(this))`.
- Consider calling `Voter.distribute([gauge])` in harvest only when it is economically worthwhile. Distribution can also be done by third parties.
- If a future version holds a veAERO NFT, keep that as a separate strategy module. Its `claimFees` and `claimBribes` flows are voter-position revenue, not LP vault revenue.

## References

- Aerodrome contracts README and deployed Base addresses: https://github.com/aerodrome-finance/contracts
- Aerodrome protocol specification for gauges, fees, and voting rewards: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome gauge interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol
- Aerodrome docs on liquidity, fee APR, emission APR, and staked-vs-unstaked LP economics: https://aerodrome.finance/docs
