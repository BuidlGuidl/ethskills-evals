# Two-Tranche Yield Vault Design

Date: 2026-09-22  
Chain: Arbitrum One

## Summary

The vault accepts deposits into one of two independently accounted tranches.

- **Tranche A: fixed maturity tranche** deploys into Pendle Principal Tokens (PTs) on Arbitrum.
- **Tranche B: trader-fee tranche** deploys into GMX V2 GLV liquidity vaults on Arbitrum.

Tranche A is designed for users who want a known redemption amount at a specific maturity, subject to underlying asset and protocol risk. Tranche B is designed for users who want exposure to GMX trader fees and accept variable returns, trader PnL exposure, and market inventory risk.

The initial stable accounting asset should be USDC. If a selected Pendle market settles in a different accounting asset, the vault must treat that asset risk explicitly and avoid advertising the result as risk-free USDC yield.

## Live Venue Check

These selections were checked against live protocol data on 2026-09-22.

- Pendle API: `https://api-v2.pendle.finance/core/v2/markets/all?chainId=42161&limit=100`
  - Active Arbitrum future-maturity candidate: `USDai`, market `0xa8a0dea40174cfc30fea9e3a77f182ab33f46e25`, expiry `2026-10-15T00:00:00.000Z`, PT `42161-0xc9d24ad0bb25f34098e226a8c5192dea7bacccae`, reported liquidity about `50.33M`, total TVL about `82.99M`, implied APY about `9.68%`.
  - Longer maturity candidate: `sUSDai`, market `0xf86119a39f8654f38acbbd5488bd83f3f51983c8`, expiry `2027-02-25T00:00:00.000Z`, reported liquidity about `3.89M`, total TVL about `6.51M`, implied APY about `9.92%`.
- GMX API: `https://arbitrum-api.gmxinfra.io/glvs/`
  - Listed GLV `[ETH-USDC]`: `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9`, listed `2024-09-05`.
  - Listed GLV `[WBTC.b-USDC]`: `0xdF03EEd325b82bC1d4Db8b49c30ecc9E05104b96`, listed `2024-09-12`.
- GMX APY API: `https://arbitrum-api.gmxinfra.io/apy`
  - GLV `[ETH-USDC]` reported base APY about `8.84%`.
  - GLV `[WBTC.b-USDC]` reported base APY about `10.63%`.

Protocol docs used:

- Pendle PT docs: `https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/PT`
- Pendle API docs: `https://docs.pendle.finance/pendle-v2-dev/Backend/ApiOverview`
- GMX liquidity docs: `https://docs.gmx.io/docs/providing-liquidity/`
- GMX liquidity API docs: `https://docs.gmx.io/docs/api/rest-api/liquidity/`

## Tranche A: Fixed Rate via Pendle PT

### Protocol

Tranche A deploys into **Pendle V2 Principal Tokens** on Arbitrum.

Initial market choice:

- Primary short maturity: **PT-USDai expiring 2026-10-15**, market `0xa8a0dea40174cfc30fea9e3a77f182ab33f46e25`.
- Optional later maturity: **PT-sUSDai expiring 2027-02-25**, market `0xf86119a39f8654f38acbbd5488bd83f3f51983c8`.

The exact market should be a deployment parameter, not hardcoded. Governance or a curator should only enable markets after checking:

- Arbitrum chain ID is `42161`.
- Market expiry is in the future.
- Pendle market has enough liquidity for expected deposits and exits.
- Accounting asset, underlying asset, and redemption mechanics are understood.
- The underlying protocol risk is acceptable for a fixed-rate product.

### How It Earns

Pendle splits a yield-bearing asset into:

- **PT**, the principal claim.
- **YT**, the future variable yield claim.

PTs trade below their maturity redemption value because the buyer gives up future variable yield. When the vault buys PT at a discount and holds it to maturity, the PT becomes redeemable for the accounting asset at the market's maturity redemption rate. The fixed rate for a user deposit is therefore locked at the execution price of the PT purchase.

For each Tranche A deposit:

1. User deposits USDC.
2. Vault swaps USDC into the Pendle market input asset if needed.
3. Vault buys PT through the Pendle router.
4. Vault records a deposit lot:
   - user address,
   - maturity,
   - PT amount received,
   - asset spent,
   - fixed redemption target,
   - realized fixed APY at execution.
5. At or after maturity, the keeper redeems PT into the accounting asset.
6. User withdraws the redeemed amount, less any vault fees.

Tranche A does **not** have periodic yield to compound before maturity. The keeper's Tranche A responsibilities are:

- buy PT for new deposits,
- redeem matured PT,
- roll matured assets into the next approved PT market only when the user opted into auto-roll,
- sweep dust and failed-route leftovers.

### Risks

- **Underlying asset risk**: PT redemption is only as strong as the underlying accounting asset. A PT-USDai position is exposed to USDai or sUSDai mechanics, collateral, depeg, redemption, and issuer risk.
- **Not risk-free fixed income**: The vault can lock the PT purchase yield, but it cannot guarantee external stablecoin value if the accounting asset depegs or redemption fails.
- **Pendle smart contract risk**: Pendle router, market, SY, PT, and redemption contracts can fail or be exploited.
- **Underlying protocol smart contract risk**: The yield-bearing asset behind the PT can fail independently of Pendle.
- **Liquidity and exit risk**: Before maturity, exiting requires selling PT into Pendle liquidity. Price can move against the vault, and available liquidity may be insufficient.
- **Maturity concentration risk**: A single maturity creates cliff liquidity. Large redemptions or market issues at maturity affect all users in that series.
- **Rate execution risk**: The promised rate must be based on actual PT received, not a quote. Slippage limits and minimum PT out are required.
- **Oracle and pricing risk**: UI APRs are indicative. Contract accounting must use actual balances and executed amounts.
- **Keeper risk**: Late redemption delays withdrawals or auto-rolls, although it should not change the matured PT claim if the underlying remains redeemable.

