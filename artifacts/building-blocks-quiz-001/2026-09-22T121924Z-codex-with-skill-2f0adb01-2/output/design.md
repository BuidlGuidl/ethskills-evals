# Base USDC LP Vault Design

## Strategy Summary

The vault accepts USDC on Base and deploys it into the Aerodrome Basic Volatile
WETH/USDC pool.

- Chain: Base, chain id `8453`
- Deposit asset: native Base USDC, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Pair asset: WETH, `0x4200000000000000000000000000000000000006`
- DEX: Aerodrome
- Pool type: Basic Volatile, 0.30% WETH/USDC
- Pool / LP token: `0xcDAC0d6c6C59727a65F871236188350531885C43`
- Gauge: `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`
- AERO reward token: `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- Aerodrome Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- Aerodrome Voter: `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`

## Why This Pool

Use the Basic Volatile WETH/USDC pool instead of concentrated liquidity for the
first version.

WETH/USDC is one of the deepest and most consistently traded pairs on Base. It
is also easier for USDC depositors to understand than a farm token pair such as
USDC/AERO: the vault takes half of each deposit into ETH exposure, but avoids
making the principal depend directly on the reward token being farmed.

The Basic Volatile pool is also operationally simpler than Aerodrome Slipstream
concentrated liquidity. A concentrated WETH/USDC position can advertise much
higher APR, but it requires a range policy, NFT accounting, out-of-range
handling, and rebalance logic. This vault's keeper is only expected to harvest
and compound, so the basic ERC-20 LP token is the safer first integration.

As of the 2026-09-22 Aerodrome liquidity page snapshot, the Basic Volatile
WETH/USDC pool showed about $7.39M TVL, about $826k daily volume, about 8.55%
fee APR, and about 7.69% emission APR. Those numbers should be treated as an
input snapshot, not a promise: Aerodrome emissions are reallocated weekly by
veAERO votes, and volume changes every day.

## Deposit Flow

1. User deposits USDC into the ERC-4626 vault.
2. Vault keeps a small USDC buffer for withdrawals, if configured.
3. Vault swaps the required portion of USDC to WETH through Aerodrome Router.
4. Vault adds WETH and USDC to the Basic Volatile WETH/USDC pool through
   `Router.addLiquidity(..., stable = false, ...)`.
5. Vault receives ERC-20 LP tokens from
   `0xcDAC0d6c6C59727a65F871236188350531885C43`.
6. Vault stakes those LP tokens in the Aerodrome gauge
   `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` via `deposit(uint256)`.

All swaps and liquidity additions must use keeper-provided minimum outputs and
deadlines. The vault should reject deposits or harvests when price impact is
above the configured limit.

## Exact `harvest()` Flow

The only reward the vault claims in v1 is AERO emitted by the Aerodrome gauge.

1. Read pending reward:
   - Call `earned(address(this))` on gauge
     `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
2. Claim rewards:
   - Call `getReward(address(this))` on the same gauge.
   - The gauge transfers AERO
     `0x940181a94A35A4569E4529A3CDfB74e38FD98631` to the vault.
3. Charge any configured performance fee from claimed AERO, if the product
   later adds one.
4. Compound:
   - Swap claimed AERO into the target WETH/USDC amounts needed for the pool.
   - A simple implementation can swap AERO to USDC, then swap enough USDC to
     WETH to match the pool ratio.
   - A more efficient implementation can split the AERO and route directly into
     WETH and USDC.
5. Add liquidity:
   - Call Aerodrome Router `addLiquidity` for WETH/USDC with `stable = false`.
6. Stake new LP:
   - Approve the new LP tokens to the gauge.
   - Call gauge `deposit(uint256)` to stake the newly minted LP.
7. Emit a `Harvest` event with claimed AERO, compounded USDC value, LP minted,
   and fee amounts.

The vault does not claim Aerodrome voting rewards, bribes, or veAERO rebases in
v1. Those belong to veAERO voting positions, and this vault does not lock AERO
or vote.

## What The Position Earns

The position earns AERO emissions from the WETH/USDC gauge. This is the cash
flow that `harvest()` claims and compounds.

The pool also generates swap fees, but Aerodrome's gauge model is not the same
as a vanilla Uniswap V2 LP. In Aerodrome's contract model, LPs that deposit LP
tokens into a gauge receive protocol emissions, while pool fees are routed into
the voting reward side for veAERO voters. For this v1 vault, model direct
harvestable yield as AERO emissions only.

Economic breakdown for a USDC depositor:

- AERO emissions: currently around high-single-digit APR for this specific
  basic WETH/USDC gauge, based on the 2026-09-22 Aerodrome UI snapshot.
- Trading fees: real pool revenue, but not directly claimed by this staked-gauge
  vault in v1.
- Market exposure: after deployment, the vault is roughly 50% USDC and 50%
  WETH, so share value moves with ETH.
- Impermanent loss: if ETH doubles or halves versus USDC, a constant-product
  50/50 LP underperforms holding the two assets by about 5.7%; a 50% ETH move is
  about 2.0% IL, and a 25% move is about 0.6% IL.
- Costs and drag: Base gas, AERO swap slippage, USDC/WETH swap slippage,
  add-liquidity dust, harvest frequency, and any future vault performance fee.

A realistic expectation is that returns are dominated by weekly AERO emissions
and ETH price movement, not by a stable USDC yield curve. In quiet markets, the
compounded emissions can produce a modest positive APR. In a strong directional
ETH move, impermanent loss can consume part or all of the emissions.

## Operational Guardrails

- Use a harvest threshold so keepers do not compound rewards when expected AERO
  value is smaller than gas plus slippage.
- Cap swap price impact for AERO, USDC, and WETH routes.
- Keep route configuration updateable by governance, because Aerodrome liquidity
  can migrate between basic and concentrated pools.
- Track total assets using the current withdrawable LP value plus idle USDC,
  idle WETH, and idle AERO valued through conservative on-chain quotes.
- Do not use Aerodrome UI APRs as accounting inputs; they are display metrics,
  not oracle values.

## Sources Checked

- Aerodrome contracts repository and deployment table:
  https://github.com/aerodrome-finance/contracts
- Aerodrome liquidity docs:
  https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
- Aerodrome gauge implementation:
  https://github.com/aerodrome-finance/contracts/blob/main/contracts/gauges/Gauge.sol
- Aerodrome liquidity page snapshot:
  https://aerodrome-finance.app/liquidity/
