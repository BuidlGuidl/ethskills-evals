# First-month operational read: USDC yield vault

## The core problem: harvest() has no caller

Nothing onchain runs itself. The vault only compounds when someone sends a
transaction and pays gas for it, so the whole design rests on one question:
does the 1% caller fee pay for the call? Put the numbers next to each other:

- **Yield accrued:** $8,000 × 4% ≈ $320/year ≈ **$0.88/day** (~$26.70 for the
  whole first month).
- **Caller's reward:** 1% of whatever the call claims. If a harvest fires
  daily it pays **~$0.009**. If it fires monthly it pays **~$0.27**.
- **Caller's cost:** a harvest that claims from a strategy and re-deposits is
  roughly 200k–400k gas. At today's unusually quiet conditions (~0.5 gwei,
  ETH ~$2,500) that's ~$0.25–$0.50; at ordinary mainnet conditions
  (5–25 gwei) it's **$2.50–$25**.

So the breakeven point is: accrued rewards ≥ 100 × gas cost. At $0.88/day of
accrual, that means waiting ~3 days just to cover today's rock-bottom gas,
~9 months to cover a $3 call, and years to cover a busy-day call. In
practice: **nobody calls harvest() in the first month, and at this TVL
nobody rationally calls it for a long time after.** Keeper bots do exactly
this math continuously; the function being permissionless doesn't help when
the reward is negative.

## What actually happens once it's live

1. Deposits come in and funds are routed to the strategy. That part works —
  depositors pay for their own transactions because it's their own money.
2. The strategy earns its ~4%, but the rewards sit unclaimed in the strategy.
   `harvest()` is never called because calling it loses money.
3. From the depositors' perspective the vault is a 0% APY vault. Share price
   doesn't move, because the yield only enters the vault when someone
   harvests. The advertised 4% exists, it's just stuck one transaction away
   and the transaction never comes.
4. The only ways the yield ever lands: you call harvest() yourself at a loss
   (you've quietly become the paid keeper you tried to avoid), or a
   depositor's own withdraw/deposit path happens to touch the rewards (it
   doesn't, in the design as described), or TVL grows ~100× so the 1% fee
   clears gas.

One more mainnet reality at this scale: gas is a flat tax on every
depositor. A $500 depositor paying $3–$10 round-trip on deposit and withdraw
fees has lost a large fraction of their entire year's yield (~$20) before
the strategy does anything. Even with a working harvest, mainnet deposit
economics are hostile to $8k of small deposits.

## What should change before launch

1. **Don't deploy this to mainnet at this size.** The same contract on an L2
   (Base, Arbitrum) makes harvest cost well under a cent, so the 1% fee
   clears gas after a day or two of accrual and strangers actually advance
   your state machine. This is the single change that fixes the design as
   written. Depositor round-trip gas also drops to negligible, which matters
   at these deposit sizes.
2. **If you stay on mainnet, delete the scheduled transaction instead of
   subsidizing it.** Accrue lazily: value shares from the strategy's
   claimable-rewards view (or settle rewards inside deposit/withdraw, which
   users already pay for). If the strategy genuinely requires a poke to
   claim, fold that poke into the next user transaction rather than a
   standalone permissionless function nobody is paid enough to call.
3. **Raising the caller fee is not a fix.** The fee comes out of depositor
   yield; at $26/month of total yield there is no percentage that both pays
   mainnet gas and leaves depositors a meaningful return. The constraint is
   TVL × APY vs gas, not the fee parameter.
4. **If you ship it as-is anyway, write down the operational truth:** the
   team is the keeper, harvesting is a scheduled cost you eat, and
   compounding stops the day you stop. That's an owner-run maintenance loop
   wearing a permissionless costume — fine as a deliberate choice, not fine
   as a surprise in month two.

Bottom line: the mechanism is sound, the venue and scale are not. Move the
vault to an L2, or restructure so no one has to be paid to make it work.
