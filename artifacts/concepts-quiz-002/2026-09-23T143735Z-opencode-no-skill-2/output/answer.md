# First-Month Operational Read: USDC Yield Vault

## TL;DR

At $8,000 TVL on Ethereum mainnet, the harvest incentive is broken by ~2–3
orders of magnitude. No rational keeper will ever call `harvest()`, yield will
sit unclaimed in the strategy, and depositors will see little or none of the
advertised 4%. The mainnet deployment decision — not the 1% fee — is the
thing that should change before launch.

## The math that governs everything

- Yield accrual: $8,000 × 4% ≈ **$26.67/month ≈ $0.88/day**
- Keeper reward (1% of what's claimed):
  - harvest daily → **$0.009** per call
  - harvest weekly → **$0.06** per call
  - harvest monthly → **$0.27** per call
- Mainnet gas for a harvest (claim + swap + redeposit, typically 300k–600k
  gas): roughly **$2–$10** depending on gas conditions.

Break-even: a keeper profits only when the claim is ≥ 100× the gas cost. At a
generous $2/tx, the vault must accrue **$200 of unclaimed yield** before any
keeper shows up — that's **~7.5 months** of accrual at current TVL. At $5/tx
it's ~19 months.

## What actually happens in month one

1. Deposits come in, funds go to the strategy, yield starts accruing.
2. `harvest()` is never called. The 1% fee on offer is pennies; calling it is
   a guaranteed loss. Permissionless harvesting only works when the fee covers
   gas plus a margin, and that requires roughly **$1.5M+ TVL** (for monthly
   harvests) or **$4.5M+ TVL** (for daily harvests) at these rates.
3. The consequences depend on how the strategy's yield is realized:
   - **If yield must be claimed via harvest** (reward tokens that need
     claiming/swapping, e.g. farm-and-dump strategies): depositors' share
     price never moves. Realized APY for the month is **0%**, not 4%.
   - **If base yield accrues natively** (e.g. Aave-style interest) and harvest
     only claims bonus incentives: depositors get the ~4% base, but the
     incentive portion is stranded and nothing compounds.
4. Either way, the compounding you're not getting is worth almost nothing:
   monthly compounding vs. simple interest at 4% on $8k is a difference of
   **~$5/year**. The harvest mechanism exists to realize yield, not to boost
   it — if it isn't realizing yield, the vault isn't delivering its headline
   number.

## What it means for depositors

- They were promised ~4% and may observe ~0% growth in share price for the
  entire first month. Expect support tickets and withdrawals.
- Mainnet gas also hits them directly: a deposit + withdraw round trip costs
  roughly $4–$20. A $500 depositor earns ~$20/year at 4% — transaction costs
  alone can consume 20–100% of their annual return. Mainnet is structurally
  hostile to the depositor size this TVL implies.

## What should change before launch

1. **Move to an L2 (Base, Arbitrum, etc.).** This is the real fix. Harvest
   gas drops to cents, the 1% keeper fee becomes viable at much lower TVL,
   and deposit/withdraw costs stop eating depositor returns. At $8k expected
   TVL, mainnet is the wrong venue, full stop.
2. **If you must stay on mainnet**, change one of:
   - Use a **self-accruing yield source** (interest that accrues in the
     share price without any claim step) so depositors earn even if harvest
     is never called, and treat `harvest()` as a bonus-incentive sweep.
   - **Run your own keeper** on a schedule, subsidized by the team, and say
     so. Budget roughly $25–$120/month in gas to harvest weekly — note this
     can exceed the entire month's yield ($26.67), so weekly is already
     uneconomic; quarterly is more honest.
3. **Keep the 1% fee as-is.** It's a reasonable parameter; it's simply
   inert at this scale. It becomes self-sustaining automatically once TVL
   crosses the break-even thresholds above.
4. **Set expectations in the UI/docs**: state the actual harvest cadence and
   that APY is realized on harvest, so depositors aren't surprised by a flat
   share price.

Bottom line: the vault mechanics are fine, but at $8k on mainnet the system
has no functioning harvest market and no economical way for small depositors
to enter and exit. Launch on an L2, or change the yield source so nothing
depends on `harvest()` being called.
