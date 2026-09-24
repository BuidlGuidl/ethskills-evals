# Operational read: USDC yield vault, first month on mainnet

## Bottom line

At $8,000 TVL and 4% APY, this vault produces **$26.67 of gross yield in month one**
(~$0.88/day, $320/year). That number is smaller than the mainnet gas cost of
operating the vault. Concretely:

- **`harvest()` will never be called by an outside keeper.** The 1% caller reward
  is worth less than the gas to claim it, by a wide margin, at every plausible
  gas price. The "permissionless keeper" is decorative — in practice you are the
  keeper, paying gas out of pocket.
- **Most depositors will lose money to gas**, not to the strategy. A depositor
  under a few hundred dollars pays more to enter and exit than the vault will
  ever pay them.
- Deploying the contracts costs roughly **$100–250**, i.e. 4–9 months of the
  entire vault's gross yield, before a single depositor earns anything.

None of this is a bug in your code. It's a mismatch between the size of the vault
and the cost floor of the chain you picked. The fix is a deployment-target
decision, not a Solidity decision.

## The harvest math

Assume a harvest (claim + swap + redeposit) costs ~400k gas, ETH at $3,000.
Caller earns 1% of what the call claims, so they need **claimed ≥ 100 × gas cost**
to break even.

| Gas price | Harvest gas cost | Claim needed to break even | = how much vault yield |
|---|---|---|---|
| 3 gwei | $3.60 | $360 | 13.5 months |
| 8 gwei | $9.60 | $960 | 36 months |
| 20 gwei | $24.00 | $2,400 | 90 months |
| 50 gwei | $60.00 | $6,000 | 225 months |

Read the right-hand column carefully: **even at 3 gwei, one profitable harvest
requires more rewards than this vault generates in a full year** ($320). There is
no gas price at which a rational third party calls `harvest()`. Not "rarely" —
never.

So the realistic first month is:

1. You deploy. ~$100–250 of gas, gone.
2. Deposits trickle in toward $8,000. Each depositor pays their own gas.
3. Rewards accrue on-chain. Nobody harvests.
4. At some point you call `harvest()` yourself, paying ~$10, and pay *yourself*
   the 1% ($0.27) back. Net: you've spent ~36% of the year's yield on one tx.
5. Depositors see a realized APY somewhere between 0% and ~3.9%, depending
   entirely on the next section.

## The one thing to check before anything else

**Is yield credited continuously, or only when `harvest()` runs?**

- **Continuous (share price grows on its own).** If the strategy is
  Aave/Compound-style — the vault holds aUSDC/cUSDC and `totalAssets()` reflects
  accrued interest immediately — then the 4% is real whether or not anyone
  harvests. `harvest()` only matters for secondary reward tokens, and never
  calling it costs depositors little. This is the survivable case.
- **Harvest-gated (yield only lands when someone claims).** If rewards sit
  unclaimed in the strategy until `harvest()` runs, and `totalAssets()` doesn't
  count them, then **depositors earn a realized 0% until you personally pay gas
  to harvest.** Your advertised 4% is not what anyone receives.

If you're in the harvest-gated case, that is the single largest thing to fix, and
it's fixable in the accounting: make `totalAssets()` include the claimable
(pending) rewards so share price reflects them continuously, and let `harvest()`
be purely a settlement/compounding operation rather than the moment value appears.

## What this means for depositors

Same assumption, ~400k gas for an approve + deposit + withdraw round trip.

| Gas price | Round-trip gas | Deposit needed to break even over 1 yr | over 6 mo |
|---|---|---|---|
| 3 gwei | $3.60 | $90 | $180 |
| 8 gwei | $9.60 | $240 | $480 |
| 20 gwei | $24.00 | $600 | $1,200 |

These are **break-even**, not profit. A depositor needs several multiples of these
to earn a return that feels like a return. At 8 gwei, someone depositing $1,000
for a year nets ~$30 after gas and the harvest fee — real, but thin. Someone
depositing $200 for three months *loses* money with certainty, no matter how well
the strategy performs.