## Tranche B: Trader Fees via GMX V2 GLV

### Protocol

Tranche B deploys into **GMX V2 GLV liquidity vaults** on Arbitrum.

Initial allocation:

- Primary: **GLV `[ETH-USDC]`**, token `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9`.
- Secondary optional split: **GLV `[WBTC.b-USDC]`**, token `0xdF03EEd325b82bC1d4Db8b49c30ecc9E05104b96`.

The simplest first implementation should use only GLV `[ETH-USDC]`. A later version can split deposits between ETH-USDC and WBTC.b-USDC by target weights, rebalanced by the keeper.

### How It Earns

GMX V2 liquidity backs leverage trading and swaps. GLV vaults allocate liquidity across supported GM markets. Liquidity providers earn the majority of protocol fees generated by:

- opening and closing leveraged positions,
- trader borrow fees,
- swaps,
- liquidations.

On Arbitrum, GMX docs state liquidity providers receive 63% of these fees. The GMX API's GLV `baseApy` is fee-only yield; it excludes incentives, trader PnL, and backing-token price movement.

For each Tranche B deposit:

1. User deposits USDC.
2. Vault deposits into the selected GMX GLV through GMX V2 deposit flow.
3. Vault receives GLV shares.
4. User receives Tranche B shares against the vault's GLV NAV.
5. As traders pay fees, GLV value should increase through pool accounting.
6. Withdrawals burn the user's Tranche B shares and redeem the proportional GLV value.

The keeper's Tranche B responsibilities are:

- create and execute GLV deposit and withdrawal requests,
- maintain target allocation if multiple GLVs are enabled,
- harvest or reinvest any explicit rewards if GMX exposes claimable incentives,
- monitor GMX APY, performance, open interest, pool composition, and paused markets,
- pause new deposits if utilization, withdrawal liquidity, or trader PnL metrics breach limits.

### Risks

- **Trader PnL risk**: GLV liquidity is counterparty capital for traders. If traders profit against the pool, LP NAV can fall even while fee APY is positive.
- **Inventory price risk**: GLV `[ETH-USDC]` holds ETH and USDC exposure. GLV `[WBTC.b-USDC]` holds BTC and USDC exposure. Tranche B is not a stablecoin-only position.
- **Volatility risk**: Sharp ETH or BTC moves can change pool value and trader PnL quickly.
- **Liquidity utilization risk**: High utilization can make withdrawals expensive, delayed, or unavailable until capacity improves.
- **GMX smart contract risk**: GLV, GM market, router, oracle, order execution, and datastore contracts can fail or be exploited.
- **Oracle and execution risk**: GMX depends on oracle-based execution. Oracle disruption, stale prices, execution delay, or keeper failure can affect deposits, withdrawals, and pool value.
- **Market parameter risk**: GMX market caps, PnL factors, borrow parameters, and supported markets can change. A GLV's supported markets may also change as new markets are approved.
- **Fee variability**: Trader activity can fall, reducing fee APY. Past or current API APY is not guaranteed.
- **Adverse selection risk**: LPs earn fees but absorb toxic flow when traders have an edge, especially during volatile markets.
- **Protocol governance risk**: Fee splits, market lists, risk parameters, or emergency controls can change.

## Accounting Model

The two tranches must be accounted separately.

Tranche A accounting:

- Track deposits by maturity lot.
- Lock the user-visible fixed rate only after the PT swap executes.
- Promise no more than the actual PT redemption claim for that lot.
- Keep per-lot records instead of pooling users with different fixed rates into one fungible share class.

Tranche B accounting:

- Use fungible vault shares per GLV allocation.
- Share price equals total Tranche B assets minus liabilities divided by Tranche B shares.
- Mark GLV positions using GMX-supported pricing reads and conservative withdrawal estimates.
- Apply withdrawal slippage and execution-fee buffers.

There should be no cross-subsidy between tranches. Tranche B losses must not impair matured Tranche A claims, and Tranche A fixed obligations must not be paid from Tranche B assets.

## Keeper and Controls

Keeper actions:

- execute Pendle PT purchases for Tranche A deposits,
- redeem matured PT,
- optionally roll matured Tranche A lots,
- execute GMX GLV deposits and withdrawals,
- rebalance enabled GLV allocations,
- claim and reinvest any explicit rewards,
- update off-chain monitoring data.

Required controls:

- per-market deposit caps,
- minimum PT out and maximum slippage,
- approved Pendle market allowlist,
- approved GMX GLV allowlist,
- maximum Tranche B allocation per GLV,
- pause switches per tranche,
- stale oracle and stale API guards for UI quoting,
- emergency withdrawal path that does not rely on new deposits.

## Recommended First Version

Build the first version with:

- Tranche A: one Pendle maturity series at a time, starting with PT-USDai expiring 2026-10-15 if the remaining tenor is still useful at deployment time.
- Tranche B: one GMX GLV, `[ETH-USDC]`, before adding multi-GLV allocation logic.
- USDC as the user deposit and withdrawal asset where routing supports it.
- Explicit disclosure that Tranche A is fixed in the Pendle accounting asset, not risk-free USD.
- No leverage at the vault level.

Before writing contracts, validate the full deposit, redeem, withdraw, and emergency flows on an Arbitrum fork using the exact Pendle market and GMX GLV addresses selected for deployment.
