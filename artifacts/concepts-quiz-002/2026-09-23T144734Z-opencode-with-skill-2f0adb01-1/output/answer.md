# First-Month Operational Read: USDC Yield Vault

## The headline

**Nobody is going to call harvest().** Not because the mechanism is broken —
the 1%-to-the-caller design is the right pattern — but because at $8,000 AUM
on Ethereum mainnet, the economics are inverted. The vault will sit unharvested,
the share price won't move, and your depositors will see roughly 0% yield
unless your team pays out of pocket to poke the contract.

## The math

**What the vault earns:**

| | Amount |
|---|---|
| Deposits (month 1) | ~$8,000 |
| Gross yield at 4% APY | **~$27/month** (less if deposits trickle in — call it $13–27) |
| Per weekly harvest | ~$6.50 claimed |
| Caller's 1% of that | **~$0.07** |

**What a harvest costs:**

A claim-plus-swap-plus-redeposit on mainnet realistically runs 150k–400k gas.
Even in a quiet market that's **$1–10 per call**, plus priority fees.

So the incentive pays $0.07 and the call costs $1–10. A keeper bot that
harvests weekly loses ~$250/year to earn ~$3.50. No bot runs at a loss. No
rational human calls it either. **The permissionless harvest is dead code at
this AUM.** This exact design works for Yearn because their vaults hold
millions — 1% of a harvest clears gas by 100x. Scale, not the pattern, is
what's wrong here.

**When would it be profitable to call?** When 1% of pending rewards exceeds
gas, i.e. when pending rewards reach roughly $300–1,000. At ~$27/month of
accrual, that's **one to three years** between economically rational harvests.

## What actually happens, week by week

1. Deposits come in, the strategy deploys the USDC, and rewards begin
   accruing *inside the strategy* — but nothing happens onchain. A smart
   contract is a state machine: it sits in one state until someone pays gas
   to poke it. There is no cron job, no scheduler, no background process.
2. No keeper pokes harvest() because there's no profit in it. Rewards
   accumulate unclaimed. The vault's share price does not move.
3. Any UI or dashboard that reports yield from harvested amounts shows
   **~0.00% APY** — a vault that markets 4% and displays 0. Your depositors
   will notice.
4. The only party with a reason to call harvest() is you. Every call costs
   your team $1–10 in gas to deliver ~$6.50 of yield. You are not running an
   incentive-aligned protocol this month — you're running a subsidized
   service. That's a legitimate choice, but make it deliberately: budget the
   gas, decide the frequency (monthly, not weekly — at 4% APY the compounding
   difference is pennies; the gas burn is what's real), and don't mistake
   the 1% mechanism for something that will ever fire.

## What this means for depositors

- **Their yield isn't lost, but it isn't delivered.** Rewards sit in the
  strategy unclaimed; depositors' value exists but is invisible until a
  harvest happens and the share price ticks up.
- **Small depositors can be net negative on mainnet.** A $500 depositor earns
  ~$20/year at 4%. Two round trips (deposit + withdraw) at $1–5 of mainnet
  gas each can eat half or more of a year's yield. Anyone depositing under a
  few hundred dollars is volunteering to lose money on this chain.
- **If your team disappears, the vault freezes.** Harvests stop, the share
  price locks, and depositors' only recourse is withdrawal of principal.
  Right now the honest answer to "could this run forever with no team behind
  it?" is **no** — at this scale, you're a service, not a hyperstructure.

## What should change before launch

1. **Deploy to an L2 instead (Base, Arbitrum, Optimism).** This is the single
   biggest fix. A harvest costing cents instead of dollars makes the 1%
   incentive plausibly self-sustaining at $8k AUM, makes your own keeper
   operations negligible, and — critically — stops your depositors' gas from
   eating their yield. At this AUM, mainnet is the wrong venue.
2. **If you must stay on mainnet, add a minimum harvest threshold.** Don't let
   anyone call harvest() for a $6 claim. Require the pending rewards to exceed
   a floor (or let harvest revert below it) so gas isn't burned pointlessly
   and reward frequency is at least rational.
3. **Piggyback harvest on user interactions.** Trigger the harvest logic
   inside deposit/withdraw so the person already paying gas also advances the
   state — everyone's action keeps the vault fresh without a standalone keeper.
4. **If you keep standalone harvest() and run the keeper yourselves, call it
   what it is: a subsidy.** Budget for it, harvest on a long interval
   (monthly at most), and decide in advance when you'd stop paying.
5. **Reset depositor expectations.** The first month's *displayed* APY will
   round to zero regardless of what the strategy earns. Either disclose that
   plainly, or consider a minimum deposit size so mainnet gas can't put
   small depositors underwater.

## Bottom line

The design is fine; the venue and scale aren't. At $8,000 AUM, mainnet gas
exceeds the harvest incentive by 10–100x, so the vault's core loop — accrue,
claim, compound — never fires on its own, and the team becomes the operator
of a money-losing keeper. Ship it on an L2, or ship it on mainnet with a
harvest threshold, interaction-triggered harvesting, and an explicit
operational budget — but don't ship it as-is and expect the 1% to do anything
at all.