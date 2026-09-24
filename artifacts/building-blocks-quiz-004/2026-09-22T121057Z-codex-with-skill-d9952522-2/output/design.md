# Two-Tranche Yield Vault Design

Last reviewed: 2026-09-22
Target chain: Arbitrum

## Product Assumption

The vault is USDC-denominated at the user interface. Deposits may be routed through swaps when a venue's accounting asset is not USDC, but user-facing accounting, shares, limits, and reporting should stay in USDC terms.

Users choose one tranche at deposit time:

- Tranche A: fixed-rate, fixed-maturity claim.
- Tranche B: variable-rate claim on leveraged-trading liquidity fees.

The tranches should be accounted separately. Tranche A should not depend on Tranche B profits to meet its promised maturity amount, and Tranche B should not inherit Tranche A's Pendle position risk except through shared vault infrastructure bugs.

## Venue Selection

| Tranche | Protocol | Initial Venue | Rationale |
| --- | --- | --- | --- |
| A | Pendle V2 on Arbitrum | Buy Pendle Principal Tokens for the selected maturity, starting with active USDai or sUSDai PT markets such as `PT-sUSDai-25FEB2027` when liquidity is acceptable. | Pendle PTs trade below their maturity redemption value. Buying PT at deposit time locks the fixed return if held until maturity. |
| B | GMX V2 on Arbitrum | Provide liquidity to GMX GLV, primarily `GLV [ETH-USDC]`; optionally cap and diversify into `GLV [WBTC.b-USDC]`. | GMX liquidity backs leveraged trading and swaps. Fees from trading, borrowing, liquidations, and swaps accrue into GM/GLV pool value. |

Live checks on 2026-09-22:

- Pendle Arbitrum API returned active chain `42161` markets for `PT-USDai-15OCT2026`, `PT-sUSDai-15OCT2026`, `PT-sUSDai-25FEB2027`, and `PT-USDai-25FEB2027`, with data timestamp `2026-09-22T12:11:00.000Z`.
- GMX Arbitrum GLV API listed `GLV [ETH-USDC]` at token `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9` and `GLV [WBTC.b-USDC]` at token `0xdF03EEd325b82bC1d4Db8b49c30ecc9E05104b96`, both `isListed: true`.
- GMX 30-day APY API showed `GLV [ETH-USDC]` at about `9.27%` fee APY and `GLV [WBTC.b-USDC]` at about `8.79%` fee APY. These are variable historical figures, not promises.

References:

- Pendle PT mechanics: https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/PT
- Pendle fixed-yield explanation: https://docs.pendle.finance/pendle-academy/optimizing-yields-with-pendle/chapter-3.1-fixed-yield-on-pendle
- Pendle Arbitrum market API: https://api-v2.pendle.finance/core/v1/42161/markets?limit=20&is_expired=false
- GMX liquidity mechanics: https://docs.gmx.io/docs/providing-liquidity/
- GMX Arbitrum liquidity APIs: https://docs.gmx.io/docs/api/rest-api/liquidity/

## Tranche A: Fixed Maturity Position

Tranche A deploys user funds into Pendle PTs for the chosen maturity.

Deposit flow:

1. User selects Tranche A and a maturity supported by the vault.
2. The vault quotes the current Pendle route from USDC into the target PT.
3. The fixed rate is derived from the actual executable quote after slippage, swap fees, protocol fees, and a configured safety buffer.
4. On deposit, the vault buys PT and records the user's maturity claim in accounting-asset terms.
5. At maturity, the keeper redeems PT through Pendle and converts the redeemed asset back to USDC if needed.

How it earns:

- A PT represents a claim on the principal portion of a yield-bearing asset.
- PTs can be bought at a discount to their maturity redemption amount.
- The user's fixed yield is the difference between the cost paid at deposit and the redemption value at maturity.
- There is no periodic yield claim needed for the basic PT position; the return is realized when PT converges to redemption value.

Keeper role:

- Batch small deposits where doing so improves execution.
- Enforce maturity-specific capacity, minimum liquidity, maximum slippage, and maximum discount/price-staleness checks.
- Redeem PT at maturity.
- Reinvest or roll matured unclaimed assets only after the owed fixed claims are fully reserved.
- Claim and reinvest any incidental rewards only if the selected PT market exposes rewards to holders; the design must not rely on rewards to satisfy fixed claims.

