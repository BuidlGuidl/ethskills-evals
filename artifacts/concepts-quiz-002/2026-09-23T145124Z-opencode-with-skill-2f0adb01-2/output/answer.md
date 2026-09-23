# Operational read: month one

## The short version

The vault's mechanics are fine, but the economics don't clear. At $8,000
TVL and 4% APY, there isn't enough yield to pay for the transactions that
manage it — on mainnet, nobody will ever call `harvest()` for profit, and
your depositors will pay more in gas than they earn in yield. The fix isn't
the code, it's the venue and the operating model.

## What actually happens once it's live

**The core fact: the contract does nothing on its own.** It's a state
machine. Deposits happen when depositors show up. Rewards accrue inside the
strategy. But moving that yield back into the vault requires someone to
call `harvest()` and pay gas — and there's no cron job, no bot that works
for free. So run the incentive math on the only transition that matters:

| | |
|---|---|
| Rewards generated in month 1 | ~$13–27 total (deposits ramp up; $8k × 4% / 12 = $26.67 at full balance) |
| Caller's 1% cut per harvest | **~$0.13–0.27** |
| Mainnet gas for a harvest (claim + swap + redeposit) | ~300–500k gas → **$2–20** per call at typical gas prices |
| Net profit for the caller | **Negative, by 10–100x** |

The permissionless-caller-with-a-bounty pattern is the right *shape* — it's
the Yearn model, and it's what makes compounding self-sustaining at scale.
But the incentive has to clear gas *plus* profit, and this one doesn't come
close. Bots do this math constantly; none of them will show up.

So the first month looks like this:

1. **Nobody calls `harvest()`.** Not once, unless you do it yourselves.
2. **You become the operator.** If you want the yield compounded, your team
   calls `harvest()` out of pocket. Each call burns a meaningful chunk of
   the month's entire yield — a ~$6 gas call to harvest ~$26 of rewards
   destroys ~23% of what the vault earned that month.
3. **If you don't, rewards just sit there.** Unclaimed, uncompounded. And
   that's almost fine — see below.

The bounty only becomes self-sustaining when 1% of a harvest exceeds gas.
Solving `0.01 × TVL × 0.04/12 > $6` gives **~$180k TVL just to break
even**, and bots want profit, so call it $250k+. At $8k you're 20–30x short.
The system you've designed "runs itself" at a scale 30x bigger than the one
you're launching into.

## What this means for depositors

- **Total vault-wide yield in month 1 is ~$13–27.** Split across all
  depositors.
- **A depositor's round trip on mainnet costs $5–20 in gas** (approve +
  deposit + withdraw, each a separate paid transaction).
- A $500 depositor earns ~$1.67/month — gas eats months of their yield.
  A $100 depositor earns ~$0.33/month — gas is 10–50x their *annual* yield.

On mainnet at this scale, most depositors **lose money by using the
vault**. It's yield-generating in theory and yield-destroying in practice.

And the compounding itself is nearly worthless here: compounding 4% monthly
vs. letting it accrue simply is worth ~7bps annually
((1 + 0.04/12)^12 ≈ 4.074% vs 4.000%). One harvest's gas exceeds years of
compounding benefit at this TVL.

## What should change before launch

1. **Deploy to an L2 (Base or Arbitrum), not mainnet.** This is the single
   biggest change. Gas drops from dollars to cents: depositors keep their
   yield, harvests cost pocket change, and the 1% bounty has a real chance
   of working. Mainnet makes sense at seven figures of TVL, not four.
2. **Stop relying on the bounty at this TVL.** Either accept that your team
   is the operator for the first months and budget for the gas, or better —
   **harvest lazily**: trigger the harvest inside `deposit()` and
   `withdraw()` so users' own transactions do the compounding on their way
   through. No separate incentive needed, no state transition left
   unpoked. This is the standard fix for low-TVL vaults.
3. **Harvest on a threshold, not a schedule.** There's no schedule anyway —
   nothing is automatic. Make the rule "harvest when pending rewards
   exceed ~20x the gas cost." At $8k/4% that means harvesting every few
   months, and that's fine, because (per above) compounding is only worth
   ~7bps here.
4. **If you stay on mainnet anyway:** set a minimum deposit, and tell
   depositors plainly what gas costs relative to expected yield at small
   balances.

Keep the permissionless design itself. No operator key gating `harvest()`
is the right call — it's censorship-resistant and it's the correct
architecture. The design isn't wrong. The venue and the economics are.