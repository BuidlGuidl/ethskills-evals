# First-Month Operational Read: USDC Yield Vault

## The math that governs everything

- $8,000 TVL at 4% APY = **~$320/year ≈ $26.67/month ≈ $0.88/day** of gross yield.
- The harvest incentive is 1% of what a given call claims:
  - Daily harvest: claims ~$0.88 → keeper earns **~$0.009**
  - Weekly harvest: claims ~$6.20 → keeper earns **~$0.06**
  - Monthly harvest: claims ~$26.67 → keeper earns **~$0.27**
- A harvest transaction on Ethereum mainnet (claim + swap/compound + vault
  accounting) typically runs 150k–400k gas. Even in quiet conditions
  (~5 gwei, ~$3,500 ETH) that's **$2.50–$7 per call**; in busy conditions it
  can be $10–$30+.

The keeper's reward is **1–2 orders of magnitude below the gas cost of calling
harvest() at every plausible cadence.** There is no frequency at which calling
harvest() is profitable for a third party.

## What actually happens once it's live

1. **Nobody calls harvest().** Permissionless keepers are rational; a function
   that pays $0.01–$0.27 for a $3–$15 transaction never gets called. Bots
   monitor exactly this kind of incentive and will ignore this vault.
2. **Yield accumulates unclaimed inside the strategy.** The 4% is still being
   generated, but it never gets claimed or compounded into the vault, so the
   vault's share price doesn't move. (Caveat: verify against your actual
   contracts — if share price reads through to the strategy's accrued balance,
   or if deposit/withdraw triggers an internal harvest, the impact is smaller.
   As described, harvest() is the only realization path.)
3. **Depositors who withdraw see ~0% return** — they get back principal (and
   may even lose money to their own gas), despite the strategy performing as
   expected. Expect confused support tickets and "the APY is fake" complaints.
4. **Eventually someone harvests at a loss** — most likely your own team,
   once the unclaimed amount is large enough to be worth eating the gas, or
   because depositors are complaining.

## What it means for depositors

- **Best case (team harvests monthly, absorbs gas):** ~$26.67 claimed, minus
  ~$0.27 keeper fee, minus $3–$15 gas paid by the team. Depositors receive
  roughly **$26/month → effective APY ~3.3–3.9%** instead of 4%. The team
  spends a meaningful fraction of the vault's entire revenue on gas.
- **Worst case (nobody harvests):** effective APY is **0%** for anyone who
  exits before a harvest occurs.
- **Per-depositor gas math is also bad:** a user depositing $1,000 earns
  ~$3.33/month gross. Their own deposit + withdraw transactions on mainnet
  can easily cost more than a full month of their yield. Small depositors are
  underwater on gas alone.

## What should change before launch

1. **Deploy to an L2 instead of mainnet (Base, Arbitrum, Optimism).** This is
   the single highest-impact change. At $0.01–$0.10 per harvest, the 1%
   keeper incentive becomes viable at reasonable cadences, deposit/withdraw
   gas stops eating depositor returns, and the vault works as designed at
   $8k TVL. Mainnet at this TVL is structurally uneconomic.
2. **If you must stay on mainnet, run your own harvester.** Treat gas as
   operating expense, harvest on a schedule (e.g., when claimable ≥ 5–10x the
   gas cost — roughly monthly at this TVL), and don't rely on the
   permissionless incentive doing anything.
3. **Harvest inside deposit/withdraw.** Realizing yield on user interactions
   guarantees depositors aren't stuck at 0% even if no external call ever
   happens, at marginal extra gas to users who are transacting anyway.
4. **Revisit the 1% keeper fee.** At this scale it pays out cents and buys you
   nothing; it only starts mattering at much higher TVL. Either accept it's
   vestigial for now, or pair it with a minimum/team-subsidized bounty.
5. **Set expectations publicly.** Quote a net-of-cost APY, disclose the
   harvest cadence, and warn small depositors that mainnet gas on their own
   transactions may exceed their yield at this vault size.

**Bottom line:** the strategy is fine; the deployment target and the keeper
incentive are mismatched to the TVL. On mainnet, harvest() is a dead function
and your depositors effectively earn 0% until you pay to harvest yourself.
Move to an L2, or plan to operate the harvester yourself and add harvest-on-
deposit/withdraw, before launch.
