# Two-Tranche Yield Vault (Arbitrum) — Design

Status: draft, pre-code. All market data below checked 2026-09-21 (Arbitrum block ~507,452,329). Recheck before deploy; nothing here is fork-tested yet.

## Summary

| | Tranche A (fixed) | Tranche B (trader fees) |
|---|---|---|
| Protocol | Pendle V2 | GMX V2 |
| Position | PT-sUSDai, maturity 2027-02-25 | GLV [WETH-USDC] |
| How it earns | Buy PT at a discount, redeem at par at maturity | 63% of GMX fees + traders' net losses, accrued into GLV price |
| Current rate | ~10.1% implied APY (fixed at buy) | ~9.2% last 30d, ~14.7% since launch (variable) |
| Needs compounding? | No | No |
| Main risks | USD.AI credit, thin liquidity, 30-day exit queue | Trader PnL, ETH price exposure, async deposit/withdraw |

Important correction to the brief: **the keeper has nothing to compound in either tranche.** PT is a zero-coupon bond (no claimable yield); GLV fees accrue into its share price automatically and bonus incentives are currently 0. The keeper's real jobs are listed in [Keeper](#keeper).

---

## Tranche A — fixed rate via Pendle PT

### Protocol choice

Pendle is the only real source of onchain fixed rates on Arbitrum. But its Arbitrum market list is **very thin right now** — only 4 active markets, all from one issuer (USD.AI):

| Market | Address | Expiry | Liquidity | Implied APY | Usable? |
|---|---|---|---|---|---|
| sUSDai | `0xf86119a39f8654f38acbbd5488bd83f3f51983c8` | 2027-02-25 | $3.08M | 10.1% | **Yes — pick this** |
| sUSDai | `0xcbf629c8d396b1261f81f55175afa010e94787d8` | 2026-10-15 | $11.5M | 12.1% | No — expires in 24 days |
| USDai | `0xa8a0dea40174cfc30fea9e3a77f182ab33f46e25` | 2026-10-15 | $50.3M | 10.0% | No — expires in 24 days |
| USDai | `0x46f545683d8494ef4c54b7ea40ca762c620846ef` | 2027-02-25 | $57K | 7.3% | No — too thin |

Onchain reads for the chosen market (`readTokens()`):
- SY `0x30Ccf4Bbee313fCD19F3e295b3ba2920A24e2f62` (wraps sUSDai `0x0B2b2B2076d95dda7817e785989fE353fe955ef9`)
- PT `0xE9d07C2A3588b9a25Edd55664BE44eCfe5F92fce`
- YT `0x9Adc5Ff64705cCEDF6ba61cDaC124a720C0FF902`
- `expiry()` = 1803513600 (2027-02-25 00:00 UTC)
- SY tokens in: PYUSD `0x46850aD61C2B7d64d08c9C754F45254596696984`, USDai `0x0A1a…82EF`, sUSDai. **No USDC. Tokens out: sUSDai only.**

Consequence: tranche A is really "fixed rate on USD.AI credit". Capacity is small — a $3M pool can absorb maybe low-hundreds-of-thousands before slippage eats the rate. Set a hard deposit cap from measured price impact.

Alternative if this isn't acceptable: Pendle on Ethereum has far deeper, more diverse markets (DefiLlama: ~$725M vs ~$160M on Arbitrum), but that means bridging and leaves Arbitrum.

### How it earns

