# Two-Tranche Yield Vault (Arbitrum) — Design

Status: draft, pre-code. Evidence pulled 2026-09-21 from live APIs/docs (sources at bottom).
None of it has been checked with onchain reads or on a fork yet — see "Verification before code".

## TL;DR

| | Tranche A (fixed) | Tranche B (trader fees) |
|---|---|---|
| Venue | Pendle V2 — buy PT, hold to maturity | GMX V2 — GLV vault (ETH-USDC or WBTC-USDC) |
| Earns from | PT bought below par, redeems 1:1 in underlying at maturity | 63% of GMX fees + trader losses, built into the GLV price |
| Fixed? | Yes, in underlying terms, if held to maturity and underlying stays solvent | No — variable, can go negative |
| Main risk | USD.AI credit (only underlying on Arbitrum Pendle), thin liquidity | Trader PnL, ETH/BTC price exposure, withdrawal limits |
| Keeper job | Buy PT on deposit, redeem + pay out at maturity. **Nothing to compound.** | Handle GMX's two-step deposit/withdraw. **Nothing to compound** (fees auto-accrue). |

Two design issues to settle before writing code:
1. **"Tranche" is misleading.** A and B are two separate strategies. B does not absorb A's losses, and A does not fund B. Nothing is subordinated. Either call them "sleeves" or design a real waterfall (see open questions).
2. **"Keeper compounds both" has nothing to compound.** PT grows toward par by itself. GLV fees go straight into the token price. See §3.

---

## 1. Tranche A — fixed rate via Pendle PT

### Venue
Pendle V2 on Arbitrum. Pendle splits a yield-bearing token into PT (principal) and YT (yield).
PT trades below par and redeems 1:1 for the underlying at expiry. So buying PT today locks the rate.

**Active Arbitrum markets on 2026-09-21** (Pendle API, chain 42161). This is the full list:

| Market | Address | Expiry | Liquidity | Implied APY |
|---|---|---|---|---|
| PT-USDai | `0xa8a0dea40174cfc30fea9e3a77f182ab33f46e25` | 2026-10-15 | $50.3M | 10.0% |
| PT-sUSDai | `0xcbf629c8d396b1261f81f55175afa010e94787d8` | 2026-10-15 | $11.5M | 12.1% |
| PT-sUSDai | `0xf86119a39f8654f38acbbd5488bd83f3f51983c8` | 2027-02-25 | $3.1M | 10.1% |
| PT-USDai | `0x46f545683d8494ef4c54b7ea40ca762c620846ef` | 2027-02-25 | $57k | 7.3% |

What this means:
- The Oct-15 markets are 24 days from expiry, too short to sell as a "fixed-rate product".
- The only usable maturity is **2027-02-25 PT-sUSDai**, with ~$3.1M liquidity. That puts a hard cap on
  deposit size: price impact on large buys will eat into the quoted rate.
- Every Arbitrum Pendle market has the same issuer: USD.AI. So tranche A on Arbitrum is really
  "fixed rate on USD.AI credit". There is currently no ETH-LST, sUSDe, or major-stablecoin PT to choose instead.
  Pendle has more markets on Ethereum mainnet. Using them would mean bridging, which is out of scope unless we decide otherwise.

### How it earns
1. User deposits USDC. Keeper (or the deposit tx) swaps into sUSDai/SY, then buys PT through the Pendle router with `minPtOut`.
2. Rate = discount at purchase: `(1 / ptPrice)^(1/yearsToExpiry) - 1`. This is locked **per deposit**, not per vault.
3. At expiry, PT redeems via SY for sUSDai worth 1 USDai per PT. Vault unwinds to USDC and pays out.

Nothing accrues between buy and maturity except the PT price drifting toward par.
Mark-to-market before maturity can drop if rates rise. Only holding to maturity locks the rate.

### Accounting implication
Each deposit gets a different rate, so a single pooled ERC-4626 share doesn't fit.
Options:
- **One series per maturity** (ERC-4626 vault per PT expiry). Shares = pro-rata PT. The rate differs slightly by entry time. Simple. (recommended)
- Per-deposit NFT receipt recording PT amount + maturity. Exact rate per user, more complex.

