# First-month operational read: USDC yield vault

## The number that decides everything

Nobody runs your vault for you. `harvest()` moves only when someone sends a
transaction and pays gas for it, and strangers will do that exactly when the 1%
caller fee is worth more than the gas. So put the two numbers side by side:

- **Monthly yield:** $8,000 × 4% / 12 ≈ **$26.67/month** (~$0.88/day)
- **Caller reward:** 1% of whatever one call claims
- **Breakeven:** a call is worth sending when the unclaimed rewards reach
  ~100× the gas cost of that call

On Ethereum mainnet, a claim-and-compound transaction costs on the order of
**$1–$10** depending on gas price (even in today's low-gas regime it is rarely
under a dollar). That means `harvest()` becomes profitable to call only after
roughly **$100–$1,000** of rewards have piled up unclaimed.

At $26.67/month of yield, that takes **4 to 37 months**.

## What actually happens in month one

`harvest()` is never called. Not sometimes — never. The incentive crosses zero
somewhere between month 4 and month 37, and before that point every would-be
caller loses money by calling. Your permissionless keeper mechanism is
economically inert at this TVL on this chain.

The vault doesn't break — deposits and withdrawals work, the strategy keeps
earning — but the compounding step simply doesn't occur. The rewards sit
unclaimed in the strategy all month.

## What that means for depositors

- **The advertised 4% is not realized on schedule.** If share price only
  updates when `harvest()` runs, depositors see a flat vault all month and the
  yield materializes in a lump months later, whenever the first profitable
  caller shows up.
- **Early withdrawers may donate their yield.** Anyone who exits before that
  first harvest leaves their accrued-but-unrealized share behind for whoever
  remains (exact behavior depends on your accounting, but someone eats the
  timing).
- **When harvest finally fires, the caller takes 1% of months of accrual** —
  small, but it's a leak your depositors absorb for a compounding cadence they
  never got.
- Nothing is stolen and nothing is stuck; the failure mode is silent
  underperformance, which is worse for trust than an explicit error.

## What to change before launch

1. **Get off mainnet, or get off the external-call design — one of the two.**
   At $8k TVL you cannot have both. On an L2 (Base, Arbitrum) the same call
   costs cents, the breakeven drops to days, and the 1% caller fee works as
   designed.
2. **If you stay on mainnet, remove the scheduled transaction entirely.**
   Accrue at read time from a timestamp and settle inside `deposit()` /
   `withdraw()` — let user activity advance the state machine instead of
   depending on a stranger who currently has no reason to exist. Compounding
   then happens whenever anyone touches the vault, for free.
3. **Don't paper over it by harvesting yourselves.** Twelve self-run harvests
   a month at mainnet gas costs more than the entire $26.67 monthly yield.
   You'd be running a negative-yield vault with extra steps.
4. **Raising the caller fee doesn't fix it.** Even at 100% of the claim, a
   day's accrual is under a dollar. The problem is TVL × APY vs. mainnet gas,
   not the fee parameter.

Bottom line: the contract logic is fine, the keeper economics are not. Either
deploy where a call costs cents, or design so no scheduled call exists. Ship
one of those two changes and the first month looks like the pitch; ship
neither and your depositors spend the month in a vault that earns but never
compounds.