1. User deposits USDC. USDC is not an SY input, so vault swaps USDC → USDai first (Pendle Router's aggregator swap or a DEX), then USDai → SY → PT. Swap adds slippage and a USDai peg check.
2. PT trades below 1. The discount *at that moment* is the user's fixed rate. Example: pay 0.96 for PT worth 1 USDai at maturity.
3. At maturity, 1 PT redeems for 1 USDai worth of sUSDai. Nothing accrues or needs claiming in between.

"Locked at deposit time" means per-user accounting, not a shared pool NAV: store each deposit's PT amount (and so its rate). A user's payout = their PT redeemed. Pooling users into one share price would mix different entry rates.

Payout isn't instant USDC: redemption gives sUSDai, and turning sUSDai into USDai goes through USD.AI's ~30-day batched redemption queue (or a DEX sale at market price). Decide which the vault promises.

### Risks

- **Issuer credit risk (biggest).** sUSDai is backed by loans against physical GPUs plus T-bills. If loans default and sUSDai's value falls, PT redeems for less — "fixed" only holds if the underlying stays whole.
- **USDai peg risk.** PT pays out in USDai terms, not USDC.
- **Exit liquidity.** sUSDai → USDai is a ~30-day FIFO queue. Early exit before maturity = selling PT on the Pendle AMM at market price; if rates rose, the user takes a loss.
- **Thin market.** $3.08M liquidity → large deposits move the price and lower the rate. Also makes the spot PT price easy to manipulate — value PT with Pendle's TWAP oracle, never spot.
- **Rollover risk.** After 2027-02-25 there may be no next market. Only two maturities exist today.
- **Concentration.** Every usable Arbitrum market is the same issuer.
- **Contract risk.** Pendle Router/Market/SY + USD.AI contracts.

---

## Tranche B — trader fees via GMX V2

### Protocol choice

GMX V2 is Arbitrum's main onchain perp exchange, and its LPs are the counterparty to leveraged traders. Two ways in:

- **GM token** — one market (e.g. ETH/USD [ETH-USDC] `0x70d95587d40A2caf56bd97485aB3Eec10Bee6336`).
- **GLV** — a vault that spreads one GM backing across many markets and rebalances between them.

Pick **GLV [WETH-USDC]** `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9`: listed 2024-09-05, 54 enabled markets, ~$16.2M TVL, ~9.2% APY last 30 days / ~14.7% since launch, bonus APR 0. Spreading across markets lowers single-market trader-PnL risk; GMX does the rebalancing, so we don't.
(Runner-up: GLV [WBTC-USDC] `0xdF03EEd325b82bC1d4Db8b49c30ecc9E05104b96`, ~$13.8M.)

### How it earns

GLV value per token rises from:
- **63% of fees** on Arbitrum (37% to protocol): open/close fees, borrow fees, liquidation fees, swap fees.
- **Traders' net losses** go into the pool; **traders' net profits** come out of it.
- **Price of the backing assets**: roughly half WETH, half USDC. GLV moves with ETH price. This is not a pure fee yield.

Fees go straight into the pool; there's nothing to claim. Holding GLV is enough.

### Integration notes

- Deposits/withdrawals take two steps: vault calls `createGlvDeposit` / `createGlvWithdrawal` via ExchangeRouter with an ETH execution fee, then a GMX keeper runs it in a later tx. So the vault needs a "pending" state and callback handling (including cancellations). No atomic "deposit and get shares".
- Minting/burning can pay price impact; always set `minGlvTokens` / min-out.
- Value GLV using GMX's Reader/oracle pricing, not a DEX price.

### Risks

- **Trader PnL.** A run of profitable traders drains the pool. LPs are the house.
- **ETH exposure.** ~50% WETH backing, so tranche B loses in an ETH drawdown even if fees are good. Say this plainly to users, or hedge it (extra complexity; not in v1).
- **Withdrawal lockup.** Liquidity reserved for open positions can't be withdrawn. If available liquidity hits zero, withdrawals wait until positions close.
- **GLV shift risk.** Automated rebalancing can leave GLV holding illiquid GM of a market that went bad.
- **ADL / price impact.** Auto-deleveraging protects the pool but is a stress signal; big mints/burns pay price impact.
- **Oracle / keeper dependency.** GMX prices come from its oracle keepers; if they stall, deposits and withdrawals stall.
- **Contract risk.** GMX V1 (GLP) was exploited for ~$42M on 2025-07-09 (funds returned minus a $5M bounty). V2 was confirmed unaffected, but this is a heavily-attacked codebase.

---

## Keeper

Neither position needs compounding. Real jobs:

- **A:** at maturity, redeem PT → sUSDai; start sUSDai redemption or roll into the next market if one exists and the user opted in.
- **B:** push pending GLV deposits/withdrawals, fund execution fees, watch for cancelled requests.
- **Both:** monitor for pause conditions (sUSDai value drop, USDai depeg, GLV withdraw liquidity near zero, oracle staleness).

If there's a reward token later (PENDLE on LP, GMX incentives), add a harvest job then — today there isn't one for these positions.

## Composition

"Tranche" usually means B absorbs A's losses first. In this design they are **two separate strategies** in one vault with no loss-sharing. If B is meant to backstop A's fixed rate, that's a much bigger design (and B would need to hold enough to cover a USD.AI loss). Decide before coding.

Before coding, test on an Arbitrum fork: full A flow (USDC → PT → warp to maturity → redeem → sUSDai), full B flow (create deposit → keeper execute → withdraw), and failure cases (GLV withdrawal with zero liquidity, cancelled GMX order, PT sold early after a rate spike, sUSDai value drop).

## Sources (checked 2026-09-21)

- Pendle markets API: `https://api-v2.pendle.finance/core/v1/42161/markets/active`
- GMX API: `https://arbitrum-api.gmxinfra.io/glvs/info`, `/markets/info`, `/apy?period=30d`, `/apy?period=total`
- Onchain `cast` reads on Arbitrum (market `expiry`/`readTokens`, SY `getTokensIn/Out`, GLV `name`/`totalSupply`)
- DefiLlama Pendle chain TVL: `https://api.llama.fi/protocol/pendle`
- [GMX docs — Providing liquidity](https://docs.gmx.io/docs/providing-liquidity/)
- [USD.AI docs — sUSDai](https://docs.usd.ai/depositor/susdai)
- [The Block — GMX $44M compensation plan](https://www.theblock.co/post/366890/gmx-44-million-compensation-plan)
- [Verichains — GMX $42M exploit analysis](https://blog.verichains.io/p/gmx-42m-exploit-root-cause-analysis)

## Open questions

1. Is USD.AI-only credit OK for tranche A, or go to Ethereum Pendle for deeper, more diverse markets?
2. Tranche A payout asset: sUSDai at maturity, or USDC after a ~30-day queue / DEX sale?
3. Tranche B: accept ETH price exposure, or hedge it?
4. Should B backstop A (real subordination) or stay separate?
5. Deposit caps per tranche?