Early exit = sell PT on the AMM at the market price. That may be a loss, and there's only $3.1M of depth.

### Risks
- **Underlying credit/depeg.** PT is fixed only in USDai terms. USDai is backed by PYUSD reserves plus GPU-backed loans.
  sUSDai yield comes from those loans (GPU operator borrowers, GPU collateral that depreciates).
  A loan default or USDai depeg hits the principal. The "fixed rate" is not a guarantee.
- **Liquidity.** Thin markets mean price impact on entry and exit, and possibly nowhere to buy the next maturity.
- **Redemption path.** Getting from sUSDai to USDai to USDC may involve a redemption queue/delay or a DEX swap with slippage. *Unverified — must check before promising a payout date.*
- **Rollover changes the rate.** Rolling at maturity buys at whatever rate exists then. A "locked" rate only holds for one maturity.
- **Pendle contract/oracle risk.** Router, SY adapter, and the PT oracle, if we price shares with it (use the TWAP oracle, never spot).
- **Concentration.** One issuer, one chain, one maturity.
- **Points/incentives.** These markets are tagged "points". Implied APY may rely on points that the PT holder gives up (YT gets them). Don't advertise more than the PT discount.

---

## 2. Tranche B — trader fees via GMX V2 GLV

### Venue
GMX V2 on Arbitrum. GMX is the main perp venue on the chain. GM pools act as counterparty to leveraged traders.
GLV is GMX's vault over many GM pools. It rebalances automatically between them.

**Candidates on 2026-09-21** (GMX Arbitrum API):

| Vault | Address | TVL | 30d APY |
|---|---|---|---|
| GLV [ETH-USDC] | `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9` | ~$16.2M, 54 markets | 9.2% |
| GLV [WBTC.b-USDC] | `0xdF03EEd325b82bC1d4Db8b49c30ecc9E05104b96` | ~$13.8M, 40 markets | 8.6% |

Recommend GLV over single GM pools: more diversified across markets, and GMX handles rebalancing, so we don't.
Pick one to start (ETH-USDC). Adding the second is a later change.

Note: this is GMX **V2**. V1/GLP was exploited in July 2025 and is being phased out. V1 LPs were compensated in GLV. V2 was not affected.

### How it earns
- LPs get **63% of fees on Arbitrum** (37% to protocol): opening/closing fees, swap fees, borrow fees, liquidation fees.
- LPs are the **counterparty to traders**. Trader losses raise pool value. Trader profits lower it.
- Funding is mostly paid between longs and shorts, not to LPs. Don't count it as LP income.
- Everything accrues into the GM/GLV token price. **No claim step.** APY shown = change in token price, which already nets out trader PnL.

So "earns the fees leveraged traders pay" is only half true. The user also takes the other side of every trader's bet. Say this in user-facing docs.

### Mechanics that affect our contracts
- Deposits and withdrawals are **two-step and asynchronous**: we create a request and pay an execution fee in ETH, then a GMX keeper executes it later (or cancels it).
  Vault needs pending-request state, callback handling (or polling), and ETH to pay execution fees (excess is refunded).
- Share price must use GMX's reader/oracle pricing. Never use a DEX price.
- Withdrawals can be limited by reserved open interest. Users can't always exit on demand.

### Risks
- **Trader PnL.** If traders win on net over a period, tranche B loses money, even with fees coming in. GMX caps it with `MAX_PNL_FACTOR`, which limits the damage but doesn't stop losses.
- **Market exposure.** GLV [ETH-USDC] holds ETH plus USDC, so the user is partly long ETH. A 30% ETH drop hurts the position regardless of fees. Disclose it, or pick a stable-heavy GLV if one ever has depth (USDG GLV is empty, $162).
- **OI imbalance.** If most traders are on one side, the pool is effectively taking a directional bet.
- **Withdrawal limits / ADL.** Liquidity reserved for open positions can block redemptions. Auto-deleveraging kicks in when things get stressed.
- **Oracle risk.** GMX executes at oracle prices. An oracle fault or delay affects both pricing and PnL.
- **Keeper/liveness.** Our flow depends on GMX keepers. Requests can sit pending or be cancelled. Execution fees can spike.
- **Contract risk.** GMX V2 is large and upgradeable, and the team had a V1 exploit in 2025.
- **Wrapped assets.** WBTC.b-based vault adds bridge/wrapper risk.