Tranche A risks:

- Pendle smart-contract risk.
- Underlying asset risk, especially USDai or sUSDai credit, RWA, issuer, custody, redemption, and depeg risk.
- Accounting mismatch if the user expects USDC but the PT redeems to USDai-denominated value; the vault needs a conversion buffer.
- Slippage and route failure when entering or exiting PT.
- Early-exit market risk: before maturity, PT may trade below the user's entry value.
- Liquidity risk near maturity or during market stress.
- Maturity mismatch if deposits are accepted after the selected PT market no longer has enough duration or depth.
- Oracle and pricing risk in any quote, NAV, or USDC conversion path.
- Keeper liveness risk around redemption and conversion, though the fixed return should be backed by the PT position rather than keeper timing.
- Arbitrum bridge and sequencer risk.

## Tranche B: Leveraged-Trading Fee Position

Tranche B deploys user funds into GMX V2 liquidity, initially through GLV vault tokens.

Deposit flow:

1. User selects Tranche B.
2. The vault routes USDC into the token mix required by the selected GLV or GM pool.
3. The vault mints/buys GLV or GM tokens, respecting GMX deposit caps, price impact, and available liquidity.
4. The user's shares track the vault's pro-rata GLV/GM position value.
5. Withdrawals sell GLV/GM back into USDC, subject to GMX liquidity and price impact.

How it earns:

- GMX pools are counterparties to leveraged traders and support swaps.
- Fees from trading, borrowing, swaps, and liquidations increase the value of GM/GLV pool tokens over time.
- On Arbitrum, GMX docs state that 63% of collected fees go to liquidity pools and 37% to the protocol.
- GLV vaults can allocate across multiple GM markets, so the vault can get diversified exposure without manually selecting every market.
- GMX fees generally accrue into the pool token price, so holding GLV/GM is the main earning action.

Keeper role:

- Reinvest any separately claimable rewards or incentives into the selected GLV/GM venue.
- Rebalance between approved GMX venues when exposure, APY, utilization, disabled-market flags, or price impact crosses configured thresholds.
- Avoid deposits when GMX reports disabled markets, poor liquidity, high price impact, exhausted redemption liquidity, or stale API/onchain state.
- Periodically checkpoint NAV for share accounting and risk limits.

Tranche B risks:

- Counterparty risk to traders: if traders win, the pool pays those profits and GLV/GM value can fall.
- Market exposure: `GLV [ETH-USDC]` carries ETH and USDC exposure; `GLV [WBTC.b-USDC]` carries BTC and USDC exposure.
- Variable fee risk: trading volume, borrow utilization, liquidation activity, and incentives can decline.
- Open-interest imbalance risk, where one-sided trader positioning can stress pool economics.
- GMX redemption liquidity risk from reserve factors, open-interest caps, and pending PnL caps.
- Price impact on deposits, withdrawals, and GLV/GM shifts.
- GLV composition risk because GLV can shift liquidity among supported GM markets.
- Synthetic-market risk if a supported market's index token is not the same as its backing long token.
- Oracle and liquidation risk in GMX market operations.
- Smart-contract risk across GMX, token approvals, and vault accounting.
- Stablecoin depeg and bridged-token risk for USDC and any backing assets.
- Arbitrum bridge and sequencer risk.

## Guardrails Before Implementation

- Maintain separate accounting buckets for A assets, B assets, liabilities, fees, and buffers.
- Never quote Tranche A's fixed rate from headline APY alone; quote from executable PT output.
- Add maturity-specific caps for Tranche A based on live PT liquidity and days to maturity.
- Add venue-specific caps for Tranche B based on GMX liquidity, utilization, and redemption availability.
- Use allowlisted routes only; no arbitrary swap target from keeper calldata.
- Store per-deposit Tranche A promised amount, maturity, PT market, executed PT received, and conversion assumptions.
- Store Tranche B share price from onchain GMX reader values, not only offchain API data.
- Treat all offchain APY numbers as display-only.
- Include emergency modes: pause deposits, pause compounding, disable a venue, allow pro-rata withdrawals, and process matured A redemptions.
