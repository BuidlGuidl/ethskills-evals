# Aerodrome USDC/WETH Vault Design

## Scope and Assumptions

This design targets the Aerodrome basic volatile USDC/WETH pool on Base: the vault adds balanced USDC and WETH liquidity, receives the pool's ERC20 LP token, stakes that LP token in the pool gauge, and periodically compounds AERO emission rewards back into more USDC/WETH LP.

Aerodrome also has concentrated USDC/WETH pools. Those use NFT positions and `CLGauge.getReward(tokenId)`, not the ERC20 LP gauge flow below. See "Concentrated-liquidity variant" near the end before adapting this design to Slipstream.

Base mainnet constants:

| Item | Address / lookup |
| --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| USDC/WETH volatile pool | Resolve from the router/factory with `stable = false` |
| Pool gauge | `Voter.gauges(pool)` |

Deployment should store the resolved `pool` and `gauge` immutably and verify:

- `IGauge(gauge).stakingToken() == pool`
- `IGauge(gauge).rewardToken() == AERO`
- `IVoter(VOTER).gauges(pool) == gauge`
- `IVoter(VOTER).isAlive(gauge) == true`

## Deposit Flow

1. User deposits USDC, WETH, or a single supported input token into the vault.
2. The vault normalizes the deposit into the current pool ratio. For single-sided deposits, it swaps enough of the input token to the other side using a slippage-limited route.
3. The vault approves the Aerodrome Router and calls:

   `Router.addLiquidity(USDC, WETH, false, amountUSDCDesired, amountWETHDesired, amountUSDCMin, amountWETHMin, address(this), deadline)`

4. The Router returns ERC20 LP tokens for the volatile USDC/WETH pool.
5. The vault approves the pool gauge and stakes the new LP:

   `Gauge.deposit(liquidity)`

6. The vault mints shares against total assets measured as:

   staked LP balance + idle LP + idle USDC/WETH + claimable AERO valued through conservative quotes.

For share pricing, the safest default is to value the core position from the underlying LP reserves and the vault's pro-rata LP balance, while valuing unharvested AERO at zero or through a haircut. That avoids over-minting shares from volatile pending rewards.

## Exact `harvest()` Flow

`harvest()` claims only AERO emissions from the Aerodrome gauge. It does not claim USDC/WETH swap fees from the pool, and it does not claim fees or bribes from Aerodrome voting reward contracts.

Recommended implementation:

1. Gate the call with keeper permissioning or make it permissionless with strict slippage controls. Use `nonReentrant`.
2. Optionally pull the current epoch's emissions into the pool gauge:

   `Voter.distribute([gauge])`

   This is permissionless. It asks Aerodrome's `Voter` to update the gauge's claimable AERO allocation and, when conditions are met, notify the gauge of the new reward amount.

3. Claim the vault's accrued gauge emissions:

   `Gauge.getReward(address(this))`

   The claimed token is `IGauge(gauge).rewardToken()`, which should be AERO. The claim is from the USDC/WETH pool's gauge, not from the pool contract.

4. Read `aeroClaimed = AERO.balanceOf(address(this)) - aeroBefore`. If zero, exit after emitting a no-op harvest event.
5. Take any configured vault fee or keeper incentive from AERO before compounding. Keep this explicit; do not hide it in swap slippage.
6. Swap the remaining AERO into the pair assets:

   - quote the pool ratio with `Router.quoteAddLiquidity(...)` or equivalent reserve math;
   - swap enough AERO to USDC and WETH to match that ratio;
   - use `Router.swapExactTokensForTokens(...)` or an approved aggregator with `amountOutMin` and `deadline`;
   - route choices should be externally configurable but allowlisted.

7. Add the resulting USDC and WETH back to the volatile pool:

   `Router.addLiquidity(USDC, WETH, false, usdcDesired, wethDesired, usdcMin, wethMin, address(this), deadline)`

8. Stake only the newly minted LP tokens:

   `Gauge.deposit(newLiquidity)`

9. Leave small dust balances in the vault for the next harvest, or sweep only if doing so is worth the gas.
10. Emit `Harvest(aeroClaimed, aeroCompounded, usdcAdded, wethAdded, lpMinted)`.

The existing staked LP does not need to be withdrawn during harvest. Withdrawing only makes sense for withdrawals, emergency exits, or a strategy rebalance.

## What the Position Realistically Earns

