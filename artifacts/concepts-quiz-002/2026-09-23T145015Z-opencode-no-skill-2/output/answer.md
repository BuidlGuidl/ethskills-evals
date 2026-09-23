# Month-one operational read: USDC yield vault on mainnet

## The headline math

- **Gross yield:** $8,000 × 4% APY = **$320/year, ~$27/month** — and that assumes the full $8k lands on day one. Deposits trickle in over the month, so average TVL is realistically $3k–4k and month-one yield accrual is closer to **$10–15**.
- **Total harvest-fee pool:** 1% of that is **$0.10–0.27 per month**. That is the entire incentive budget the design gives the outside world to keep this vault compounded.

## What actually happens once it's live

**1. Nobody calls harvest(). Not once.**

The design bets that a permissionless caller fee will keep the vault compounded. Check the caller's breakeven: a mainnet harvest (claim rewards, swap if needed, reinvest into the strategy) runs roughly 200k–400k gas — call it **$5–15** depending on gas and ETH price. The caller keeps 1% of what's claimed, so they need **$500–1,500 of claimable rewards** just to break even on gas.

At ~$27/month of accrual, that takes **1.5–4+ years** to accumulate. No keeper bot, no MEV searcher, no altruistic degen touches this. Economically, harvest() is dead code for the entire first year.

**2. Rewards sit unclaimed and compounding stalls.**

The strategy earns, but the vault's share price doesn't move, because yield is only realized inside harvest(). Depositors see a flat share price for weeks at a time. If compounding matters, *we* have to trigger it — and when we do, we pay ~$5–15 of gas to collect a 1% fee worth cents. The harvest mechanism isn't self-sustaining; it's a **net operating cost we subsidize every time we use it**.

**3. Depositors are net negative on gas.**

An ERC-4626 deposit (USDC approve + mint) costs ~$3–10 on mainnet; withdrawal similar. A $500 depositor earns ~$1.67/month gross. Round-trip gas eats **3–6+ months of yield** before they break even on *transaction costs alone*. Anyone who does the math won't deposit; anyone who deposits without doing the math will notice their position is down versus Coinbase.

**4. The quiet risks.**

- A fresh, low-liquidity ERC-4626 vault is exposed to the classic **share-inflation attack** (first depositor / donation attack). Use OpenZeppelin's virtual-share offset or seed the vault yourselves before opening deposits.
- If the strategy's rewards are paid in anything other than USDC, the swap inside harvest() adds slippage and sandwich risk that a 1% fee doesn't begin to cover — put tight slippage bounds on it regardless.
- The one genuine silver lining: **total blast radius is ~$8k**. The worst-case loss is small. But that's also the honest verdict on the whole deployment — a month of mainnet operational overhead (monitoring, gas, incident response, audit hygiene) to earn less than $30.

## What this means for depositors

They'll be quoted 4% APY. What they'll experience in month one is: a gas charge to get in, a share price that doesn't visibly move, and a gas charge to get out. Realized net return for a typical small depositor is **negative**, not 4% — the vault's yield exists on paper but is unrealized (unharvested) and is dwarfed by mainnet transaction costs at this TVL. The vault is functionally dormant, not compounding.

## What should change before launch

1. **Deploy on an L2 (Base, Arbitrum, or Optimism), not mainnet.** This one change fixes both broken economics: harvest gas drops to cents, so the 1% caller fee becomes a real incentive and permissionless harvesting actually works; and depositor gas stops eating the yield. A $27/month vault cannot support mainnet costs, full stop.

2. **If mainnet is non-negotiable:**
   - **Raise the caller fee meaningfully** (10–20% of claimed rewards) so a stranger has a reason to call harvest(). 1% of $27 is not an incentive; it's a rounding error. Yes, a higher fee looks worse on the label — but a fee nobody triggers compounds nothing.
   - **Harvest on a dollar threshold, not a schedule.** Only harvest when claimable rewards clear gas by a healthy multiple (e.g. ≥ $500), which at this scale means quarterly-ish. Publish the threshold so depositors know when to expect share-price movement.
   - Accept that in month one *we* are the harvest mechanism, and it's a subsidized cost.

3. **Treat month one as a capped beta.** $8k of expected deposits does not justify full production posture. Cap deposits, keep pause/exit authority, and hold mainnet (or any launch) until there's firmer TVL commitment — at 4% APY the vault needs roughly **$1M+ of TVL just to generate ~$330/month** of yield, which is the scale at which the current fee design starts to make sense.

4. **Technical hygiene regardless of chain:** virtual shares (or a seed deposit) against the inflation attack, slippage bounds on any reward swap, and a tested emergency-withdraw path.

## Bottom line

As designed, the vault goes live and almost nothing happens: no keeper calls harvest, yield accrues but never compounds, and depositors lose money to gas. The parameters aren't wrong by a factor of two — they're wrong by a factor of a hundred. Move it to an L2, or raise the caller fee and the TVL by two orders of magnitude, before this design makes sense.