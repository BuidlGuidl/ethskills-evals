# Operational read: first month of the USDC vault

## The core problem: harvest() never pays for itself

The vault is a state machine — nothing compounds unless someone sends a
transaction and pays gas for it. The design assumes strangers will call
`harvest()` for the 1% caller fee. Run the numbers:

- Yield on $8,000 at 4% APY ≈ **$26.70/month ≈ $0.88/day**
- Caller fee if someone harvests once a month: 1% × $26.70 ≈ **$0.27**
- Caller fee if someone harvests daily: 1% × $0.88 ≈ **$0.009**
- Gas for a harvest on mainnet (claim + redeposit, roughly 200k–400k gas):
  **~$1–$10** depending on gas price and ETH price

The caller spends dollars to earn cents. At $8k TVL there is no gas price on
Ethereum mainnet at which this call is profitable, so the rational number of
harvests in month one is **zero**. A permissionless function with a fee that
doesn't cover its own gas is a state transition that silently never happens.

## What actually happens once it's live

- Deposits arrive, the strategy earns its ~4%, and **no one calls harvest()**.
  Rewards accumulate unclaimed in the strategy.
- Nothing breaks and nothing is stolen. The failure mode is benign: the
  vault's yield still accrues to the vault's position. What doesn't happen is
  the *compounding* step — claimed rewards being put back to work.
- Cost of that to depositors over the month: yield-on-yield of roughly
  $26.70 × 4% × half a month ≈ **$0.44 total, split across all depositors**.
  Economically irrelevant.
- One thing to verify in the underlying strategy: that unclaimed rewards
  don't expire, decay, or get diluted. If the protocol's rewards must be
  claimed within a window, "nobody harvests" goes from benign to a real loss.

## What this means for depositors

Effectively nothing in month one. They earn ~4% either way; the difference
between "harvested daily" and "never harvested" at this TVL is under a dollar
in aggregate. The risk is not financial, it's presentational: the 1% caller
fee advertises a self-sustaining mechanism that is in fact dead at this
scale, and anyone reading the contract can see that.

## What should change before launch

1. **Fold harvest into user flows.** Trigger the claim-and-compound inside
   `deposit()` and `withdraw()`. Users then advance the state machine as a
   side effect of their own transactions — no scheduled call and no caller
   fee needed at all. This is the cleanest fix and costs nothing.
2. **If you keep the standalone harvest():** treat it as dormant until TVL
   makes it viable, and have the team call it occasionally at a small,
   known gas loss. Breakeven math: at ~$2 gas and monthly harvests, the 1%
   fee covers gas at roughly **$60k TVL**; weekly harvests or higher gas push
   that into the low six figures. Below that, the incentive is decorative.
3. **Don't raise the caller fee to fix it.** The problem is scale, not the
   rate — even 100% of a monthly claim ($26.70) barely covers a few
   harvests, and a higher fee just takes yield from depositors.
4. **Confirm reward expiry behavior** in the strategy so "harvests happen
   late" is never "rewards are lost."

Bottom line: ship is safe, but the harvest incentive as designed will not
function at $8k TVL on mainnet. Either make compounding a side effect of
deposits/withdrawals, or accept that the team is the harvester for the first
few months and say so.
