# First-month operational read — USDC vault, Ethereum mainnet

**TL;DR:** At $8k of deposits and 4% APY, this vault produces roughly $13–27 of
total yield in its first month. A permissionless `harvest()` caller keeps 1% of
what they claim — about **$0.13–0.27** — while a mainnet harvest costs **$1–5+
in gas** (more in congestion). No rational keeper will ever call it. In month
one, *you* are the only keeper: either the team harvests manually at a loss, or
rewards sit unclaimed and depositors see a flat vault. The 1% bounty is not an
incentive at this scale; it's decoration. Nothing here is dangerous — the issue
is neglect, not attack. But if nothing changes, the vault's first month will
look broken to depositors.

---

## The numbers

| Quantity | Value |
|---|---|
| Deposits, month one | ~$8,000 (arriving over the month) |
| Gross annual yield at full balance | $8,000 × 4% = **$320/year** |
| Month-one yield if $8k were in from day 1 | ~$26.70 |
| Month-one yield with linear deposit ramp | **~$13** (avg balance ~$4k) |
| Bounty for harvesting a full month's claim | 1% → **$0.13–0.27** |
| Gas for `harvest()` (claim + swap + deposit, ~300–600k gas) | **~$1–5** typical at recent base fees; **$20+** in congestion |
| Claim size needed for bounty to cover $2–5 of gas | **$200–500** — i.e., 7–19 months of the vault's *entire* yield |
| TVL at which monthly bounty ≥ $2 gas | **~$60,000** (bounty/month ≈ TVL ÷ 30,000) |

Two conclusions fall straight out of this table:

1. **Expected external `harvest()` calls in month one: zero.** Profit-seeking
   keepers (including automated ones) skip negative-EV calls; the bounty covers
   only ~5–20% of gas in the *cheapest* regime. Even harvesting once a year
   ($320 claim, $3.20 bounty) barely clears a cheap tx — and no keeper will
   monitor a vault for that margin.
2. **The permissionless-keeper design doesn't activate at this scale.** It only
   turns economically rational somewhere around **$60k–150k TVL** at 4% APY.
   Until then, every harvest will be yours.

## What actually happens in month one

- Deposits trickle in. The strategy deploys them and yield accrues on the
  venue — but that yield is *claimable rewards*, not money in the vault yet.
- Nobody harvests. There is no rational caller, so the accrued $13–27 sits
  unclaimed.
- One caveat that changes everything: **how does your accounting treat pending
  rewards?** If `totalAssets()`/share price only counts post-harvest value
  (typical when yield arrives as reward tokens), the vault's chart is **flat
  for weeks**. If the strategy accrues in-kind (aToken-style) and `harvest()`
  only sweeps extra incentives, month one is smooth and most of the concern in
  this document shrinks. Your description — "claims the strategy's rewards and
  compounds them back into the vault" — sounds like the first case, and that's
  the case worth fixing before launch.
- Most likely end of month one: someone on your team calls `harvest()` once
  manually, paying ~$3 of gas to realize ~$13–27 for depositors. That's a cheap
  one-time subsidy and totally fine — the point is that it requires *your
  action*, and doing it *frequently* is where gas starts eating yield (see
  below).

## What this means for depositors

- **Realized APY in month one ≈ 0% until someone eats the gas.** The "4%"
  is theoretical. A depositor who puts in $1,000 on day 1 earns ~$3.30 in
  accrued yield over the month — but sees none of it until a harvest happens,
  and none of it *compounds* (which is what harvest is for).
- **Withdrawals before a harvest may forfeit accrued-but-unharvested yield** to
  remaining shareholders, depending on accounting. At this scale it's cents —
  but a depositor watching a flat share price for three weeks and then
  withdrawing is a support ticket and a Twitter post, not just a rounding error.
- **Gas drag is front-loaded.** At steady state, quarterly harvests cost ~3–4%
  of that quarter's yield; monthly harvests ~10–12%; annual harvests under 1%.
  Early months are the expensive ones because the balance is small.
- **Depositors' own gas matters too.** A deposit or withdrawal costs $1–5+
  (more in congestion). At 4% APY, $1,000 earns ~$0.80/month — so round-trip
  gas is days-to-weeks of yield. This is an argument against mainnet at this
  size independent of anything the vault does.
- What depositors will *perceive*: a vault advertising 4% that shows ~0% for a
  month. That perception gap is your real first-month risk.

## What should change before launch

1. **Decide who harvests — and plan for it to be you.** Don't rely on anonymous
   keepers at $8k TVL. Either commit to a manual cadence or run a
   threshold-based trigger: harvest when pending rewards ≥ ~$75–100 (≈
   quarterly at current scale). Threshold beats calendar because it
   self-adjusts as TVL grows, and at some point real keepers do take over.
2. **Fix or verify the accounting for pending rewards.** This is the single
   biggest lever on what depositors see. If share price can't reflect unharvested
   yield, a flat chart is guaranteed between harvests. If fixing that is out of
   scope, then harvest more often for optics and eat the cost — or at minimum
   brief your frontend so the APY shown doesn't overpromise.
3. **Seriously consider an L2 (Base, Arbitrum).** At $8k TVL and 4% APY,
   mainnet gas is a first-order cost — for you (harvests) and for depositors
   (deposits/withdrawals). On an L2, harvest gas is cents, the 1% bounty
   actually exceeds cost, and the permissionless design you built *works as
   designed*. If mainnet is non-negotiable (prestige, partners), fine — but
   budget harvest gas as a known operating cost and lower expectations
   accordingly.
4. **Keep the bounty at 1%.** Raising it can't close a 10–100x gap without
   giving away most of the yield (you'd need ~$2–5 per call, i.e., 10–20% of
   monthly yield, to make calls borderline-profitable — a bad trade vs. just
   doing it yourself). Lowering it to 0% also changes nothing, since the only
   caller is you anyway. 1% is harmless; it just isn't doing anything yet.
5. **Set depositor expectations.** Communicate gross (4%) vs. net-of-costs, and
   that month one is a ramp. Under-promise here; the delta between an
   advertised 4% and a flat first-month chart is what people remember.

## What's fine as-is

- **4% on USDC is realistic** (lending-rate territory, not a too-good-to-be-true
  rate that implies hidden risk).
- **Permissionless `harvest()` has no meaningful attack surface at this
  scale.** There's no MEV or sandwich value to extract from a $13 claim; an
  "early" harvest only wastes the caller's own gas; and by construction a
  caller can't take more than 1%. The 1% bounty only ever overpays by $0.27.
  No redesign needed on trust grounds.
- Compounding-at-harvest mechanics are standard and sound; they just need
  someone to press the button.

**Bottom line:** ship it if you must, but go in with eyes open: in month one
this vault has effectively no keeper, ~$13–27 of monthly yield that nobody has
an incentive to claim, and a depositor experience that will read as 0% until
your team pays for a harvest. Fix the pending-rewards optics, set the harvest
threshold, and reconsider the chain — those three cover almost all of the
first-month risk.