---

## 3. Keeper role (rescoped)

"Compounding" doesn't apply to either position:
- PT: no rewards to claim. PT only accretes toward par. (We don't hold LP, so no PENDLE emissions.)
- GLV: fees are already inside the token price. Current `bonusApr` = 0, so there are no incentives to claim.

What the keeper actually does:
- **A:** batch pending USDC deposits → buy PT (slippage limit, max size vs pool depth). At expiry → redeem PT → unwind to USDC → open claims. Optional rollover **only if the user opts in**.
- **B:** batch deposits → create GLV deposit requests → handle execute/cancel → mint shares. Same for withdrawals. Keep an ETH balance for execution fees.
- Both: pause if an oracle deviates, the rate drops below a floor, or a pool gets too thin.

If incentives show up later (Pendle LP rewards, GMX bonus APR), add a claim-and-reinvest step then. Don't build it now.

## 4. Architecture sketch

- Two separate vault contracts that share no funds. A bug or loss in B must not touch A's PT.
- A: one ERC-4626-style vault per PT maturity. B: one async vault (ERC-7540-style request/claim) for GLV.
- Thin router for the user-facing "pick a tranche" deposit.
- Keeper role limited to calling specific functions with bounded parameters. It can't move funds anywhere else.

## 5. Verification before code

Per our integration rule: confirm with onchain reads and on a fork, not just APIs.
- [ ] Onchain read: each Pendle market's `expiry`, `readTokens`, SY `assetInfo`, and PT oracle readiness (`getOracleState`).
- [ ] Confirm the sUSDai → USDai → USDC redemption path: queue, delay, fees.
- [ ] Onchain read: GLV token, GLV reader pricing, and the fee split parameters (confirm 63%).
- [ ] Fork test A: deposit → buy PT at realistic size (price impact vs $3.1M depth) → warp past expiry → redeem → USDC out.
- [ ] Fork test B: deposit request → keeper execution → callback → withdrawal request, including the cancelled-request path.
- [ ] Failure tests: GMX request cancelled, Pendle slippage revert, USDai depeg (mock), withdrawal blocked by reserved OI, keeper offline at maturity.
- [ ] Trace every approval, and revoke leftover allowances after each action.

## Open questions

1. Is a real waterfall (B absorbs A's losses first) wanted? That's a different, harder product. Right now A and B are independent.
2. Is USD.AI credit acceptable as tranche A's only underlying? If not, A needs mainnet Pendle (bridging) or a different fixed-rate source.
3. Rollover at maturity: automatic (rate not fixed across periods), opt-in, or pay out only?
4. Tranche B: is partial ETH/BTC exposure OK, or does B need to be USD-neutral? (No usable stable GLV today.)
5. Deposit caps per tranche, given A's ~$3.1M PT depth.

## Sources (fetched 2026-09-21)
- Pendle Arbitrum active markets API: https://api-v2.pendle.finance/core/v1/42161/markets/active
- GMX Arbitrum GLV info: https://arbitrum-api.gmxinfra.io/glvs/info, APY: https://arbitrum-api.gmxinfra.io/apy?period=30d
- GMX docs, providing liquidity: https://docs.gmx.io/docs/providing-liquidity
- GMX V1 GLP distribution post: https://gmxio.substack.com/p/gmx-successfully-completes-distribution
- USD.AI sUSDai: https://usd.ai/susdai ; 2026 YTD report: https://usd.ai/insights/usdai-2026-ytd-report-lighthouse
- Stablewatch USD.AI deep dive: https://www.stablewatch.io/research/usd-ai-deep-dive
