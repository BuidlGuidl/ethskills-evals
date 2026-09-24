# Base USDC Yield Vault Design

Evidence checked on 2026-09-22.

## Pool Selection

The vault should LP into Aerodrome's basic volatile WETH/USDC pool on Base:

- Pool: `0xcDAC0d6c6C59727a65F871236188350531885C43`
- Gauge: `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`
- Pool type: `vAMM-WETH/USDC`, `stable() == false`
- Tokens:
  - WETH: `0x4200000000000000000000000000000000000006`
  - USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Reward token:
  - AERO: `0x940181a94A35A4569E4529A3CDfB74e38FD98631`

The vault takes USDC deposits, swaps about half the deposit into WETH, adds WETH/USDC liquidity through Aerodrome, receives fungible ERC-20 LP tokens, and stakes those LP tokens in the Aerodrome gauge.

Why this pool:

- It uses Base canonical USDC and WETH, so the strategy avoids long-tail token inventory risk.
- The basic pool gives the vault fungible ERC-20 LP tokens. That keeps accounting, deposits, withdrawals, and share pricing much simpler than a concentrated-liquidity NFT vault.
- It is deep enough for a small vault. The Aerodrome app listed the basic WETH/USDC pool with about `$7.39M` TVL, about `$826k` volume, `8.55%` fee APR, and `7.69%` emission APR in the latest indexed view checked on 2026-09-22.
- Onchain reads from the pool showed roughly `1,654 WETH` and `4.54M USDC` in reserves at the time of review. That is a large enough base for moderate deposits, though deposit sizing should still cap vault TVL as a percentage of pool liquidity.

Why not the higher-APR concentrated WETH/USDC pool:

- Concentrated positions require range selection, rebalancing, NFT custody, and active-tick reward accounting.
- For a first vault, those mechanics add more failure modes than the extra headline APR justifies.
- The basic pool is lower yield but much easier to compound safely and explain to depositors.

## Harvest Flow

The keeper calls `harvest()` on the vault. The vault claims only LP gauge emissions. It does not claim voter fees or vote incentives.

1. Read pending rewards with:
   - `IGauge(0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025).earned(address(this))`

2. Claim AERO emissions from the Aerodrome gauge:
   - `IGauge(0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025).getReward(address(this))`
   - This transfers AERO from the gauge to the vault.

3. Apply the vault's fee policy, if any:
   - Take performance fee in AERO or swap fee share to USDC.
   - Keep this explicit and capped. The default design should start with no performance fee until the rest of the vault is battle-tested.

4. Compound the remaining AERO:
   - Swap AERO to USDC/WETH in the correct proportions needed for adding WETH/USDC liquidity.
   - A simple route is AERO -> USDC for the USDC leg and AERO -> WETH or AERO -> USDC -> WETH for the WETH leg, selected by quoted output and bounded by `minAmountOut`.
   - Add liquidity to the WETH/USDC volatile pool.
   - Stake the newly received LP tokens into the same gauge with `deposit(uint256)`.

5. Leave no meaningful idle balances:
   - Any dust USDC, WETH, or AERO can remain in the vault and be folded into the next harvest.
   - Harvest should revert if quoted output would violate slippage limits or if the expected LP tokens received are below a minimum threshold.

Important reward-routing note:

- In Aerodrome, staking LP tokens in a gauge means the LP earns emissions and gives up the direct fee stream. Aerodrome's protocol spec says gauge depositors receive emissions while the relinquished fee rewards are sent to `FeesVotingReward`.
- For this pool, `feesVotingReward()` on the gauge returned `0x14df87824a11DC27afF185D3149E05aaa4735f60`.
- Therefore the vault's harvestable income is AERO emissions from the gauge. Trading fees and vote incentives belong to veAERO voters, not to this staked LP vault.

## Realistic Earnings Breakdown

Current position economics checked on 2026-09-22:

- AERO emissions: the gauge reported `rewardRate() ~= 0.029588 AERO/sec`, or about `17,890 AERO/week`.
- Staked liquidity: gauge `totalSupply()` was about `0.0828` LP tokens versus pool `totalSupply()` about `0.0848` LP tokens, so most pool liquidity was staked.
- AERO spot estimate: the Aerodrome AERO/USDC basic pool implied about `$0.69` per AERO from reserves at review time.
- Gross emission yield: using the above onchain values, the staked WETH/USDC position implies roughly `7%` annualized AERO emission APR before compounding, swap slippage, keeper gas, and any vault fee. Aerodrome's app showed `7.69%` emission APR for the same pool in its indexed view.
- Trading fee APR: Aerodrome's app showed `8.55%` fee APR for the pool, but the vault should not model that as claimable income while staked in the gauge. The staked vault receives emissions instead of direct LP fees.
- Underlying exposure: users deposit USDC but receive vault shares backed by a 50/50 WETH/USDC LP position. The vault therefore has ETH price exposure and impermanent loss/LVR risk. If ETH moves strongly, vault NAV can underperform simply holding the initial USDC or holding the two assets outside the AMM.
- Real net yield: expected net yield should be modeled as AERO emissions compounded into more WETH/USDC LP, minus slippage, keeper costs, AERO price movement between harvests, and adverse selection from LPing. A conservative public estimate would quote a range below the headline emission APR, not the app's fee APR plus emission APR.

## Sources

- Aerodrome liquidity docs: https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
- Aerodrome protocol specification: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome gauge interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol
- Aerodrome liquidity app, pool table checked 2026-09-22: https://aerodrome-finance.app/liquidity/
- Base RPC reads against Aerodrome factory `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` and Voter `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`.
