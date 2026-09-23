# Month-one operational read: USDC yield vault on Ethereum mainnet

## Bottom line up front

The design is fine in the long run, but the first month will look nothing like the
headline. At ~$8k of deposits earning 4% APY, the vault accrues roughly **$13–27 of
rewards in month one**. A permissionless `harvest()` with a 1% bounty pays a caller
**$0.13–0.27** for a call that costs **~$5–25 in mainnet gas**. The bounty is
40–75x short of break-even, so **nobody will call it — the rewards sit unclaimed and
the share price never moves.** Onchain, nothing is automatic: the yield only becomes
real when someone pays gas to claim it, and at this scale no stranger has a reason to.

## The numbers

Assumptions (stated so you can re-run them):

- Deposits ramp to $8k over the month → average balance ~$4k
- Gross rewards accrued: $4,000 × 4% / 12 ≈ **$13** (≈ $27 if all $8k landed day one)
- `harvest()` = claim + swap + re-deposit ≈ 250k–500k gas
- Mainnet gas at 3–15 gwei, ETH $2,500–3,500 → **~$5–25 per call** (central ~$10)
- A plain deposit or withdrawal costs ~$2–8 each way

Break-even arithmetic for an external keeper:

| Question | Threshold |
|---|---|
| Bounty covers gas (1% × harvest ≥ $10) | needs harvest ≥ $1,000 per call |
| ...at 4% APY, monthly yield = TVL/300 | needs **TVL ≥ ~$300,000** |
| Gas is a reasonable drag (≤10% of harvest) | needs harvest ≥ ~$100 → **TVL ≥ ~$30,000** |

You are ~40x below the first threshold and ~4x below the second. For month one, the
1% bounty is dead code — a well-intentioned incentive that cannot motivate anyone.

## What actually happens, week by week

- **Week 1:** Deposits trickle in. Rewards accrue offchain in the strategy at ~$0.40–0.90/day
  depending on balance. MEV/bot operators scan for profitable calls; this is not one,
  so they ignore it. The vault sits in its initial state.
- **Weeks 2–4:** Balance grows toward $8k. Accrued rewards cross ~$13. Nothing happens.
  No harvest is called because no rational actor spends $10 to earn $0.13. The share
  price is flat the entire month, and depositors' positions show 0% growth.
- **End of month:** Unless your team intervenes, the vault is indistinguishable from
  a box that holds USDC. If you do intervene and call `harvest()` yourselves, the
  depositors get their ~$13–27 minus the 1% bounty — but **your team pays ~$10 gas
  out of pocket against ~$13–27 of yield, a 40–75% drag on month-one economics.**
  You are the yield source de facto: the vault only compounds if you subsidize it.

## What this means for depositors

- **Realized APY in month one is ~0%** until a harvest happens, whenever that is.
  The 4% headline is what the strategy accrues, not what anyone experiences.
- **Small deposits net negative on mainnet.** A $500 depositor earns ~$1.70/month
  gross but pays ~$4–16 in round-trip gas to get in and out — weeks or months of
  yield gone before harvest drag is even counted. Roughly, depositors under ~$1–2k
  lose money; a $5k depositor takes ~2–4 weeks of yield to cover their own gas.
- **The optics are worse than the dollars.** A flat share price for a month on a
  "4% APY" product reads as broken. Small numbers, but reputation is the scarce
  asset at launch. Silence from the vault will be interpreted as a bug.

## What should change before launch

1. **Don't rely on the bounty — plan to run harvest yourselves, on a threshold, not
   a schedule.** Trigger when accrued rewards ≥ ~$100 (≈ gas × 10), which at this TVL
   means roughly quarterly, not monthly. Budget ~$5–25 per harvest as an explicit
   operating cost. Keep `harvest()` permissionless — it's harmless now and correct
   once TVL grows — just don't pretend the 1% is doing anything this month.
2. **Strongest option: launch on an L2 (Base/Arbitrum) instead.** Harvest gas drops
   to ~$0.05–0.50, which puts the 1% bounty near break-even even at $8k TVL, and
   depositor round-trip gas stops eating small deposits. At this scale, fixed mainnet
   costs ARE the story. If mainnet presence matters for credibility, wait until the
   keeper math supports it — external keepers become self-sustaining around ~$300k TVL.
3. **If you stay on mainnet, consider not harvesting at all in month one.** Let
   rewards accrue, tell depositors plainly: "4% APY accrues continuously and is
   realized at harvest; at current size we harvest quarterly." That's honest and
   beats a subsidized monthly harvest that costs half the yield.
4. **Set expectations before deposits arrive.** Month-one realized earnings ≈ $13–27
   total across all depositors, ~$0 until the first harvest, net-negative for small
   balances after gas. Say this up front; a small, explained number is fine. An
   unexplained flat number is not.
5. **Harden for small TVL.** Share-price inflation and rounding attacks are
   proportionally more attractive at $8k than at $8M — use the standard mitigations
   (virtual/dead shares, minimum first deposit) and verify USDC's 6 decimals survive
   the tiny per-harvest increments.
6. **Know who pays the 4%.** The strategy's counterparty is the real risk depositors
   bear. One sentence in your docs on where the yield comes from and what happens
   if it dries up is worth more than any of the above.

## The one-line version

Nothing onchain happens by itself, and at $8k TVL on mainnet nothing will: the 1%
bounty can't pay for the gas, so either you subsidize every harvest, skip harvesting
until rewards are meaningful, or launch where gas is cheap. Pick one deliberately
before launch — the current setup defaults to a silent vault and confused depositors.
