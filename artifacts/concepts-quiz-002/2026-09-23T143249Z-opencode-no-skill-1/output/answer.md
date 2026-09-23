# First-month operational read: USDC yield vault

## The arithmetic that governs everything

- $8,000 TVL at 4% APY ≈ **$320/year ≈ $27/month ≈ $0.88/day** of yield.
- A `harvest()` on Ethereum mainnet (claim + swap + redeposit) typically costs
  **~$5–$40 in gas** depending on network conditions.
- The keeper incentive is 1% of what's claimed: a monthly harvest pays the
  caller **~$0.27**; a daily harvest pays **~$0.009**.

The incentive is short of the gas cost by roughly **two orders of magnitude**.
That single fact drives everything below.

## What actually happens once it's live

1. **Nobody calls `harvest()`.** It's permissionless, but rational actors only
   call it when 1% of the claim exceeds gas. That requires a claim of
   ~$500–$4,000, i.e. a TVL on the order of **$150k–$1M+** at 4% APY with
   monthly harvests. At $8k TVL, the incentive never clears the bar, no matter
   how long you wait — the accrued amount grows, but the vault grows so slowly
   that even years of accrual may not make it profitable under high gas.
2. **Yield sits unclaimed in the strategy.** If your share price only updates
   on harvest (the standard pattern), the vault's exchange rate stays flat.
   The vault looks dead: 0% realized APY, no compounding.
3. **If the team harvests out of pocket, you lose money every call.** One
   monthly harvest at ~$15 gas against ~$27 of monthly yield consumes over
   half the vault's entire earnings. Harvest more often than roughly every
   6–12 months and gas exceeds 100% of the yield — the vault would be better
   off never harvesting.
4. **Possible unfairness among depositors.** Depending on your accounting,
   depositors who withdraw before the first harvest forfeit their accrued
   yield; whoever is left when a harvest finally happens picks it up. Early
   exiters get principal only.

## What this means for depositors

- **Realized APY ≈ 0%** for the first month (and likely much longer), not the
  advertised 4%.
- **Their own gas costs dwarf the yield anyway.** A mainnet deposit +
  withdraw round trip costs ~$10–$60. A $500 depositor earning 4% makes
  ~$20/year — it takes 6–36 months of yield just to break even on their own
  transaction costs. Small depositors are structurally underwater on mainnet
  at these rates regardless of the harvest problem.
- Expect support tickets ("why isn't my balance growing?"), reputational
  damage, and withdrawals — which at $8k TVL can empty the vault fast.

## What should change before launch

In rough order of preference:

1. **Don't deploy this on mainnet at this size.** Move to an L2 (Base,
   Arbitrum, Optimism) where a harvest costs cents. There, the 1% incentive
   is workable, you can harvest daily, and your depositors' deposit/withdraw
   gas stops eating months of yield. This is the single highest-impact change.
2. **If you must be on mainnet, remove the harvest dependency.** Point the
   vault at a strategy where yield accrues natively without a keeper —
   e.g. an Aave aToken or similar accruing wrapper — so share price reflects
   yield continuously and no one ever needs to call `harvest()`.
3. **If harvest must exist on mainnet, don't rely on the permissionless
   incentive.** Run your own keeper with a threshold rule (only harvest when
   claimable > ~10× current gas cost) and treat the 1% fee as dead code at
   this TVL. Budget for it as an operating expense and be aware it will
   consume a large share of gross yield.
4. **Set depositor expectations honestly** (min deposit sizes, "yield accrues
   on harvest, which is infrequent") — but recognize this is a band-aid over
   an economics problem, not a fix.

**Bottom line:** as specified, the vault ships with a harvest function that
will never be called, depositors who earn ~0% while paying mainnet gas on
both ends, and a first month that ends in support load and outflows. The
design is sound at ~100× this TVL or on an L2 at this TVL — but not on
Ethereum mainnet with $8,000 of deposits. Change the venue or the accrual
mechanism before launch.
