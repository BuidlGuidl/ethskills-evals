# Operational Read: USDC Vault, First Month on Mainnet

## The core problem: harvest() will almost never be called

The design is correct in principle — a permissionless `harvest()` rewarded
with 1% of the claim is the standard Yearn-style keeper pattern. The problem
is the **magnitude** of the numbers:

| Item | Value |
|---|---|
| Expected first-month deposits | ~$8,000 |
| Gross yield at 4% APY | ~$26.67/month (~$6.15/week) |
| Caller reward at 1% of claim | ~$0.27 (monthly cadence), ~$0.06 (weekly) |
| Mainnet gas for a harvest (claim + swap + redeposit, ~200–500k gas) | ~$2–15 depending on gas conditions |

A rational keeper calls `harvest()` when reward > gas + margin. Here the
reward is roughly **1–2 orders of magnitude** below the gas cost, even in
favorable gas conditions. So the correct prediction for month one is:

- **Nobody harvests.** Rewards accumulate unclaimed in the strategy while
  the vault sits idle. Smart contracts are state machines: no poke, no
  movement. "Permissionless" only works if the incentive clears costs.
- **Or your team harvests at a loss** from an operational EOA/bot, paying
  $2–15 in gas to move $26 of yield and collect $0.27. That's a subsidy,
  not an incentive — and it fails the "could this run forever with no
  team?" test.

The 1%-of-claim model scales with TVL. At Yearn-scale TVL, 1% of a large
harvest is hundreds of dollars and the pattern works. At $8k TVL on mainnet,
it breaks. The pattern isn't wrong — the chain + scale combination is.

## What that means for depositors

- **Advertised APY vs. reality.** If rewards must be claimed to accrue to
  share price, an unharvested vault pays depositors ~0% on the reward
  portion until someone claims. The yield isn't lost — it sits in the
  strategy and whoever eventually harvests (likely the team) moves it into
  the vault — but "compounding 4% APY" is only true while someone is
  willing to lose money calling `harvest()`.
- **Centralized operational dependency.** If the team runs a keeper bot to
  make the vault function, depositors' returns depend on that bot staying
  funded, online, and the team not disappearing. At that point this is a
  service, not a hyperstructure, and depositors should know that.
- **Optics.** Once deposits grow and a keeper does show up, the first call
  sweeps the whole backlog and takes 1% of it — fine, but worth
  understanding that the 1% cut is paid regardless of how long rewards sat.

## What to change before launch

Any one (or combination) of these; all beat shipping as-is:

1. **Deploy to an L2 (Base / Arbitrum / Optimism) instead of mainnet.**
   Gas drops to cents. The 1% incentive is still marginal at $8k TVL, but
   the economics stop being absurd. This is the single highest-impact fix.
2. **If mainnet is a hard requirement: replace the pure 1% model with a
   floored reward** — e.g. `max(1% of claim, fixed floor)`. At this scale a
   floor has to be a meaningful fraction of the entire month's yield, which
   is its own problem (~$27/month gross can't fund much keeper spend), so:
3. **Better at small TVL: harvest on user interaction.** Fold the harvest
   into `deposit()`/`withdraw()` so users' own transactions poke the state
   machine and gas is amortized across depositors. This removes the keeper
   dependency entirely at low volumes.
4. **Or explicitly run a subsidized keeper bot yourselves** and treat it as
   an operating cost (~$2–15 per call). Fine as a deliberate decision, bad
   as a surprise. If you do this, set a TVL threshold where the 1%
   permissionless incentive is expected to become self-sustaining, and
   document the transition plan.
5. **Re-derive before launch:** for a 1%-of-claim incentive at ~1 harvest/
   month to cover ~$2–15 gas, the claim needs to be roughly $200–1,500,
   i.e. TVL on the order of ~$60k–$450k at 4% APY. Below that,
   mainnet + percentage-only incentives won't poke the state machine.

## Bottom line

As specced, on mainnet with ~$8k expected deposits: `harvest()` is dead
code, compounding doesn't happen, and the vault only works if your team
quietly subsidizes it. Change the incentive model, move the harvest into
user flows, or move the deployment to an L2 — before launch, not after.