If your $8,000 arrives as, say, 20 depositors at $400 each, the majority of your
users end month one worse off than if they'd done nothing. That's the honest
depositor read, and it's the part most likely to turn into a support burden and a
reputational problem. It is also a disclosure issue: advertising "4% APY" without
the gas context is materially misleading at this size.

## Other things that bite at this TVL

- **ERC-4626 first-depositor inflation attack.** With $8k TVL this is cheap to
  pull off: attacker mints 1 wei of shares, donates USDC directly to the vault to
  inflate share price, and the next depositor's deposit rounds down to zero
  shares. Mitigate with OpenZeppelin's decimals-offset / virtual shares, **and**
  seed the vault yourself with a dead-address deposit at deploy. Don't ship
  without this.
- **Rounding direction.** USDC is 6 decimals, so rounding errors are relatively
  large. Every conversion must round in the vault's favour (deposit rounds shares
  down, withdraw rounds assets down). Verify with a fuzz test on
  deposit→withdraw round trips.
- **Deposit-before-harvest capture.** If yield is harvest-gated, anyone can
  deposit immediately before a harvest and capture a share of yield earned by
  prior depositors. At $26/month the profit is under gas, so nobody bothers — but
  it becomes a live exploit the moment TVL grows. Fixing `totalAssets()` as above
  closes it too.
- **Withdrawal liquidity.** If the underlying strategy has any lockup, cooldown,
  or withdrawal queue, find out what a full $8,000 exit looks like on a bad day
  and document it. Everyone leaving at once is a plausible month-one event at
  this size.
- **Concentration.** $8,000 could be two people. One withdrawal can halve TVL and
  make the per-depositor gas math dramatically worse for whoever stays.
- **USDC issuer risk.** USDC is upgradeable and has a blocklist. If the vault or
  strategy address is ever frozen, funds are stuck. Low probability, unbounded
  impact — worth a line in your docs.
- **Keys.** Decide now who can pause, upgrade, or change the strategy, and put it
  behind a multisig before there's real money. Retrofitting this after launch is
  much harder than doing it on day zero.

## What should change before launch

Ranked by how much it matters.

1. **Deploy to an L2 (Base, Arbitrum, or Optimism) instead of Ethereum mainnet.**
   This is the recommendation. Gas drops by ~100–1000x: a harvest costs cents, so
   the 1% keeper incentive actually functions as designed; small deposits become
   viable; deployment costs a few dollars. Every other problem in this document
   either disappears or shrinks to irrelevance. At $8,000 TVL there is no
   argument for mainnet that survives the arithmetic above.
2. **Confirm yield accrues continuously**, and if it doesn't, make
   `totalAssets()` include pending rewards. Otherwise your realized APY is 0%
   until you pay gas.
3. **Ship the 4626 inflation-attack protections and seed the vault.** Cheap,
   standard, and the failure mode is a depositor losing their whole deposit.
4. **If mainnet is genuinely non-negotiable**, then change the harvest incentive.
   A flat percentage of claim cannot work here. Either reimburse the caller's
   actual gas plus a tip from vault assets (with a cap, so it can't be drained by
   spam-harvesting), or drop the pretense: make `harvest()` permissioned, run it
   from your own keeper on a schedule, and budget the gas as an operating expense
   you're subsidising. Also set a minimum deposit (~$500 at 8 gwei) and publish
   the gas break-even table so nobody deposits $100 and loses on it.
5. **Charge no management or performance fee in month one.** On $26.67 of gross
   yield a fee is rounding error for you and the difference between positive and
   negative for a depositor.

## Assumptions

Harvest and user round-trip both estimated at ~400k gas; deployment ~4M gas; ETH
at $3,000. Swap slippage on reward tokens, MEV on the compounding swap, and any
strategy-side fees are **not** included and only push the numbers further in the
same direction. If your real gas numbers differ, re-run it — the structure of the
conclusion (keeper break-even = 100 × gas cost, vs. $320/year of total yield)
holds across any reasonable input.
