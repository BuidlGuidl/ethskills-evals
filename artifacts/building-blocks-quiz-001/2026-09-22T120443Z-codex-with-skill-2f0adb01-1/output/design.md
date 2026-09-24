# USDC/AERO Vault Design

## Strategy choice

The vault should LP into Aerodrome's Base `vAMM-USDC/AERO` Basic Volatile pool:

- Chain: Base, chain id `8453`
- Pool token / LP token: `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d`
- Gauge: `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360`
- Pool factory: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`
- Voter: `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`
- Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- AERO: `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- Pool type: Basic Volatile, `stable=false`
- Fee setting: `30`, meaning 0.30%

This is the right first pool because it is the canonical liquid AERO/USDC market on Base, has plain ERC-20 LP shares, and has a gauge that pays liquid AERO emissions. On the current Aerodrome liquidity page, this pool is one of the deepest simple USDC-paired opportunities: roughly `$24.83M` TVL, `$4.79M` volume, `$14.36k` fees, `24.22%` fee APR, and `40.4%` emission APR as of the 2026-09-22 check. A narrow concentrated WETH/USDC or USDC/cbBTC pool can show higher headline APR, but it needs active range management and NFT-position accounting; that is too much operational complexity for a small first vault.

The tradeoff is that depositors are not in a pure stablecoin strategy. The vault converts about half of every USDC deposit into AERO and LPs a 50/50 volatile pair, so share price is exposed to AERO inventory moves and impermanent loss.

## Deposit and position lifecycle

On deposit, the vault should:

1. Accept USDC.
2. Swap the target half of the USDC into AERO through the Aerodrome Router using route `{ from: USDC, to: AERO, stable: false, factory: PoolFactory }`.
3. Add liquidity to `vAMM-USDC/AERO` through the Aerodrome Router with bounded slippage.
4. Stake the received LP token into the pool gauge by calling `Gauge.deposit(uint256 amount)`.

Withdrawals reverse the position:

1. Withdraw the user's pro-rata LP tokens from the gauge with `Gauge.withdraw(uint256 amount)`.
2. Remove liquidity from the pool through the Router.
3. Swap any AERO leg back to USDC, unless the product later supports in-kind withdrawals.
4. Return USDC to the user after slippage and fees.

## `harvest()` flow

The keeper-triggered `harvest()` compounds AERO emissions from the Aerodrome gauge back into the same LP position.

Exact reward source:

- Contract called: `Gauge` at `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360`
- Function: `getReward(address account)`
- Account: the vault address
- Reward token: AERO at `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- Underlying staked token: the `vAMM-USDC/AERO` LP token at `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d`

Keeper sequence:

1. Read `Gauge.earned(address(this))`; return early if rewards are below a configured minimum.
2. Call `Gauge.getReward(address(this))` to transfer accrued AERO emissions to the vault.
3. Take the harvested AERO balance and reserve protocol/keeper fees if the product charges them.
4. Swap roughly half of the remaining AERO to USDC through the Aerodrome Router using route `{ from: AERO, to: USDC, stable: false, factory: PoolFactory }`.
5. Add AERO and USDC back into `vAMM-USDC/AERO` through the Aerodrome Router.
6. Stake the new LP tokens into the same gauge with `Gauge.deposit(uint256 amount)`.
7. Emit a `Harvest` event with claimed AERO, compounded USDC value, new LP amount, and fees.

Important accounting detail: this vault should not call `Voter.claimFees` or `Voter.claimBribes`. Those flows are for veAERO voters, not ordinary staked LP depositors. The gauge exposes `feesVotingReward()`, but that contract receives the pool fees relinquished by staked LPs and distributes them to veAERO voters. The vault only claims liquid AERO emissions from the gauge unless a later design adds a veAERO voting position.

## What the position earns

The realistic yield stack is:

1. AERO emissions: this is the primary vault yield. veAERO voters direct weekly emissions to gauges, and the gauge distributes AERO pro rata to staked LP tokens. The live Aerodrome UI showed about `40.4%` emission APR for this pool at the time of design. This number will move every epoch as votes, TVL, AERO price, and emissions change.
2. Pool swap fees: the pool itself charges about 0.30% per swap and had a displayed `24.22%` fee APR in the checked snapshot. For this staked-gauge design, those fees should be treated as protocol-level fee flow that attracts veAERO votes, not as directly harvestable vault income. Counting both full fee APR and emission APR as vault yield would overstate returns.
3. Compounding effect: each successful harvest increases the vault's staked LP balance by selling part of the AERO emissions into USDC and re-adding both sides. Base gas is cheap enough that weekly or several-times-weekly harvests can be realistic, but the vault should still enforce a minimum profitable harvest threshold.
4. Inventory PnL and impermanent loss: the vault is long a USDC/AERO LP, not simply long USDC. If AERO doubles or halves versus USDC, a constant-product LP underperforms simply holding the two assets by about `5.7%` before rewards. A 50% AERO move creates about `2.0%` impermanent loss if it is a move from 1.0x to 1.5x, and about `5.7%` if it is a move from 1.0x to 2.0x or 0.5x.

A reasonable user-facing expectation is therefore: variable AERO-denominated incentive yield, partially converted into more LP; no guaranteed USDC yield; meaningful AERO price exposure; and returns that can be negative in USDC terms if AERO sells off faster than emissions compensate.

## Source notes

- Aerodrome liquidity page, checked 2026-09-22: https://aerodrome-finance.app/liquidity/
- Aerodrome pool docs: https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
- Aerodrome contract specification: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome gauge interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol
- On-chain contract checks were performed against `https://mainnet.base.org` with `cast call`.