The staked vault earns:

| Component | Captured by this vault? | Notes |
| --- | --- | --- |
| AERO emissions | Yes | Main yield source. Emissions come from the pool gauge and depend on weekly veAERO votes, total gauge emissions, and the vault's share of staked LP. `harvest()` claims and compounds these. |
| Compounding effect | Yes | Claimed AERO is sold into USDC/WETH and added as more LP, increasing the vault's future gauge share. |
| ETH/USDC LP market exposure | Yes | Depositors are economically long a 50/50-ish volatile AMM position, not a stable USD vault. Returns include WETH price movement and impermanent loss versus simply holding USDC + WETH. |
| Swap fees | No, while staked | The staked gauge design gives up the LP fee claim in exchange for emissions. Fees flow to Aerodrome voters, described below. |
| veAERO voting fees/bribes | No | Those belong to veAERO NFT voters, not to LP stakers, unless the vault also owns/operates a veAERO voting position. This design does not. |
| veAERO rebases | No | Rebases accrue to veAERO lockers, not this LP vault. |

A useful live sanity check is Aerodrome's own pool page. At the time this design was written, it showed the WETH/USDC `0.3% Basic Volatile` pool with a displayed Fee APR and a displayed Emission APR. Under this design, the vault should treat the emission side as the harvestable/compoundable yield and should not book the displayed fee side as vault revenue while its LP tokens are staked in the gauge.

Net APY to users is therefore approximately:

`compounded AERO emission value - swap/compound slippage - gas/keeper costs - vault fees +/- LP inventory PnL`

It is not:

`emissions + swap fees + bribes`

unless the strategy is expanded to include a separate veAERO voting position or an unstaked-fee strategy.

## Where Swap Fees End Up

For the basic volatile pool, Aerodrome keeps pool trading fees separate from the pool reserves in `PoolFees`. If a liquidity provider does not stake LP tokens, fees are claimable from the pool using the pool fee-claiming path.

This vault stakes its LP tokens in the gauge. In Aerodrome's gauge model, LPs that deposit into a gauge relinquish their pool fee reward in exchange for AERO emissions. The relinquished fees are transferred through the gauge's fee path to the gauge's `FeesVotingReward` contract. They are then distributed to veAERO voters who voted for that pool, generally in the following epoch.

So, in this design:

- traders pay swap fees into the USDC/WETH pool fee accounting;
- because the vault's LP is staked, the vault does not claim those USDC/WETH fees;
- the gauge exposes `feesVotingReward()` / `Voter.gaugeToFees(gauge)`;
- the fees are distributed by Aerodrome to the pool's veAERO voters through `FeesVotingReward`;
- `harvest()` must not call `Pool.claimFees()`, `Voter.claimFees(...)`, or `FeesVotingReward.getReward(...)`, because the vault does not own the relevant fee claim or veNFT voting position.

This is the main economic gotcha: a staked Aerodrome LP vault compounds AERO emissions, not the pool's swap fees.

## Concentrated-Liquidity Variant

If the strategy targets an Aerodrome Slipstream concentrated USDC/WETH pool instead of the basic volatile pool, use a different design:

- deposits mint an NFT through the `NonfungiblePositionManager` with explicit tick bounds;
- the vault stakes that NFT into the pool's `CLGauge`;
- `harvest()` claims AERO with `CLGauge.getReward(tokenId)`;
- compounding requires choosing whether to increase the existing NFT liquidity, mint additional positions, or rebalance ticks;
- while the NFT is staked, the position does not accumulate directly claimable swap fees; the fees attributable to staked liquidity are collected through the gauge path and routed to `FeeVotingReward` for voters.

Do not mix the basic gauge interface and the concentrated gauge interface. The former is account-based ERC20 LP staking; the latter is tokenId-based NFT staking.

## References

- Aerodrome contracts README: https://github.com/aerodrome-finance/contracts/blob/main/README.md
- Aerodrome protocol specification: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome `IGauge` interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol
- Aerodrome `IVoter` interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IVoter.sol
- Aerodrome / Velodrome SDK guide: https://github.com/velodrome-finance/docs/blob/main/content/sdk.mdx
- Slipstream specification: https://github.com/velodrome-finance/slipstream/blob/main/SPECIFICATION.md
- Aerodrome liquidity page for live pool APR context: https://aerodrome-finance.app/liquidity/
