# Base USDC Yield Vault Design

Last verified: 2026-09-22 12:40 UTC, Base block 51645740.

## Pool Selection

The vault should LP into the Aerodrome basic volatile `AERO/USDC` pool on Base:

- Pool: `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d`
- Token0: USDC, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Token1: AERO, `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- Pool type: basic volatile, not stable
- Pool factory: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`
- Gauge: `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360`
- Aerodrome router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- Aerodrome voter: `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`

Why this pool:

1. It is the most natural compounding loop for an Aerodrome vault. The gauge pays AERO, and the underlying LP is AERO/USDC, so harvest only needs to sell the portion of AERO required to restore pool ratio and then add more liquidity.
2. It is meaningfully liquid. DexScreener showed about `$36.36m` liquidity and `$4.40m` 24h volume for this pool at verification time.
3. It avoids concentrated-liquidity range management. Slipstream pools may show attractive APRs, but a small vault would need NFT accounting, tick/range policy, rebalancing triggers, and out-of-range handling. The basic pool produces fungible ERC-20 LP shares, which keeps deposit, withdrawal, and compounding logic much smaller.
4. It has a live gauge with nearly all pool LP staked. Onchain reads showed `0.393982982846206395` LP staked out of `0.396542274088734814` total LP, or about `99.35%`.

Rejected alternative: the Aerodrome basic `USDC/USDbC` pool is lower market-risk, but current liquidity/volume were much smaller in live checks. It is also a legacy bridged-USDC pair, so it is less compelling for a new small vault unless the goal is explicitly low volatility rather than yield.

## Deposit Flow

Users deposit USDC. The vault should:

1. Hold USDC as the accounting asset and issue vault shares against total assets.
2. Swap the required portion of USDC into AERO using Aerodrome router `swapExactTokensForTokens`.
3. Add liquidity through `Router.addLiquidity(USDC, AERO, false, amountUSDC, amountAERO, minUSDC, minAERO, address(this), deadline)`.
4. Stake the received LP tokens into gauge `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360` with `Gauge.deposit(lpAmount)`.

The implementation should calculate the swap split from current reserves or `quoteAddLiquidity`, not assume an exact 50/50 token amount. In value terms this pool is approximately 50/50, but token quantities are not symmetric because USDC has 6 decimals and AERO has 18 decimals.

## harvest() Flow

The keeper calls `harvest()` periodically. The exact compounding sequence is:

1. Claim gauge emissions:
   - Call `Gauge.getReward(address(this))` on `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360`.
   - The gauge's `rewardToken()` is AERO, `0x940181a94A35A4569E4529A3CDfB74e38FD98631`.
   - This is the only reward claim in the base design.
2. Do not claim trading fees or bribes:
   - The gauge's `feesVotingReward()` is `0xa2EdEd6EE17aF8dEbF70a1E93ac66E60dbfaaf33`, but that contract is for veAERO voters, not this LP vault.
   - The vault does not hold or vote a veAERO NFT, so voter fees and external vote incentives are out of scope.
3. Rebalance reward inventory:
   - Read vault balances of AERO and USDC.
   - Sell just enough AERO to USDC through `Router.swapExactTokensForTokens`.
   - Use route `{ from: AERO, to: USDC, stable: false, factory: 0x420DD381b31aEf6683db6B902084cB0FFECe40Da }`.
   - Enforce keeper-supplied or oracle-bounded `amountOutMin` and a short deadline.
4. Compound:
   - Approve the router for the USDC and AERO amounts to deploy.
   - Call `Router.addLiquidity(USDC, AERO, false, amountUSDC, amountAERO, minUSDC, minAERO, address(this), deadline)`.
   - Approve the gauge for the new LP tokens.
   - Call `Gauge.deposit(newLpAmount)`.
5. Account for leftovers:
   - Leave dust USDC/AERO in the vault for the next harvest or include it in the next deposit/withdrawal rebalance.
   - Emit a harvest event with claimed AERO, swapped AERO, USDC received, LP minted, and keeper fee if any.

No fee-on-transfer token handling is needed for USDC or AERO, but slippage checks still matter because the keeper transaction can be sandwiched.

## Realistic Earnings Breakdown

This position earns AERO emissions from the Aerodrome gauge. It does not earn Aerodrome swap fees while staked in the gauge; staked LP fee rights are routed to `FeesVotingReward` for veAERO voters.

At verification time:

- Gauge reward rate: `0.478387830168805517` AERO per second.
- Annualized emissions: about `15.09m` AERO/year.
- AERO reference price from DexScreener: about `$0.6912`.
- Staked liquidity estimate: about `$36.13m`.
- Simple emission APR estimate: about `28.9%`.
- Weekly compounding APY estimate before costs: about `33.4%`.

That headline yield is variable. It changes with veAERO votes, pool TVL, AERO price, and whether emissions continue at the current rate. It should not be modeled as fixed USDC yield.

The practical return stack is:

1. AERO emissions, auto-compounded into more AERO/USDC LP. This is the intended yield source.
2. AERO/USDC LP exposure. A USDC depositor becomes roughly half USDC and half AERO by value. If AERO falls, vault NAV can fall even while emissions accrue.
3. Impermanent-loss/rebalancing drag relative to holding USDC and AERO outside the pool. The pool constantly rebalances into the underperforming asset.
4. No staked-LP swap-fee income. Pool trading activity matters indirectly because fees can attract veAERO votes, which can attract future emissions, but those fees are not directly claimable by this vault.
5. Costs: Base gas, the 0.30% volatile-pool swap fee on harvest/deposit swaps, price impact, slippage, and any keeper/performance fee.

Sources checked:

- Aerodrome contracts README and interfaces: https://github.com/aerodrome-finance/contracts
- Aerodrome liquidity docs: https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
- DexScreener pool data: https://dexscreener.com/base/0x6cdcb1c4a4d1c3c6d054b27ac5b77e89eafb971d
- Onchain Base RPC reads against the pool, router, voter, and gauge addresses above.
